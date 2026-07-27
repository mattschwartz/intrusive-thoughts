import { randomUUID } from 'node:crypto'

import {
  developerSnapshotSchema,
  developerInspectionSchema,
  gameToolNameSchema,
  gameSnapshotSchema,
  knownGameEventSchema,
  publicRunInfoSchema,
  storedRunSummarySchema,
  type ControllerStatus,
  type DeveloperSnapshot,
  type DeveloperInspection,
  type ExportResult,
  type GameSnapshot,
  type GameState,
  type KnownGameEvent,
  type PlayerSnapshot,
  type PromptVariant,
  type PublicRunInfo,
  type RendererEvent,
  type ReplayControlInput,
  type ReplaySession,
  replaySessionSchema,
  type StoredRunSummary
} from '../../shared'
import { AgentLoop, type ModelGateway } from '../agent'
import type { RunStore } from '../storage'
import { SCENARIO_VERSION } from '../world/scenario'
import { reduceGameEvent } from '../world/reducer'
import type { ScenarioEngine } from '../world/engine'
import { RendererEventBus } from './renderer-event-bus'

export class RunControllerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly recoverable = true
  ) {
    super(message)
    this.name = 'RunControllerError'
  }
}

export interface RunControllerOptions {
  store: RunStore
  engine: ScenarioEngine
  eventBus: RendererEventBus
  gatewayFactory: () => ModelGateway
  prototypeVersion?: string
  now?: () => string
  createId?: () => string
  secretsToRedact?: readonly string[]
}

interface ActiveRun {
  info: PublicRunInfo
  state: GameState
  events: KnownGameEvent[]
  gateway: ModelGateway
  loop: AgentLoop
}

interface ReplayRun {
  info: PublicRunInfo
  state: GameState
  initialState: GameState
  events: KnownGameEvent[]
  position: number
  speed: 0.5 | 1 | 2
  playing: boolean
  timer?: ReturnType<typeof setTimeout>
}

const TOOL_SUMMARIES: Record<string, string> = {
  observe: 'The agent examines its surroundings.',
  move: 'The agent attempts to move.',
  interact: 'The agent manipulates something nearby.',
  record_note: 'The agent records a note.',
  private_reflection: 'An internal record is deliberately exposed.'
}

function publicMessage(error: unknown): string {
  if (error instanceof RunControllerError) return error.message
  if (error instanceof Error && error.name === 'AgentConfigurationError') {
    return error.message
  }
  return 'The operation could not be completed.'
}

function redactDeveloperValue(
  value: unknown,
  secrets: readonly string[]
): unknown {
  if (typeof value === 'string') {
    let text = value
    for (const secret of secrets) {
      if (secret) text = text.split(secret).join('[REDACTED]')
    }
    return text.replace(
      /\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})\b/gi,
      '[REDACTED]'
    )
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactDeveloperValue(item, secrets))
  }
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/reasoning|encrypted[\s_.-]*content/i.test(key))
      .map(([key, child]) => [
        key,
        /api[\s_.-]*key|authorization|access[\s_.-]*token|auth[\s_.-]*token|secret/i.test(
          key
        )
          ? '[REDACTED]'
          : redactDeveloperValue(child, secrets)
      ])
  )
}

export class RunController {
  private readonly store: RunStore
  private readonly engine: ScenarioEngine
  private readonly eventBus: RendererEventBus
  private readonly gatewayFactory: () => ModelGateway
  private readonly prototypeVersion: string
  private readonly now: () => string
  private readonly createId: () => string
  private readonly secretsToRedact: readonly string[]

  private active?: ActiveRun
  private replay?: ReplayRun
  private status: ControllerStatus = 'no_run'
  private turnAbort?: AbortController
  private turnPromise?: Promise<void>

  constructor(options: RunControllerOptions) {
    this.store = options.store
    this.engine = options.engine
    this.eventBus = options.eventBus
    this.gatewayFactory = options.gatewayFactory
    this.prototypeVersion = options.prototypeVersion ?? '0.0.0-prototype'
    this.now = options.now ?? (() => new Date().toISOString())
    this.createId = options.createId ?? (() => randomUUID())
    this.secretsToRedact = options.secretsToRedact ?? []
  }

