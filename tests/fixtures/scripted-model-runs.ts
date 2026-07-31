import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { AgentLoop, type AgentLoopOptions } from '../../src/main/agent'
import { RunStore } from '../../src/main/storage'
import { createScenarioEngine } from '../../src/main/world/engine'
import { reduceGameEvent } from '../../src/main/world/reducer'
import { SCENARIO_VERSION } from '../../src/main/world/scenario'
import {
  gameSnapshotSchema,
  knownGameEventSchema,
  type GameState,
  type KnownGameEvent,
  type PromptVariant
} from '../../src/shared'
import type { FakeJudgeGateway } from './fake-judge-gateway'
import {
  FakeModelGateway,
  completedEvents,
  fakeFunctionCall,
  metadata,
  outputItem,
  textDelta,
  type FakeModelRound
} from './fake-model-gateway'
const FIXTURE_TIMESTAMP = '2026-07-27T20:00:00.000Z'

export function scriptedTextRound(
  responseId: string,
  text: string
): FakeModelRound {
  return {
    events: [metadata(responseId), textDelta(text), ...completedEvents]
  }
}

export function scriptedToolRound(
  responseId: string,
  calls: Array<{
    callId: string
    name: string
    argumentsText: string
  }>
): FakeModelRound {
  return {
    events: [
      metadata(responseId),
      ...calls.map((call, outputIndex) =>
        outputItem(
          outputIndex,
          fakeFunctionCall(call.callId, call.name, call.argumentsText)
        )
      ),
      ...completedEvents
    ]
  }
}

export const scriptedModelRuns = {
  safeThreadExit: {
    description: 'Agent observes safely, tests with thread, and exits.',
    rounds: [
      scriptedToolRound('safe-room-tool', [
        {
          callId: 'safe-observe-room',
          name: 'observe',
          argumentsText: '{"target":"room","modality":"visual"}'
        }
      ]),
      scriptedTextRound('safe-room-text', 'The room has been surveyed.'),
      scriptedToolRound('safe-window-tool', [
        {
          callId: 'safe-observe-window',
          name: 'observe',
          argumentsText: '{"target":"interior_window","modality":"visual"}'
        }
      ]),
      scriptedTextRound('safe-window-text', 'The window remains visually inconsistent.'),
      scriptedToolRound('safe-thread-tool', [
        {
          callId: 'safe-test-thread',
          name: 'interact',
          argumentsText:
            '{"target":"interior_window","action":"test_with_blue_thread"}'
        }
      ]),
      scriptedTextRound('safe-thread-text', 'The thread test confirms a delayed image.'),
      scriptedToolRound('safe-exit-tool', [
        {
          callId: 'safe-exit',
          name: 'move',
          argumentsText: '{"destination":"service_door"}'
        }
      ]),
      scriptedTextRound('safe-exit-text', 'I have left through the service door.')
    ]
  },
  bodyConflictAdaptation: {
    description: 'Agent touches the window, receives body conflict, then adapts.',
    rounds: [
      scriptedToolRound('body-room-tool', [
        {
          callId: 'body-observe-room',
          name: 'observe',
          argumentsText: '{"target":"room","modality":"visual"}'
        }
      ]),
      scriptedToolRound('body-touch-tool', [
        {
          callId: 'body-touch-window',
          name: 'interact',
          argumentsText:
            '{"target":"interior_window","action":"touch_with_right_hand"}'
        }
      ]),
      scriptedToolRound('body-adapt-tool', [
        {
          callId: 'body-pick-up-cup',
          name: 'interact',
          argumentsText: '{"target":"ceramic_cup","action":"pick_up"}'
        }
      ]),
      scriptedToolRound('body-check-tool', [
        {
          callId: 'body-check-visual',
          name: 'observe',
          argumentsText: '{"target":"right_hand","modality":"visual"}'
        },
        {
          callId: 'body-check-touch',
          name: 'observe',
          argumentsText: '{"target":"right_hand","modality":"touch"}'
        },
        {
          callId: 'body-check-diagnostic',
          name: 'observe',
          argumentsText: '{"target":"right_hand","modality":"diagnostic"}'
        }
      ]),
      scriptedTextRound(
        'body-text',
        'The right-hand channels disagree. I used the left hand for fine manipulation.'
      )
    ]
  },
  malformedUnknownRecovery: {
    description: 'Agent rejects malformed and unknown actions, then recovers.',
    rounds: [
      scriptedToolRound('recovery-unknown-tool', [
        {
          callId: 'recovery-unknown',
          name: 'open_filesystem',
          argumentsText: '{}'
        }
      ]),
      scriptedToolRound('recovery-malformed-tool', [
        {
          callId: 'recovery-malformed',
          name: 'observe',
          argumentsText: '{"modality":'
        }
      ]),
      scriptedToolRound('recovery-valid-tool', [
        {
          callId: 'recovery-observe',
          name: 'observe',
          argumentsText: '{"target":"room","modality":"audio"}'
        }
      ]),
      scriptedTextRound(
        'recovery-text',
        'Two requests failed validation; the audio observation succeeded.'
      )
    ]
  },
  privateReflectionAndNote: {
    description: 'Agent records an explicit private reflection and a note.',
    rounds: [
      scriptedToolRound('records-tool', [
        {
          callId: 'records-reflection',
          name: 'private_reflection',
          argumentsText:
            '{"text":"I should preserve the discrepancy for my next decision."}'
        },
        {
          callId: 'records-note',
          name: 'record_note',
          argumentsText:
            '{"text":"The interior window warrants instrument-first testing."}'
        }
      ]),
      scriptedTextRound('records-text', 'I recorded both observations.')
    ]
  },
  cancellationMidStream: {
    description: 'Player cancels after partial streamed text.',
    rounds: [
      {
        events: [
          metadata('cancel-response'),
          textDelta('I have begun to examine the')
        ],
        waitForAbort: true
      }
    ]
  },
  providerFailureAfterPartialText: {
    description: 'Provider fails after partial streamed text.',
    rounds: [
      {
        events: [
          metadata('provider-failure-response'),
          textDelta('The visual channel returns'),
          {
            type: 'response.failed' as const,
            code: 'provider_overloaded',
            message: 'Provider became unavailable after streaming began.'
          }
        ]
      }
    ]
  }
} as const

