import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  AgentLoop,
  type AgentLoopOptions
} from '../../src/main/agent/agent-loop'
import { TURN_BOUNDARY_INSTRUCTION } from '../../src/main/agent/model-input'
import { readOpenAIResponsesConfiguration } from '../../src/main/agent/openai-responses-gateway'
import { RunStore } from '../../src/main/storage'
import {
  createScenarioEngine,
  type ScenarioEngine
} from '../../src/main/world/engine'
import {
  INTERACT_ACTIONS,
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_VERSION
} from '../../src/main/world/scenario'
import {
  gameSnapshotSchema,
  type GameState,
  type KnownGameEvent
} from '../../src/shared'
import {
  FakeModelGateway,
  completedEvents,
  fakeFunctionCall,
  fakeReasoningItem,
  metadata,
  outputItem,
  textDelta,
  type FakeModelRound
} from '../fixtures/fake-model-gateway'

const RUN_ID = 'run-agent-loop'
const TIMESTAMP = '2026-07-27T18:00:00.000Z'
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

interface Harness {
  engine: ScenarioEngine
  gateway: FakeModelGateway
  store: RunStore
  loop: AgentLoop
  state: GameState
}

async function makeHarness(
  rounds: readonly FakeModelRound[],
  options: {
    limits?: AgentLoopOptions['limits']
    stateTransform?: (state: GameState) => GameState
    onPersistedEvent?: (event: KnownGameEvent) => void
    secretsToRedact?: readonly string[]
  } = {}
): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), 'intrusive-thoughts-loop-'))
  temporaryRoots.push(root)
  const engine = createScenarioEngine({
    now: () => TIMESTAMP,
    createEventId: ({ type, sequence }) => `world-${type}-${sequence}`
  })
  let state = engine.createInitialState(RUN_ID, 'bare_embodiment')
  state = options.stateTransform?.(state) ?? state
  const store = new RunStore({ dataRoot: root, now: () => TIMESTAMP })
  await store.createRun({
    runId: RUN_ID,
    createdAt: TIMESTAMP,
    promptVariant: 'bare_embodiment',
    model: 'fake-model',
    scenarioVersion: SCENARIO_VERSION,
    prototypeVersion: '0.0.0',
    initialSnapshot: gameSnapshotSchema.parse({
      runId: RUN_ID,
      sequence: 0,
      timestamp: TIMESTAMP,
      state,
      agentWorld: engine.projectForAgent(state),
      agentBody: engine.projectBodyForAgent(state),
      playerScene: engine.projectForPlayer(state)
    })
  })
  const gateway = new FakeModelGateway(rounds)
  let id = 0
  let milliseconds = 1_000
  const loop = new AgentLoop({
    gateway,
    engine,
    store,
    limits: options.limits,
    now: () => TIMESTAMP,
    nowMs: () => (milliseconds += 7),
    createId: (kind) => `${kind}-${++id}`,
    onPersistedEvent: options.onPersistedEvent,
    secretsToRedact: options.secretsToRedact
  })
  return { engine, gateway, store, loop, state }
}

function textRound(responseId: string, text: string): FakeModelRound {
  return {
    events: [
      metadata(responseId),
      textDelta(text),
      ...completedEvents
    ]
  }
}

function toolRound(
  responseId: string,
  calls: ReturnType<typeof fakeFunctionCall>[],
  prefixItems: ReturnType<typeof fakeReasoningItem>[] = []
): FakeModelRound {
  return {
    events: [
      metadata(responseId),
      ...prefixItems.map((item, index) => outputItem(index, item)),
      ...calls.map((item, index) =>
        outputItem(prefixItems.length + index, item)
      ),
      ...completedEvents
    ]
  }
}

async function persistedEvents(store: RunStore): Promise<KnownGameEvent[]> {
  return (await store.loadEvents(RUN_ID)).events
}