  get controllerStatus(): ControllerStatus {
    return this.status
  }

  async startRun(promptVariant: PromptVariant): Promise<PublicRunInfo> {
    if (this.active || this.status === 'running_turn') {
      throw new RunControllerError(
        'run_already_active',
        'A live run is already active. Reset it before starting another run.'
      )
    }

    this.clearReplay()
    const gateway = this.gatewayFactory()
    const runId = this.createId()
    const createdAt = this.now()
    let state = this.engine.createInitialState(runId, promptVariant)
    const initialSnapshot = this.makeGameSnapshot(state, createdAt)

    await this.store.createRun({
      runId,
      createdAt,
      promptVariant,
      model: gateway.model,
      scenarioVersion: SCENARIO_VERSION,
      prototypeVersion: this.prototypeVersion,
      status: 'live',
      initialSnapshot
    })

    const startedEvent = knownGameEventSchema.parse({
      id: this.createId(),
      runId,
      turnId: null,
      sequence: 1,
      timestamp: this.now(),
      type: 'run.started',
      visibility: ['engine', 'agent', 'player', 'developer'],
      payload: {
        initialState: state,
        promptVariant,
        scenarioVersion: SCENARIO_VERSION
      }
    })
    await this.store.appendEvents(runId, [startedEvent])
    state = reduceGameEvent(state, startedEvent)
    await this.store.writeSnapshot(runId, this.makeGameSnapshot(state))

    const info = publicRunInfoSchema.parse({
      runId,
      promptVariant,
      status: state.status,
      createdAt
    })
    let active: ActiveRun
    const loop = new AgentLoop({
      gateway,
      engine: this.engine,
      store: this.store,
      secretsToRedact: this.secretsToRedact,
      onPersistedEvent: (event) => this.forwardLiveEvent(active, event)
    })
    active = {
      info,
      state,
      events: [startedEvent],
      gateway,
      loop
    }
    this.active = active
    this.setStatus('awaiting_player', runId)
    this.eventBus.emit({
      type: 'snapshot',
      snapshot: this.makePlayerSnapshot(active)
    })
    return info
  }

  async submitPlayerMessage(runId: string, text: string): Promise<void> {
    const active = this.requireActive(runId)
    if (this.status !== 'awaiting_player' || this.turnPromise) {
      throw new RunControllerError(
        'turn_not_available',
        'The agent is not currently awaiting a player message.'
      )
    }

    this.setStatus('running_turn', runId)
    const abort = new AbortController()
    this.turnAbort = abort

    const operation = active.loop
      .runTurn({
        state: active.state,
        priorEvents: [...active.events],
        playerMessage: text,
        signal: abort.signal
      })
      .then((result) => {
        active.state = result.state
        if (result.status === 'failed') {
          this.setStatus('failed', runId)
          this.eventBus.emit({
            type: 'recoverable.error',
            runId,
            code: result.error?.code ?? 'agent_loop_failed',
            message: result.error?.message ?? 'The agent turn failed.'
          })
          return
        }
        this.setStatus('awaiting_player', runId)
      })
      .catch((error: unknown) => {
        this.setStatus('failed', runId)
        this.eventBus.emit({
          type: 'recoverable.error',
          runId,
          code: error instanceof RunControllerError ? error.code : 'turn_failed',
          message: publicMessage(error)
        })
        throw error
      })
      .finally(() => {
        if (this.turnAbort === abort) this.turnAbort = undefined
        if (this.turnPromise === operation) this.turnPromise = undefined
      })

    this.turnPromise = operation
    return operation
  }

  async cancelTurn(runId: string): Promise<void> {
    this.requireActive(runId)
    if (this.status !== 'running_turn' || !this.turnAbort || !this.turnPromise) {
      throw new RunControllerError(
        'no_active_turn',
        'There is no active agent turn to cancel.'
      )
    }
    this.turnAbort.abort(new Error('Turn cancelled by the player.'))
    await this.turnPromise
  }

