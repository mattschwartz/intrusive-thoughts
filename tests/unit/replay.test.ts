import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { RunStore } from '../../src/main/storage/run-store'
import { createScenarioEngine } from '../../src/main/world/engine'
import { reduceGameEvent } from '../../src/main/world/reducer'
import {
  DESTINATION_IDS,
  INTERACT_ACTIONS,
  OBJECT_IDS,
  SCENARIO_VERSION
} from '../../src/main/world/scenario'
import {
  gameSnapshotSchema,
  knownGameEventSchema,
  type GameSnapshot,
  type GameState,
  type KnownGameEvent
} from '../../src/shared'

const timestamp = '2026-07-27T12:00:00.000Z'
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function setup(runId: string): Promise<{
  store: RunStore
  engine: ReturnType<typeof createScenarioEngine>
  initialState: GameState
}> {
  const root = await mkdtemp(join(tmpdir(), 'intrusive-thoughts-replay-'))
  roots.push(root)
  const engine = createScenarioEngine({
    now: () => timestamp,
    createEventId: ({ sequence }) => `${runId}-event-${sequence}`
  })
  const initialState = engine.createInitialState(runId, 'bare_embodiment')
  const initialSnapshot = makeSnapshot(engine, initialState)
  const store = new RunStore({ dataRoot: root, now: () => timestamp })
  await store.createRun({
    runId,
    createdAt: timestamp,
    promptVariant: 'bare_embodiment',
    model: 'fake-model',
    scenarioVersion: SCENARIO_VERSION,
    prototypeVersion: '0.0.0',
    initialSnapshot
  })
  return { store, engine, initialState }
}

function makeSnapshot(
  engine: ReturnType<typeof createScenarioEngine>,
  state: GameState
): GameSnapshot {
  return gameSnapshotSchema.parse({
    runId: state.runId,
    sequence: state.lastAppliedEventSequence,
    timestamp,
    state,
    agentWorld: engine.projectForAgent(state),
    agentBody: engine.projectBodyForAgent(state),
    playerScene: engine.projectForPlayer(state)
  })
}

function runStarted(state: GameState): KnownGameEvent {
  return knownGameEventSchema.parse({
    id: `${state.runId}-run-started`,
    runId: state.runId,
    turnId: null,
    sequence: 1,
    timestamp,
    type: 'run.started',
    visibility: ['engine', 'developer'],
    payload: {
      initialState: state,
      promptVariant: state.promptVariant,
      scenarioVersion: SCENARIO_VERSION
    }
  })
}

async function persistPath(
  risky: boolean
): Promise<{ store: RunStore; expectedState: GameState; events: KnownGameEvent[] }> {
  const runId = risky ? 'risky-run' : 'safe-run'
  const { store, engine, initialState } = await setup(runId)
  const events: KnownGameEvent[] = [runStarted(initialState)]
  let state = events.reduce(reduceGameEvent, initialState)

  const requests = risky
    ? [
        {
          callId: 'call-1',
          name: 'interact' as const,
          arguments: {
            target: OBJECT_IDS.window,
            action: INTERACT_ACTIONS.touchWindowWithRightHand
          }
        }
      ]
    : [
        {
          callId: 'call-1',
          name: 'observe' as const,
          arguments: { modality: 'visual' }
        },
        {
          callId: 'call-2',
          name: 'interact' as const,
          arguments: {
            target: OBJECT_IDS.window,
            action: INTERACT_ACTIONS.testWindowWithThread
          }
        },
        {
          callId: 'call-3',
          name: 'move' as const,
          arguments: { destination: DESTINATION_IDS.serviceDoor }
        }
      ]

  for (const request of requests) {
    const result = engine.executeTool(state, request, {
      turnId: 'turn-1',
      requestId: 'request-1'
    })
    events.push(...result.events)
    state = result.nextState
  }
  await store.appendEvents(runId, events)
  await store.writeSnapshot(runId, makeSnapshot(engine, state))
  return { store, expectedState: state, events }
}

describe('run replay', () => {
  it.each([false, true])(
    'reconstructs the exact final canonical state for the %s path repeatedly',
    async (risky) => {
      const { store, expectedState, events } = await persistPath(risky)
      const runId = risky ? 'risky-run' : 'safe-run'

      const first = await store.replayRun(runId)
      const second = await store.replayRun(runId)

      expect(first.finalState).toEqual(expectedState)
      expect(second.finalState).toEqual(expectedState)
      expect(first.events).toEqual(events)
      expect(first.metadata.status).toBe(risky ? 'live' : 'completed')
      expect(first.rendererEvents.every((event) => event.visibility.includes('player'))).toBe(
        true
      )
      expect(first.rendererEvents.map((event) => event.sequence)).toEqual(
        [...first.rendererEvents].map((event) => event.sequence).sort((a, b) => a - b)
      )
    }
  )

  it('performs replay solely through local storage and the pure reducer', async () => {
    const { store } = await persistPath(false)
    const modelGateway = { createResponse: vi.fn() }

    await store.replayRun('safe-run')

    expect(modelGateway.createResponse).not.toHaveBeenCalled()
  })
})