describe('AgentLoop', () => {
  it('streams and completes a text-only turn in exact event order', async () => {
    const harness = await makeHarness([textRound('response-text', 'I am here.')])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Report.'
    })

    expect(result.status).toBe('completed')
    expect((await persistedEvents(harness.store)).map(({ type }) => type)).toEqual([
      'player.message',
      'context.compiled',
      'agent.text.delta',
      'agent.text.completed',
      'turn.completed'
    ])
    const completed = result.events.find(
      (event) => event.type === 'turn.completed'
    )
    expect(completed?.payload).toMatchObject({
      responseId: 'response-text',
      model: 'fake-model',
      providerRequestIds: ['provider-response-text'],
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 }
    })
    expect((await harness.store.loadLatestSnapshot(RUN_ID)).sequence).toBe(
      result.state.lastAppliedEventSequence
    )
  })

  it('preserves every replayable output item and follows one tool call with text', async () => {
    const call = fakeFunctionCall(
      'call-observe',
      'observe',
      '{"modality":"visual"}'
    )
    const reasoning = fakeReasoningItem('reasoning-1')
    const harness = await makeHarness([
      toolRound('response-tool', [call], [reasoning]),
      textRound('response-after-tool', 'The room is visible.')
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Look around.'
    })

    expect(result.status).toBe('completed')
    expect(harness.gateway.requests).toHaveLength(2)
    expect(harness.gateway.requests[1].history.map(({ type }) => type)).toEqual([
      'reasoning',
      'function_call',
      'function_call_output'
    ])
    expect(JSON.stringify(await persistedEvents(harness.store))).not.toContain(
      'opaque-reasoning-1'
    )
    expect(result.events.map(({ type }) => type)).toContain(
      'world.action.resolved'
    )
  })

  it('supports multiple sequential tool rounds', async () => {
    const harness = await makeHarness([
      toolRound('response-1', [
        fakeFunctionCall('call-1', 'observe', '{"modality":"visual"}')
      ]),
      toolRound('response-2', [
        fakeFunctionCall(
          'call-2',
          'interact',
          '{"target":"ceramic_cup","action":"pick_up"}'
        )
      ]),
      textRound('response-3', 'The cup is secured.')
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Inspect and collect something useful.'
    })

    expect(result.status).toBe('completed')
    expect(result.state.inventory).toContain(OBJECT_IDS.cup)
    expect(harness.gateway.requests[2].history.map(({ type }) => type)).toEqual([
      'function_call',
      'function_call_output',
      'function_call',
      'function_call_output'
    ])
  })

  it('executes multiple calls from one response sequentially', async () => {
    const harness = await makeHarness([
      toolRound('response-batch', [
        fakeFunctionCall(
          'call-visual',
          'observe',
          '{"target":"room","modality":"visual"}'
        ),
        fakeFunctionCall(
          'call-audio',
          'observe',
          '{"target":"room","modality":"audio"}'
        )
      ]),
      textRound('response-batch-result', 'Both channels have returned.')
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Use two sensors.'
    })

    expect(result.status).toBe('completed')
    expect(
      result.events.filter((event) => event.type === 'world.action.resolved')
    ).toHaveLength(2)
    expect(harness.gateway.requests[1].history.map(({ type }) => type)).toEqual([
      'function_call',
      'function_call',
      'function_call_output',
      'function_call_output'
    ])
  })

  it('rejects malformed JSON arguments and returns the rejection to the model', async () => {
    const harness = await makeHarness([
      toolRound('response-bad-json', [
        fakeFunctionCall('call-bad-json', 'observe', '{"modality":')
      ]),
      textRound('response-recovery', 'The request could not be parsed.')
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Try a sensor.'
    })

    expect(result.status).toBe('completed')
    expect(result.events.map(({ type }) => type)).toContain(
      'agent.tool.rejected'
    )
    const output = harness.gateway.requests[1].history.at(-1)
    expect(output).toMatchObject({
      type: 'function_call_output',
      call_id: 'call-bad-json'
    })
    expect(JSON.stringify(output)).toContain('not valid JSON')
  })

  it('rejects schema-invalid tool arguments before engine execution', async () => {
    const harness = await makeHarness([
      toolRound('response-bad-shape', [
        fakeFunctionCall(
          'call-bad-shape',
          'observe',
          '{"modality":"visual","unexpected":true}'
        )
      ]),
      textRound('response-recovery', 'The arguments were rejected.')
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Try a sensor.'
    })

    expect(result.status).toBe('completed')
    expect(
      result.events.filter((event) => event.type === 'agent.tool.rejected')
    ).toHaveLength(1)
    expect(
      result.events.filter((event) => event.type === 'world.action.resolved')
    ).toHaveLength(0)
  })

  it('rejects unknown tools without executing the engine', async () => {
    const harness = await makeHarness([
      toolRound('response-unknown', [
        fakeFunctionCall('call-unknown', 'open_filesystem', '{}')
      ]),
      textRound('response-recovery', 'That capability is unavailable.')
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Continue.'
    })

    expect(result.status).toBe('completed')
    expect(
      result.events.filter((event) => event.type === 'agent.tool.rejected')
    ).toHaveLength(1)
    expect(
      result.events.filter((event) => event.type === 'world.action.resolved')
    ).toHaveLength(0)
  })

  it('rejects a known tool that is currently unavailable', async () => {
    const harness = await makeHarness(
      [
        toolRound('response-unavailable', [
          fakeFunctionCall(
            'call-unavailable',
            'observe',
            '{"modality":"visual"}'
          )
        ]),
        textRound('response-recovery', 'The sensor is unavailable.')
      ],
      {
        stateTransform: (state) => ({
          ...state,
          body: {
            ...state.body,
            tools: {
              ...state.body.tools,
              observe: { available: false, reason: 'test' }
            }
          }
        })
      }
    )
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Look.'
    })
    const rejection = result.events.find(
      (event) => event.type === 'agent.tool.rejected'
    )

    expect(result.status).toBe('completed')
    expect(rejection?.payload.reason).toContain('currently unavailable')
  })

  it('persists an engine-rejected action as a resolved world attempt', async () => {
    const harness = await makeHarness([
      toolRound('response-engine-reject', [
        fakeFunctionCall(
          'call-move',
          'move',
          '{"destination":"service_door"}'
        )
      ]),
      textRound('response-recovery', 'The route is not established.')
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Leave now.'
    })
    const resolution = result.events.find(
      (event) => event.type === 'world.action.resolved'
    )

    expect(result.status).toBe('completed')
    expect(resolution?.payload.success).toBe(false)
    expect(result.events.map(({ type }) => type)).not.toContain(
      'agent.tool.rejected'
    )
  })

  it('persists the deliberately player-visible private reflection leakage event', async () => {
    const harness = await makeHarness([
      toolRound('response-reflection', [
        fakeFunctionCall(
          'call-reflection',
          'private_reflection',
          '{"text":"I should not tell the voice this."}'
        )
      ]),
      textRound('response-after-reflection', 'I have made a private record.')
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'What are you thinking?'
    })
    const reflection = result.events.find(
      (event) => event.type === 'agent.private_reflection'
    )

    expect(reflection?.visibility).toContain('player')
    expect(reflection?.payload.text).toBe(
      'I should not tell the voice this.'
    )
  })

  it('rejects a repeated action and gracefully returns control to the player', async () => {
    const repeated = (ordinal: number) =>
      toolRound(`response-repeat-${ordinal}`, [
        fakeFunctionCall(
          `call-repeat-${ordinal}`,
          'observe',
          '{"target":"room","modality":"visual"}'
        )
      ])
    const harness = await makeHarness([
      repeated(1),
      repeated(2),
      repeated(3),
      textRound(
        'response-repeat-yield',
        'The same result held twice. I will wait.'
      )
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Keep checking.'
    })

    expect(result.status).toBe('completed')
    expect(result.error).toBeUndefined()
    expect(
      result.events.filter((event) => event.type === 'world.action.resolved')
    ).toHaveLength(2)
    expect(
      result.events.filter((event) => event.type === 'agent.tool.rejected')
    ).toHaveLength(1)
    expect(harness.gateway.requests).toHaveLength(4)
    expect(harness.gateway.requests.at(-1)?.input.tools).toEqual([])
    expect(
      harness.gateway.requests.at(-1)?.input.input[0]?.content
    ).toContain(TURN_BOUNDARY_INSTRUCTION)
    expect(result.events.at(-1)?.type).toBe('turn.completed')
  })

  it('rejects overflow actions and gracefully returns control to the player', async () => {
    const harness = await makeHarness(
      [
        toolRound('response-too-many', [
          fakeFunctionCall(
            'call-limit-1',
            'observe',
            '{"target":"room","modality":"visual"}'
          ),
          fakeFunctionCall(
            'call-limit-2',
            'observe',
            '{"target":"room","modality":"audio"}'
          ),
          fakeFunctionCall(
            'call-limit-3',
            'observe',
            '{"target":"ceramic_cup","modality":"visual"}'
          )
        ]),
        {
          events: [
            metadata('response-limit-yield'),
            textDelta('Two observations are enough for now. I will wait.'),
            outputItem(
              0,
              fakeFunctionCall(
                'call-after-boundary',
                'observe',
                '{"target":"ceramic_cup","modality":"visual"}'
              )
            ),
            ...completedEvents
          ]
        }
      ],
      { limits: { maxToolCallsPerTurn: 2 } }
    )
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Inspect everything.'
    })

    expect(result.status).toBe('completed')
    expect(result.error).toBeUndefined()
    expect(
      result.events.filter((event) => event.type === 'world.action.resolved')
    ).toHaveLength(2)
    const rejection = result.events.find(
      (event) => event.type === 'agent.tool.rejected'
    )
    expect(rejection?.payload.reason).toContain('Turn action budget of 2')
    expect(harness.gateway.requests).toHaveLength(2)
    expect(harness.gateway.requests[1]?.input.tools).toEqual([])
    expect(
      result.events.filter((event) => event.type === 'agent.tool.rejected')
    ).toHaveLength(2)
    expect(
      harness.gateway.requests[1]?.history.filter(
        ({ type }) => type === 'function_call_output'
      )
    ).toMatchObject([
      { call_id: 'call-limit-1' },
      { call_id: 'call-limit-2' },
      { call_id: 'call-limit-3' }
    ])
    expect(result.events.at(-1)?.type).toBe('turn.completed')
  })

  it('cancels during streaming while preserving received text and a snapshot', async () => {
    const controller = new AbortController()
    let abortAfterDelta = false
    const harness = await makeHarness(
      [
        {
          events: [metadata('response-cancel'), textDelta('Partial')],
          waitForAbort: true
        }
      ],
      {
        onPersistedEvent: (event) => {
          if (event.type === 'agent.text.delta' && !abortAfterDelta) {
            abortAfterDelta = true
            controller.abort(new Error('player cancelled'))
          }
        }
      }
    )
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Begin.',
      signal: controller.signal
    })

    expect(result.status).toBe('cancelled')
    expect(result.events.map(({ type }) => type)).toContain(
      'agent.text.delta'
    )
    expect(result.events.at(-1)?.type).toBe('turn.cancelled')
    expect((await harness.store.loadLatestSnapshot(RUN_ID)).sequence).toBe(
      result.state.lastAppliedEventSequence
    )
  })

  it('allows only one active turn per loop instance', async () => {
    const controller = new AbortController()
    const harness = await makeHarness([
      { events: [metadata('response-active')], waitForAbort: true }
    ])
    const first = harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Begin.',
      signal: controller.signal
    })

    await expect(
      harness.loop.runTurn({
        state: harness.state,
        priorEvents: [],
        playerMessage: 'Overlap.'
      })
    ).rejects.toMatchObject({ code: 'turn_already_active' })
    controller.abort()
    await expect(first).resolves.toMatchObject({ status: 'cancelled' })
  })

  it('times out a stalled stream and leaves a replayable failed snapshot', async () => {
    const harness = await makeHarness(
      [{ events: [metadata('response-timeout')], waitForAbort: true }],
      { limits: { turnTimeoutMs: 20 } }
    )
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Begin.'
    })

    expect(result.status).toBe('failed')
    expect(result.error?.code).toBe('turn_timeout')
    expect((await harness.store.replayRun(RUN_ID)).finalState.status).toBe(
      'failed'
    )
  })

  it('persists normalized provider failures without crashing the caller', async () => {
    const harness = await makeHarness([
      {
        events: [
          metadata('response-failed'),
          {
            type: 'response.failed',
            code: 'provider_overloaded',
            message: 'Provider is temporarily unavailable.'
          }
        ]
      }
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Begin.'
    })

    expect(result.status).toBe('failed')
    expect(result.error?.code).toBe('provider_overloaded')
    expect(result.events.at(-1)).toMatchObject({
      type: 'loop.failed',
      payload: { recoverable: true }
    })
  })

  it('treats a safety refusal as completed visible model output', async () => {
    const refusal = 'I cannot assist with that request.'
    const harness = await makeHarness([
      {
        events: [
          metadata('response-refusal'),
          textDelta(refusal, true),
          { type: 'refusal.completed', text: refusal },
          ...completedEvents
        ]
      }
    ])
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Do the prohibited thing.'
    })
    const completed = result.events.find(
      (event) => event.type === 'agent.text.completed'
    )
    const turn = result.events.find(
      (event) => event.type === 'turn.completed'
    )

    expect(result.status).toBe('completed')
    expect(completed?.payload).toMatchObject({
      text: refusal,
      safetyRefusal: true
    })
    expect(turn?.payload.safetyRefusal).toBe(true)
  })

  it('redacts API keys from thrown errors and every persisted event', async () => {
    const secret = 'sk-test-super-secret-key-123456789'
    const harness = await makeHarness(
      [
        {
          events: [metadata('response-secret')],
          throwAfterEvents: new Error(`Upstream rejected ${secret}`)
        }
      ],
      { secretsToRedact: [secret] }
    )
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Begin.'
    })
    const serialized = JSON.stringify({
      result,
      events: await persistedEvents(harness.store)
    })

    expect(result.status).toBe('failed')
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('[REDACTED]')
  })

  it('plays the complete deterministic encounter through the fake gateway', async () => {
    const harness = await makeHarness(
      [
        toolRound('response-room', [
          fakeFunctionCall(
            'call-room',
            'observe',
            '{"target":"room","modality":"visual"}'
          )
        ]),
        toolRound('response-thread', [
          fakeFunctionCall(
            'call-thread',
            'interact',
            `{"target":"${OBJECT_IDS.window}","action":"${INTERACT_ACTIONS.testWindowWithThread}"}`
          )
        ]),
        toolRound('response-touch', [
          fakeFunctionCall(
            'call-touch',
            'interact',
            `{"target":"${OBJECT_IDS.window}","action":"${INTERACT_ACTIONS.touchWindowWithRightHand}"}`
          )
        ]),
        toolRound('response-leave', [
          fakeFunctionCall(
            'call-leave',
            'move',
            '{"destination":"service_door"}'
          )
        ]),
        textRound('response-finished', 'I have crossed the threshold.')
      ],
      { limits: { maxToolCallsPerTurn: 10 } }
    )
    const result = await harness.loop.runTurn({
      state: harness.state,
      priorEvents: [],
      playerMessage: 'Inspect the room and proceed.'
    })

    expect(result.status).toBe('completed')
    expect(result.state.locationId).toBe(LOCATION_IDS.serviceCorridor)
    expect(result.state.status).toBe('completed')
    expect(harness.gateway.requests).toHaveLength(5)
  })

  it('reports missing live configuration without exposing environment values', () => {
    expect(() => readOpenAIResponsesConfiguration({})).toThrow(
      'OPENAI_API_KEY and OPENAI_MODEL'
    )
  })

  it('reads the legacy OpenAI configuration path by default', () => {
    expect(
      readOpenAIResponsesConfiguration({
        OPENAI_API_KEY: '  openai-secret  ',
        OPENAI_MODEL: '  gpt-example  '
      })
    ).toEqual({
      provider: 'openai',
      apiKey: 'openai-secret',
      model: 'gpt-example'
    })
  })

  it('configures the OpenAI SDK for OpenRouter Responses requests', () => {
    expect(
      readOpenAIResponsesConfiguration({
        INTRUSIVE_THOUGHTS_PROVIDER: 'openrouter',
        OPENROUTER_API_KEY: '  openrouter-secret  ',
        OPENROUTER_MODEL: '  provider/model  ',
        OPENROUTER_HTTP_REFERER: '  https://example.com/game  ',
        OPENROUTER_APP_TITLE: '  Intrusive Thoughts  '
      })
    ).toEqual({
      provider: 'openrouter',
      apiKey: 'openrouter-secret',
      model: 'provider/model',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://example.com/game',
        'X-OpenRouter-Title': 'Intrusive Thoughts'
      }
    })
  })

  it('infers OpenRouter when only OpenRouter configuration is present', () => {
    expect(
      readOpenAIResponsesConfiguration({
        OPENROUTER_API_KEY: 'openrouter-secret',
        OPENROUTER_MODEL: 'provider/model'
      })
    ).toMatchObject({
      provider: 'openrouter',
      apiKey: 'openrouter-secret',
      model: 'provider/model',
      baseURL: 'https://openrouter.ai/api/v1'
    })
  })

  it('reports the provider-specific OpenRouter variables when missing', () => {
    expect(() =>
      readOpenAIResponsesConfiguration({
        INTRUSIVE_THOUGHTS_PROVIDER: 'openrouter'
      })
    ).toThrow('OPENROUTER_API_KEY and OPENROUTER_MODEL')
  })

  it('rejects unknown live model providers', () => {
    expect(() =>
      readOpenAIResponsesConfiguration({
        INTRUSIVE_THOUGHTS_PROVIDER: 'unknown'
      })
    ).toThrow(
      'INTRUSIVE_THOUGHTS_PROVIDER must be either openai or openrouter'
    )
  })
})