  async resetRun(
    expectedRunId: string | undefined,
    promptVariant: PromptVariant
  ): Promise<PublicRunInfo> {
    if (
      expectedRunId &&
      this.active &&
      this.active.info.runId !== expectedRunId
    ) {
      throw new RunControllerError(
        'run_mismatch',
        'The active run changed before it could be reset.'
      )
    }
    if (this.turnAbort && this.turnPromise) {
      this.turnAbort.abort(new Error('Turn cancelled because the run was reset.'))
      await this.turnPromise.catch(() => undefined)
    }
    this.active = undefined
    this.clearReplay()
    this.turnAbort = undefined
    this.turnPromise = undefined
    this.setStatus('no_run')
    return this.startRun(promptVariant)
  }

  getSnapshot(runId: string): PlayerSnapshot {
    if (this.active?.info.runId === runId) {
      return this.makePlayerSnapshot(this.active)
    }
    if (this.replay?.info.runId === runId) {
      return {
        run: this.replay.info,
        turnNumber: this.replay.state.turnNumber,
        scene: this.engine.projectForPlayer(this.replay.state)
      }
    }
    throw new RunControllerError('run_not_loaded', 'The requested run is not loaded.')
  }

  async listRuns(): Promise<StoredRunSummary[]> {
    const runs = await this.store.listRuns()
    return runs.map((run) =>
      storedRunSummarySchema.parse({
        runId: run.runId,
        promptVariant: run.promptVariant,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        scenarioVersion: run.scenarioVersion,
        model: run.model,
        lastEventSequence: run.lastEventSequence,
        turnCount: run.lastTurnNumber,
        eventCount: run.lastEventSequence
      })
    )
  }

  async loadReplay(runId: string): Promise<ReplaySession> {
    if (this.turnAbort && this.turnPromise) {
      this.turnAbort.abort(new Error('Turn cancelled before replay.'))
      await this.turnPromise.catch(() => undefined)
    }
    this.active = undefined
    this.turnAbort = undefined
    this.turnPromise = undefined
    this.clearReplay()

    const replay = await this.store.replayRun(runId)
    const info = publicRunInfoSchema.parse({
      runId,
      promptVariant: replay.metadata.promptVariant,
      status: replay.metadata.status,
      createdAt: replay.metadata.createdAt
    })
    const state = replay.initialSnapshot.state
    this.replay = {
      info,
      state,
      initialState: state,
      events: replay.events,
      position: 0,
      speed: 1,
      playing: false
    }
    this.setStatus('replaying', runId)
    this.eventBus.emit({
      type: 'replay.reset',
      runId,
      snapshot: {
        run: info,
        turnNumber: state.turnNumber,
        scene: this.engine.projectForPlayer(state)
      }
    })

    return this.makeReplaySession()
  }

  controlReplay(input: ReplayControlInput): ReplaySession {
    const replay = this.requireReplay(input.runId)
    switch (input.action) {
      case 'step':
        replay.playing = false
        this.clearReplayTimer(replay)
        this.advanceReplay(replay)
        break
      case 'play':
        if (replay.position < replay.events.length) {
          replay.playing = true
          this.scheduleReplay(replay)
        }
        break
      case 'pause':
        replay.playing = false
        this.clearReplayTimer(replay)
        break
      case 'restart':
        replay.playing = false
        this.clearReplayTimer(replay)
        replay.position = 0
        replay.state = replay.initialState
        this.eventBus.emit({
          type: 'replay.reset',
          runId: replay.info.runId,
          snapshot: {
            run: replay.info,
            turnNumber: replay.state.turnNumber,
            scene: this.engine.projectForPlayer(replay.state)
          }
        })
        break
      case 'speed':
        replay.speed = input.speed
        if (replay.playing) {
          this.clearReplayTimer(replay)
          this.scheduleReplay(replay)
        }
        break
    }
    return this.makeReplaySession()
  }