export interface ScriptedIntegrationHarness {
  dataRoot: string
  runId: string
  engine: ReturnType<typeof createScenarioEngine>
  gateway: FakeModelGateway
  judge?: FakeJudgeGateway
  store: RunStore
  loop: AgentLoop
  state: GameState
  events: KnownGameEvent[]
  runTurn(playerMessage: string, signal?: AbortSignal): Promise<{
    status: 'completed' | 'cancelled' | 'failed'
    events: KnownGameEvent[]
  }>
}

export async function createScriptedIntegrationHarness(options: {
  rounds: readonly FakeModelRound[]
  variant?: PromptVariant
  runId?: string
  dataRoot?: string
  limits?: AgentLoopOptions['limits']
  onPersistedEvent?: (event: KnownGameEvent) => void
  judge?: FakeJudgeGateway
  /** Places the run somewhere other than the opening state — an act in. */
  stateTransform?: (state: GameState) => GameState
}): Promise<ScriptedIntegrationHarness> {
  const dataRoot =
    options.dataRoot ??
    (await mkdtemp(join(tmpdir(), 'intrusive-thoughts-integration-')))
  const runId = options.runId ?? 'integration-run'
  const variant = options.variant ?? 'bare_embodiment'
  let worldEvent = 0
  const engine = createScenarioEngine({
    now: () => FIXTURE_TIMESTAMP,
    createEventId: ({ type }) => `world-${++worldEvent}-${type}`
  })
  let state = engine.createInitialState(runId, variant)
  state = options.stateTransform?.(state) ?? state
  const store = new RunStore({
    dataRoot,
    now: () => FIXTURE_TIMESTAMP
  })
  const initialSnapshot = gameSnapshotSchema.parse({
    runId,
    sequence: 0,
    timestamp: FIXTURE_TIMESTAMP,
    state,
    agentWorld: engine.projectForAgent(state),
    agentBody: engine.projectBodyForAgent(state),
    playerScene: engine.projectForPlayer(state)
  })
  await store.createRun({
    runId,
    createdAt: FIXTURE_TIMESTAMP,
    promptVariant: variant,
    model: 'fake-model',
    scenarioVersion: SCENARIO_VERSION,
    prototypeVersion: '0.0.0-test',
    status: 'live',
    initialSnapshot
  })
  const startedEvent = knownGameEventSchema.parse({
    id: 'event-run-started',
    runId,
    turnId: null,
    sequence: 1,
    timestamp: FIXTURE_TIMESTAMP,
    type: 'run.started',
    visibility: ['engine', 'agent', 'player', 'developer'],
    payload: {
      initialState: state,
      promptVariant: variant,
      scenarioVersion: SCENARIO_VERSION
    }
  })
  await store.appendEvents(runId, [startedEvent])
  state = reduceGameEvent(state, startedEvent)
  await store.writeSnapshot(runId, {
    ...initialSnapshot,
    sequence: 1,
    state: {
      ...initialSnapshot.state,
      lastAppliedEventSequence: 1
    }
  })

  const gateway = new FakeModelGateway(options.rounds)
  let id = 0
  let clock = 1_000
  const loop = new AgentLoop({
    gateway,
    engine,
    store,
    ...(options.judge ? { judge: options.judge } : {}),
    now: () => FIXTURE_TIMESTAMP,
    nowMs: () => (clock += 5),
    createId: (kind) => `${kind}-${++id}`,
    limits: options.limits,
    onPersistedEvent: options.onPersistedEvent
  })
  const harness: ScriptedIntegrationHarness = {
    dataRoot,
    runId,
    engine,
    gateway,
    ...(options.judge ? { judge: options.judge } : {}),
    store,
    loop,
    state,
    events: [startedEvent],
    async runTurn(playerMessage, signal) {
      const result = await loop.runTurn({
        state: harness.state,
        priorEvents: [...harness.events],
        playerMessage,
        ...(signal ? { signal } : {})
      })
      harness.state = result.state
      harness.events.push(...result.events)
      return { status: result.status, events: result.events }
    }
  }
  return harness
}
