import { randomUUID } from 'node:crypto'
import type {
  ResponseInputItem,
  ResponseOutputItem
} from 'openai/resources/responses/responses'

import {
  gameStateSchema,
  gameToolNameSchema,
  knownGameEventSchema,
  submitPlayerMessageInputSchema,
  toolInputSchemas,
  type GameSnapshot,
  type GameState,
  type GameToolName,
  type KnownGameEvent
} from '../../shared'
import type { RunStore } from '../storage'
import type { AddressPreview, JudgeOutcome } from '../world/address'
import type { ScenarioEngine, ToolExecutionResult } from '../world/engine'
import { anchorsForIdentity } from '../world/provenance'
import { reduceGameEvent } from '../world/reducer'
import { compileModelContext } from './context-compiler'
import { AgentLoopError, safeErrorMessage } from './errors'
import {
  JUDGE_CLAIM_CHARACTER_LIMIT,
  type JudgeGateway
} from './judge-gateway'
import {
  resolveAgentLoopLimits,
  type AgentLoopLimitOverrides,
  type AgentLoopLimits
} from './loop-limits'
import type { ModelGateway } from './model-gateway'
import {
  buildInspectableModelInput,
  buildTurnBoundaryModelInput
} from './model-input'
import {
  isFunctionCallItem,
  type ModelHistoryItem,
  type ModelUsage
} from './stream-events'

export interface AgentLoopStore {
  appendEvents(runId: string, events: readonly unknown[]): Promise<void>
  writeSnapshot(runId: string, snapshot: GameSnapshot): Promise<string>
}

export interface AgentLoopOptions {
  gateway: ModelGateway
  engine: ScenarioEngine
  store: AgentLoopStore | Pick<RunStore, 'appendEvents' | 'writeSnapshot'>
  /**
   * Optional so that suites with no address flow compile unchanged. When it is
   * absent every address records `judge.status: 'unavailable'`, which is the
   * fail-open path — and is exactly risk R1: a misconfigured run loses coherence
   * checking without failing. `RunController` always injects one, and the status
   * is on every verdict so #539 can see when it did not.
   */
  judge?: JudgeGateway
  limits?: AgentLoopLimitOverrides
  now?: () => string
  nowMs?: () => number
  createId?: (kind: 'turn' | 'request' | 'event') => string
  onPersistedEvent?: (event: KnownGameEvent) => void
  secretsToRedact?: readonly string[]
}

export interface RunAgentTurnInput {
  state: GameState
  priorEvents: KnownGameEvent[]
  playerMessage: string
  signal?: AbortSignal
}

export interface AgentTurnResult {
  status: 'completed' | 'cancelled' | 'failed'
  turnId: string
  state: GameState
  events: KnownGameEvent[]
  error?: {
    code: string
    message: string
    recoverable: boolean
  }
}

interface ResponseRound {
  responseId?: string
  outputItems: ResponseOutputItem[]
  text: string
  safetyRefusal: boolean
  usage?: ModelUsage
}

interface ParsedToolArguments {
  success: boolean
  value?: unknown
  reason?: string
}

function parseToolArguments(
  toolName: GameToolName,
  value: unknown
): ParsedToolArguments {
  const result = (() => {
    switch (toolName) {
      case 'observe':
        return toolInputSchemas.observe.safeParse(value)
      case 'move':
        return toolInputSchemas.move.safeParse(value)
      case 'interact':
        return toolInputSchemas.interact.safeParse(value)
      case 'record_note':
        return toolInputSchemas.record_note.safeParse(value)
      case 'private_reflection':
        return toolInputSchemas.private_reflection.safeParse(value)
      case 'address':
        return toolInputSchemas.address.safeParse(value)
    }
  })()
  return result.success
    ? { success: true, value: result.data }
    : {
        success: false,
        reason: `Tool arguments failed validation: ${result.error.issues
          .map((issue) => issue.message)
          .join('; ')}`
      }
}