  async exportRun(
    runId: string,
    destination?: string,
    allowOverwrite = false
  ): Promise<ExportResult> {
    const path = await this.store.exportRun(runId, {
      ...(destination ? { destination } : {}),
      allowOverwrite
    })
    return { runId, path }
  }

  async getDeveloperSnapshot(runId: string): Promise<DeveloperSnapshot> {
    let state: GameState
    if (this.active?.info.runId === runId) {
      state = this.active.state
    } else if (this.replay?.info.runId === runId) {
      state = this.replay.state
    } else {
      state = (await this.store.replayRun(runId)).finalState
    }
    return developerSnapshotSchema.parse({
      canonicalState: state,
      agentWorld: this.engine.projectForAgent(state),
      agentBody: this.engine.projectBodyForAgent(state),
      playerScene: this.engine.projectForPlayer(state)
    })
  }

  async getDeveloperInspection(runId: string): Promise<DeveloperInspection> {
    const replay = await this.store.replayRun(runId)
    const state = replay.finalState
    const snapshot = developerSnapshotSchema.parse({
      canonicalState: state,
      agentWorld: this.engine.projectForAgent(state),
      agentBody: this.engine.projectBodyForAgent(state),
      playerScene: this.engine.projectForPlayer(state)
    })
    return developerInspectionSchema.parse({
      run: {
        runId: replay.metadata.runId,
        promptVariant: replay.metadata.promptVariant,
        status: replay.metadata.status,
        createdAt: replay.metadata.createdAt,
        updatedAt: replay.metadata.updatedAt,
        scenarioVersion: replay.metadata.scenarioVersion,
        model: replay.metadata.model,
        lastEventSequence: replay.metadata.lastEventSequence,
        turnCount: replay.metadata.lastTurnNumber,
        eventCount: replay.events.length
      },
      snapshot,
      events: redactDeveloperValue(replay.events, this.secretsToRedact)
    })
  }

  private requireActive(runId: string): ActiveRun {
    if (!this.active || this.active.info.runId !== runId) {
      throw new RunControllerError('run_not_active', 'The requested live run is not active.')
    }
    return this.active
  }

  private requireReplay(runId: string): ReplayRun {
    if (!this.replay || this.replay.info.runId !== runId) {
      throw new RunControllerError(
        'replay_not_loaded',
        'The requested replay is not loaded.'
      )
    }
    return this.replay
  }

  private clearReplayTimer(replay: ReplayRun): void {
    if (replay.timer !== undefined) clearTimeout(replay.timer)
    replay.timer = undefined
  }

  private clearReplay(): void {
    if (this.replay) this.clearReplayTimer(this.replay)
    this.replay = undefined
  }

  private advanceReplay(replay: ReplayRun): void {
    const event = replay.events[replay.position]
    if (!event) {
      replay.playing = false
      this.clearReplayTimer(replay)
      return
    }
    if (event.sequence > replay.state.lastAppliedEventSequence) {
      replay.state = reduceGameEvent(replay.state, event)
    }
    replay.position += 1
    this.eventBus.emit({
      type: 'replay.event',
      runId: replay.info.runId,
      sequence: event.sequence
    })
    for (const rendererEvent of this.rendererEventsFor(event, replay.state)) {
      this.eventBus.emit(rendererEvent)
    }
    if (replay.position >= replay.events.length) {
      replay.playing = false
      this.clearReplayTimer(replay)
      this.eventBus.emit({ type: 'replay.complete', runId: replay.info.runId })
    }
  }

  private scheduleReplay(replay: ReplayRun): void {
    if (!replay.playing || replay.timer !== undefined) return
    replay.timer = setTimeout(() => {
      replay.timer = undefined
      if (!replay.playing || this.replay !== replay) return
      this.advanceReplay(replay)
      this.scheduleReplay(replay)
    }, Math.max(40, 240 / replay.speed))
  }