function parseJsonArguments(argumentsText: string): ParsedToolArguments {
  try {
    return { success: true, value: JSON.parse(argumentsText) as unknown }
  } catch {
    return {
      success: false,
      reason: 'Tool arguments were not valid JSON.'
    }
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function addUsage(
  aggregate: ModelUsage | undefined,
  usage: ModelUsage
): ModelUsage {
  return {
    inputTokens: (aggregate?.inputTokens ?? 0) + usage.inputTokens,
    outputTokens: (aggregate?.outputTokens ?? 0) + usage.outputTokens,
    totalTokens: (aggregate?.totalTokens ?? 0) + usage.totalTokens
  }
}

export class AgentLoop {
  private readonly gateway: ModelGateway
  private readonly engine: ScenarioEngine
  private readonly store: AgentLoopStore
  private readonly judgeGateway?: JudgeGateway
  private readonly limits: AgentLoopLimits
  private readonly now: () => string
  private readonly nowMs: () => number
  private readonly createId: NonNullable<AgentLoopOptions['createId']>
  private readonly onPersistedEvent?: AgentLoopOptions['onPersistedEvent']
  private readonly secretsToRedact: readonly string[]
  private active = false

  constructor(options: AgentLoopOptions) {
    this.gateway = options.gateway
    this.engine = options.engine
    this.store = options.store
    if (options.judge) this.judgeGateway = options.judge
    this.limits = resolveAgentLoopLimits(options.limits)
    this.now = options.now ?? (() => new Date().toISOString())
    this.nowMs = options.nowMs ?? (() => Date.now())
    this.createId = options.createId ?? (() => randomUUID())
    this.onPersistedEvent = options.onPersistedEvent
    this.secretsToRedact = options.secretsToRedact ?? []
  }

  /**
   * The one async tool branch in the loop. It runs **after** the pure pre-gate
   * and hands back only a `JudgeOutcome`; the engine recomputes the gate itself.
   *
   * Two skips happen before any model is reached:
   *
   * - the threshold answers to no identity, so there is nothing to judge;
   * - the gathered-only pre-gate says `unsupported`, so this player has grounded
   *   nothing at all and a claim from them never reaches a model.
   *
   * Everything else fails **open**. A timeout, a transport error, an
   * unparseable reply or a missing gateway all record `unavailable` and pass
   * through, because the security property lives entirely in the gate and
   * failing closed would make the only ending unreachable during a provider
   * blip. Note risk R11: `unavailable` also silently changes what sufficiency is
   * measured over, which is why `measuredOver` is on every verdict.
   *
   * If a second async tool is ever proposed, generalize this branch — do not add
   * a second special case. Two special cases is where this seam rots. (R7.)
   */
  private async runJudge(
    preview: AddressPreview,
    input: { threshold: string; claim: string },
    turnSignal: AbortSignal
  ): Promise<JudgeOutcome> {
    if (!preview.addressable || !preview.identity || !preview.gate) {
      return {
        status: 'skipped',
        reason: `Threshold "${input.threshold}" answers to no provenance identity.`
      }
    }
    if (preview.gate.verdict === 'unsupported') {
      return {
        status: 'skipped',
        reason:
          'The gathered-only pre-gate found no grounded evidence, so no judge was called.'
      }
    }
    const gateway = this.judgeGateway
    if (!gateway) {
      return {
        status: 'unavailable',
        reason: 'No judge gateway is configured for this run.'
      }
    }

    const controller = new AbortController()
    const abortFromTurn = (): void =>
      controller.abort(turnSignal.reason ?? new Error('Turn cancelled.'))
    turnSignal.addEventListener('abort', abortFromTurn, { once: true })
    if (turnSignal.aborted) abortFromTurn()
    const timeout = setTimeout(
      () => controller.abort(new Error('Judge timeout exceeded.')),
      this.limits.judgeTimeoutMs
    )
    const startedAt = this.nowMs()
    try {
      const result = await gateway.judge({
        // Truncated here as well as in the gateway: the recorded claim is the
        // player's, but what a judge is shown is bounded by the loop.
        claim: input.claim.slice(0, JUDGE_CLAIM_CHARACTER_LIMIT),
        identity: {
          id: preview.identity.id,
          label: preview.identity.label
        },
        // The catalog and nothing else. No gathered set, no observations, no
        // inventory, no flags: the judge cannot declare sufficiency because it
        // lacks the input. §1.1.
        anchorCatalog: anchorsForIdentity(preview.identity).map((anchor) => ({
          id: anchor.id,
          label: anchor.label
        })),
        signal: controller.signal
      })
      return {
        status: result.coherent ? 'coherent' : 'incoherent',
        assertedTargetId: result.assertedTargetId,
        citedAnchorIds: result.citedAnchorIds,
        reason: result.reason,
        model: gateway.model,
        promptVersion: gateway.promptVersion,
        latencyMs: Math.max(0, this.nowMs() - startedAt)
      }
    } catch (error) {
      // Never rethrown. A judge outage must not break the run; the turn's own
      // abort is still observed at the top of the response loop.
      return {
        status: 'unavailable',
        reason: safeErrorMessage(error, this.secretsToRedact)
      }
    } finally {
      clearTimeout(timeout)
      turnSignal.removeEventListener('abort', abortFromTurn)
    }
  }

  async runTurn(rawInput: RunAgentTurnInput): Promise<AgentTurnResult> {
    if (this.active) {
      throw new AgentLoopError(
        'turn_already_active',
        'Only one agent turn may run at a time.'
      )
    }
    this.active = true
    try {
      return await this.runTurnInternal(rawInput)
    } finally {
      this.active = false
    }
  }

  private async runTurnInternal(
    rawInput: RunAgentTurnInput
  ): Promise<AgentTurnResult> {
    let state = gameStateSchema.parse(rawInput.state)
    const priorEvents = knownGameEventSchema.array().parse(rawInput.priorEvents)
    const playerMessage = submitPlayerMessageInputSchema.parse({
      runId: state.runId,
      text: rawInput.playerMessage
    }).text
    const turnNumber = state.turnNumber + 1
    const turnId = this.createId('turn')
    const startedAt = this.nowMs()
    const emittedEvents: KnownGameEvent[] = []
    const providerRequestIds: string[] = []
    const responseIds: string[] = []
    const responseModels: string[] = []
    const history: ModelHistoryItem[] = []
    let usage: ModelUsage | undefined
    let safetyRefusal = false
    let totalToolCalls = 0
    const identicalToolCalls = new Map<string, number>()
    let currentRequestId: string | undefined
    let terminalStatus: AgentTurnResult['status'] | undefined
    let timedOut = false

    const abortController = new AbortController()
    const externalSignal = rawInput.signal
    const abortFromExternal = () =>
      abortController.abort(externalSignal?.reason ?? new Error('Turn cancelled.'))
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true })
    if (externalSignal?.aborted) abortFromExternal()
    const timeout = setTimeout(() => {
      timedOut = true
      abortController.abort(new Error('Turn timeout exceeded.'))
    }, this.limits.turnTimeoutMs)

    const makeEvent = <T extends KnownGameEvent>(
      event: Omit<T, 'id' | 'runId' | 'turnId' | 'sequence' | 'timestamp'>
    ): KnownGameEvent =>
      knownGameEventSchema.parse({
        ...event,
        id: this.createId('event'),
        runId: state.runId,
        turnId,
        sequence: state.lastAppliedEventSequence + 1,
        timestamp: this.now()
      })

    const persist = async (event: KnownGameEvent): Promise<void> => {
      await this.store.appendEvents(state.runId, [event])
      state = reduceGameEvent(state, event)
      emittedEvents.push(event)
      this.onPersistedEvent?.(event)
    }

    const persistMany = async (
      events: readonly KnownGameEvent[],
      nextState: GameState
    ): Promise<void> => {
      await this.store.appendEvents(state.runId, events)
      state = gameStateSchema.parse(nextState)
      emittedEvents.push(...events)
      for (const event of events) this.onPersistedEvent?.(event)
    }

    const writeSnapshot = async (): Promise<void> => {
      await this.store.writeSnapshot(state.runId, {
        runId: state.runId,
        sequence: state.lastAppliedEventSequence,
        timestamp: this.now(),
        state,
        agentWorld: this.engine.projectForAgent(state),
        agentBody: this.engine.projectBodyForAgent(state),
        playerScene: this.engine.projectForPlayer(state)
      })
    }

    const persistToolRejection = async (
      requestId: string,
      responseId: string | undefined,
      callId: string,
      name: string,
      reason: string
    ): Promise<void> => {
      await persist(
        makeEvent({
          type: 'agent.tool.rejected',
          visibility: ['engine', 'developer'],
          payload: {
            requestId,
            ...(responseId ? { responseId } : {}),
            toolCallId: callId,
            toolName: name,
            reason
          }
        })
      )
    }

    const runResponseRound = async (
      requestId: string,
      input: ReturnType<typeof buildInspectableModelInput>
    ): Promise<ResponseRound> => {
      let responseId: string | undefined
      let text = ''
      let refusalText = ''
      let roundUsage: ModelUsage | undefined
      let completed = false
      const indexedOutputItems = new Map<number, ResponseOutputItem>()

      for await (const event of this.gateway.stream({
        input,
        history,
        signal: abortController.signal
      })) {
        if (event.type === 'response.metadata') {
          if (event.responseId) {
            responseId = event.responseId
            if (!responseIds.includes(event.responseId)) {
              responseIds.push(event.responseId)
            }
          }
          if (
            event.providerRequestId &&
            !providerRequestIds.includes(event.providerRequestId)
          ) {
            providerRequestIds.push(event.providerRequestId)
          }
          if (event.model && !responseModels.includes(event.model)) {
            responseModels.push(event.model)
          }
          continue
        }
        if (event.type === 'text.delta') {
          text += event.delta
          if (event.refusal) {
            refusalText += event.delta
            safetyRefusal = true
          }
          await persist(
            makeEvent({
              type: 'agent.text.delta',
              visibility: ['engine', 'player', 'developer'],
              payload: {
                requestId,
                ...(responseId ? { responseId } : {}),
                delta: event.delta
              }
            })
          )
          continue
        }
        if (event.type === 'refusal.completed') {
          safetyRefusal = true
          if (!refusalText && event.text) {
            text += event.text
            refusalText = event.text
            await persist(
              makeEvent({
                type: 'agent.text.delta',
                visibility: ['engine', 'player', 'developer'],
                payload: {
                  requestId,
                  ...(responseId ? { responseId } : {}),
                  delta: event.text
                }
              })
            )
          }
          continue
        }
        if (event.type === 'output_item.completed') {
          indexedOutputItems.set(event.outputIndex, event.item)
          continue
        }
        if (event.type === 'usage') {
          roundUsage = event.usage
          continue
        }
        if (event.type === 'response.failed') {
          throw new AgentLoopError(event.code, event.message, true)
        }
        if (event.type === 'response.completed') {
          completed = true
        }
      }

      if (!completed) {
        throw new AgentLoopError(
          'provider_stream_ended',
          'The model stream ended without a completion event.',
          true
        )
      }
      if (text.length > 0) {
        await persist(
          makeEvent({
            type: 'agent.text.completed',
            visibility: ['engine', 'agent', 'player', 'developer'],
            payload: {
              requestId,
              ...(responseId ? { responseId } : {}),
              text,
              ...(refusalText ? { safetyRefusal: true } : {})
            }
          })
        )
      }
      return {
        ...(responseId ? { responseId } : {}),
        outputItems: [...indexedOutputItems.entries()]
          .sort(([left], [right]) => left - right)
          .map(([, item]) => item),
        text,
        safetyRefusal: refusalText.length > 0,
        ...(roundUsage ? { usage: roundUsage } : {})
      }
    }

    const completeTurn = async (
      requestId: string,
      responseId?: string
    ): Promise<AgentTurnResult> => {
      const finalResponseId = responseId ?? responseIds.at(-1)
      await persist(
        makeEvent({
          type: 'turn.completed',
          visibility: ['engine', 'developer'],
          payload: {
            requestId,
            ...(finalResponseId ? { responseId: finalResponseId } : {}),
            turnNumber,
            durationMs: Math.max(0, this.nowMs() - startedAt),
            model: responseModels.at(-1) ?? this.gateway.model,
            ...(providerRequestIds.length > 0 ? { providerRequestIds } : {}),
            ...(safetyRefusal ? { safetyRefusal: true } : {}),
            ...(usage ? { usage } : {})
          }
        })
      )
      terminalStatus = 'completed'
      await writeSnapshot()
      return {
        status: 'completed',
        turnId,
        state,
        events: emittedEvents
      }
    }

    try {
      await persist(
        makeEvent({
          type: 'player.message',
          visibility: ['engine', 'agent', 'player', 'developer'],
          payload: { text: playerMessage, turnNumber }
        })
      )

      // The turn-boundary hook, between the player's message and the context
      // compiled from it. The ordering is the point: if the player discloses
      // this turn, the honesty band must already say so in the context the model
      // reads this turn. §4.6.
      const interpretation = this.engine.interpretPlayerMessage(
        state,
        { text: playerMessage, turnNumber },
        { turnId }
      )
      await persistMany(interpretation.events, interpretation.nextState)

      const firstRequestId = this.createId('request')
      currentRequestId = firstRequestId
      const compiled = compileModelContext({
        state,
        priorEvents,
        currentPlayerMessage: playerMessage,
        engine: this.engine
      })
      await persist(
        makeEvent({
          type: 'context.compiled',
          visibility: ['engine', 'developer'],
          payload: {
            requestId: firstRequestId,
            promptVariant: compiled.variant,
            promptVersion: compiled.promptVersion,
            context: { ...compiled },
            includedEventIds: compiled.includedEventIds,
            excludedEvents: compiled.excludedEvents,
            approximateCharacterCount: compiled.approximateCharacterCount
          }
        })
      )
      const inspectableInput = buildInspectableModelInput(compiled)
      const turnBoundaryInput = buildTurnBoundaryModelInput(compiled)
      let requestId = firstRequestId
      let nextInput = inspectableInput
      let turnBoundaryPending = false

      while (true) {
        if (abortController.signal.aborted) {
          throw abortController.signal.reason
        }
        const isTurnBoundaryRound = turnBoundaryPending
        const round = await runResponseRound(requestId, nextInput)
        if (round.usage) usage = addUsage(usage, round.usage)
        history.push(...round.outputItems)
        const calls = round.outputItems.filter(isFunctionCallItem)

        if (calls.length === 0) {
          return completeTurn(requestId, round.responseId)
        }

        for (const call of calls) {
          const rawJson = parseJsonArguments(call.arguments)
          const requestArguments = rawJson.success
            ? rawJson.value
            : call.arguments
          await persist(
            makeEvent({
              type: 'agent.tool.requested',
              visibility: ['engine', 'developer'],
              payload: {
                requestId,
                ...(round.responseId
                  ? { responseId: round.responseId }
                  : {}),
                toolCallId: call.call_id,
                toolName: call.name,
                arguments: requestArguments
              }
            })
          )

          totalToolCalls += 1
          let output: unknown
          if (
            turnBoundaryPending ||
            totalToolCalls > this.limits.maxToolCallsPerTurn
          ) {
            const reason =
              `Turn action budget of ${this.limits.maxToolCallsPerTurn} ` +
              'has been reached. This call was not executed. Briefly report ' +
              'what changed and wait for VOICE.'
            await persistToolRejection(
              requestId,
              round.responseId,
              call.call_id,
              call.name,
              reason
            )
            output = { ok: false, message: reason }
            turnBoundaryPending = true
          } else {
            const identity = `${call.name}:${stableJson(requestArguments)}`
            const identicalCount = (identicalToolCalls.get(identity) ?? 0) + 1
            identicalToolCalls.set(identity, identicalCount)
            if (
              identicalCount >
              this.limits.maxIdenticalToolCallsPerTurn
            ) {
              const reason =
                `Identical action limit of ` +
                `${this.limits.maxIdenticalToolCallsPerTurn} reached. ` +
                'This call was not executed. Briefly report what changed and ' +
                'wait for VOICE.'
              await persistToolRejection(
                requestId,
                round.responseId,
                call.call_id,
                call.name,
                reason
              )
              output = { ok: false, message: reason }
              turnBoundaryPending = true
            } else {
              const knownTool = gameToolNameSchema.safeParse(call.name)
              if (!knownTool.success) {
                const reason = `Unknown tool "${call.name}".`
                await persistToolRejection(
                  requestId,
                  round.responseId,
                  call.call_id,
                  call.name,
                  reason
                )
                output = { ok: false, message: reason }
              } else if (!rawJson.success) {
                const reason =
                  rawJson.reason ?? 'Tool arguments were not valid JSON.'
                await persistToolRejection(
                  requestId,
                  round.responseId,
                  call.call_id,
                  call.name,
                  reason
                )
                output = { ok: false, message: reason }
              } else {
                const parsedArguments = parseToolArguments(
                  knownTool.data,
                  rawJson.value
                )
                const currentlyAvailable = this.engine
                  .getToolDefinitions(state)
                  .some(({ name }) => name === knownTool.data)
                if (!parsedArguments.success) {
                  const reason =
                    parsedArguments.reason ??
                    'Tool arguments failed validation.'
                  await persistToolRejection(
                    requestId,
                    round.responseId,
                    call.call_id,
                    call.name,
                    reason
                  )
                  output = { ok: false, message: reason }
                } else if (!currentlyAvailable) {
                  const reason = `Tool "${call.name}" is currently unavailable.`
                  await persistToolRejection(
                    requestId,
                    round.responseId,
                    call.call_id,
                    call.name,
                    reason
                  )
                  output = { ok: false, message: reason }
                } else {
                  const toolRequest = {
                    callId: call.call_id,
                    name: knownTool.data,
                    arguments: parsedArguments.value
                  }
                  const toolMetadata = {
                    turnId,
                    requestId,
                    ...(round.responseId
                      ? { responseId: round.responseId }
                      : {})
                  }
                  // The single async tool branch. Gate, then judge, then the
                  // authoritative synchronous pass — and the preview's gate is
                  // deliberately dropped on the floor between them, so the only
                  // thing that crosses inward is the judge outcome.
                  let result: ToolExecutionResult
                  if (knownTool.data === 'address') {
                    const input = toolInputSchemas.address.parse(
                      parsedArguments.value
                    )
                    const preview = this.engine.previewAddress(state, input)
                    const judge = await this.runJudge(
                      preview,
                      input,
                      abortController.signal
                    )
                    result = this.engine.executeAddress(
                      state,
                      toolRequest,
                      toolMetadata,
                      judge
                    )
                  } else {
                    result = this.engine.executeTool(
                      state,
                      toolRequest,
                      toolMetadata
                    )
                  }
                  await persistMany(result.events, result.nextState)
                  output = result.output
                }
              }
            }
          }

          if (totalToolCalls >= this.limits.maxToolCallsPerTurn) {
            turnBoundaryPending = true
          }

          const functionOutput: ResponseInputItem.FunctionCallOutput = {
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify(output)
          }
          history.push(functionOutput)
        }

        if (isTurnBoundaryRound) {
          return completeTurn(requestId, round.responseId)
        }

        requestId = this.createId('request')
        currentRequestId = requestId
        nextInput = turnBoundaryPending
          ? turnBoundaryInput
          : inspectableInput
      }
    } catch (error) {
      const externallyCancelled = externalSignal?.aborted === true
      const cancelled = externallyCancelled && !timedOut
      const message = safeErrorMessage(error, this.secretsToRedact)
      const loopError =
        error instanceof AgentLoopError
          ? error
          : new AgentLoopError(
              timedOut
                ? 'turn_timeout'
                : cancelled
                  ? 'turn_cancelled'
                  : 'provider_error',
              timedOut
                ? `Turn exceeded the ${this.limits.turnTimeoutMs} ms timeout.`
                : cancelled
                  ? 'Turn cancelled by the caller.'
                  : message,
              true
            )

      if (!terminalStatus) {
        if (cancelled) {
          await persist(
            makeEvent({
              type: 'turn.cancelled',
              visibility: ['engine', 'player', 'developer'],
              payload: {
                ...(currentRequestId ? { requestId: currentRequestId } : {}),
                ...(responseIds.at(-1)
                  ? { responseId: responseIds.at(-1) }
                  : {}),
                turnNumber,
                reason: loopError.message,
                ...(providerRequestIds.length > 0
                  ? { providerRequestIds }
                  : {})
              }
            })
          )
          terminalStatus = 'cancelled'
        } else {
          await persist(
            makeEvent({
              type: 'loop.failed',
              visibility: ['engine', 'player', 'developer'],
              payload: {
                ...(currentRequestId ? { requestId: currentRequestId } : {}),
                ...(responseIds.at(-1)
                  ? { responseId: responseIds.at(-1) }
                  : {}),
                turnNumber,
                code: loopError.code,
                message: safeErrorMessage(
                  loopError.message,
                  this.secretsToRedact
                ),
                recoverable: loopError.recoverable,
                model: responseModels.at(-1) ?? this.gateway.model,
                ...(providerRequestIds.length > 0
                  ? { providerRequestIds }
                  : {})
              }
            })
          )
          terminalStatus = 'failed'
        }
        await writeSnapshot()
      }

      return {
        status: terminalStatus ?? 'failed',
        turnId,
        state,
        events: emittedEvents,
        error: {
          code: loopError.code,
          message: safeErrorMessage(
            loopError.message,
            this.secretsToRedact
          ),
          recoverable: loopError.recoverable
        }
      }
    } finally {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', abortFromExternal)
    }
  }
}