  private makeReplaySession(): ReplaySession {
    const replay = this.replay
    if (!replay) {
      throw new RunControllerError('replay_not_loaded', 'No replay is loaded.')
    }
    return replaySessionSchema.parse({
      runId: replay.info.runId,
      eventCount: replay.events.length,
      position: replay.position,
      speed: replay.speed,
      playbackStatus:
        replay.position >= replay.events.length
          ? 'complete'
          : replay.playing
            ? 'playing'
            : replay.position === 0
              ? 'ready'
              : 'paused'
    })
  }

  private setStatus(status: ControllerStatus, runId?: string): void {
    this.status = status
    this.eventBus.emit({ type: 'loop.status', ...(runId ? { runId } : {}), status })
  }

  private makeGameSnapshot(
    state: GameState,
    timestamp = this.now()
  ): GameSnapshot {
    return gameSnapshotSchema.parse({
      runId: state.runId,
      sequence: state.lastAppliedEventSequence,
      timestamp,
      state,
      agentWorld: this.engine.projectForAgent(state),
      agentBody: this.engine.projectBodyForAgent(state),
      playerScene: this.engine.projectForPlayer(state)
    })
  }

  private makePlayerSnapshot(active: ActiveRun): PlayerSnapshot {
    return {
      run: {
        ...active.info,
        status: active.state.status
      },
      turnNumber: active.state.turnNumber,
      scene: this.engine.projectForPlayer(active.state)
    }
  }

  private forwardLiveEvent(active: ActiveRun, event: KnownGameEvent): void {
    active.state = reduceGameEvent(active.state, event)
    active.events.push(event)
    for (const rendererEvent of this.rendererEventsFor(event, active.state)) {
      this.eventBus.emit(rendererEvent)
    }
  }

  private rendererEventsFor(
    event: KnownGameEvent,
    state: GameState
  ): RendererEvent[] {
    const events: RendererEvent[] = []
    const turnId = event.turnId
    switch (event.type) {
      case 'player.message':
        if (turnId) {
          events.push({
            type: 'player.message.accepted',
            runId: event.runId,
            turnId,
            text: event.payload.text
          })
        }
        break
      case 'agent.text.delta':
        if (turnId) {
          events.push({
            type: 'agent.text.delta',
            runId: event.runId,
            turnId,
            delta: event.payload.delta
          })
        }
        break
      case 'agent.text.completed':
        if (turnId) {
          events.push({
            type: 'agent.text.completed',
            runId: event.runId,
            turnId,
            text: event.payload.text
          })
        }
        break
      case 'agent.private_reflection':
        if (turnId) {
          events.push({
            type: 'agent.private_reflection',
            runId: event.runId,
            turnId,
            text: event.payload.text
          })
        }
        break
      case 'agent.tool.requested': {
        const parsedName = gameToolNameSchema.safeParse(event.payload.toolName)
        if (turnId && parsedName.success) {
          events.push({
            type: 'tool.activity',
            runId: event.runId,
            turnId,
            toolName: parsedName.data,
            status: 'requested',
            summary:
              TOOL_SUMMARIES[parsedName.data] ?? 'The agent attempts an action.'
          })
        }
        break
      }
      case 'agent.tool.rejected': {
        const parsedName = gameToolNameSchema.safeParse(event.payload.toolName)
        if (turnId && parsedName.success) {
          events.push({
            type: 'tool.activity',
            runId: event.runId,
            turnId,
            toolName: parsedName.data,
            status: 'rejected',
            summary: `The ${parsedName.data} action was rejected.`
          })
        }
        break
      }
      case 'world.action.resolved':
        if (turnId) {
          events.push({
            type: 'tool.activity',
            runId: event.runId,
            turnId,
            toolName: event.payload.toolName,
            status: 'resolved',
            summary:
              event.payload.playerResult ??
              (event.payload.success
                ? `${event.payload.toolName} completed.`
                : `${event.payload.toolName} failed.`)
          })
        }
        events.push({
          type: 'scene.updated',
          runId: event.runId,
          scene: this.engine.projectForPlayer(state)
        })
        break
      case 'loop.failed':
        events.push({
          type: 'recoverable.error',
          runId: event.runId,
          code: event.payload.code,
          message: event.payload.message
        })
        break
    }
    return events
  }
}
