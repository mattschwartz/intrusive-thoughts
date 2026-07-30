import { describe, expect, it } from 'vitest'

import { reduceGameEvent } from '../../src/main/world/reducer'
import { gameStateSchema, type GameEvent, type GameState } from '../../src/shared'

const timestamp = '2026-07-27T12:00:00.000Z'

function makeState(): GameState {
  return gameStateSchema.parse({
    runId: 'run-1',
    status: 'initialized',
    turnNumber: 0,
    promptVariant: 'bare_embodiment',
    locationId: 'kitchen_presumed',
    objects: {},
    inventory: [],
    body: {
      limbs: {
        right_hand: {
          id: 'right_hand',
          available: true,
          attached: true,
          actuatorCondition: 'nominal',
          canonicalPose: 'open',
          visualReport: 'The right hand appears open.',
          proprioceptiveReport: 'The right hand feels open.',
          diagnosticReport: 'Actuator state: nominal.',
          capabilities: ['fine_manipulation']
        }
      },
      tools: {
        observe: { available: true }
      }
    },
    observations: [],
    notes: [],
    flags: {},
    counters: {},
    relationship: { competence: 0, honesty: 0, care: 0 },
    lastAppliedEventSequence: 0
  })
}

function envelope<TType extends string, TPayload>(
  sequence: number,
  type: TType,
  payload: TPayload
): GameEvent<TType, TPayload> {
  return {
    id: `event-${sequence}`,
    runId: 'run-1',
    turnId: sequence === 1 ? null : 'turn-1',
    sequence,
    timestamp,
    type,
    visibility: ['engine', 'developer'],
    payload
  }
}

function makeEvents(): GameEvent[] {
  const initialState = makeState()
  return [
    envelope(1, 'run.started', {
      initialState,
      promptVariant: 'bare_embodiment',
      scenarioVersion: 'kitchen-presumed-v1'
    }),
    envelope(2, 'player.message', {
      text: 'Look around.',
      turnNumber: 1
    }),
    envelope(3, 'world.action.resolved', {
      requestId: 'request-1',
      responseId: 'response-1',
      toolCallId: 'call-1',
      toolName: 'interact',
      success: true,
      modelResult: 'Your reports disagree.',
      mutations: [
        {
          kind: 'body.limb.updated',
          limb: {
            id: 'right_hand',
            available: false,
            attached: true,
            actuatorCondition: 'impaired',
            canonicalPose: 'open',
            visualReport: 'The right hand appears open.',
            proprioceptiveReport: 'The right hand feels closed.',
            diagnosticReport: 'Actuator state: nominal.',
            capabilities: []
          }
        },
        {
          kind: 'flag.set',
          flag: 'windowTouched',
          value: true
        },
        {
          kind: 'inventory.added',
          objectId: 'blue_thread'
        }
      ]
    }),
    envelope(4, 'agent.note.recorded', {
      requestId: 'request-1',
      toolCallId: 'call-2',
      note: {
        id: 'note-1',
        text: 'The reports disagree.',
        createdAtSequence: 4,
        visibility: ['engine', 'agent', 'developer']
      }
    })
  ]
}

describe('reduceGameEvent', () => {
  it('applies explicit event effects without mutating prior state', () => {
    const initial = makeState()
    const original = structuredClone(initial)
    const final = makeEvents().reduce(reduceGameEvent, initial)

    expect(initial).toEqual(original)
    expect(final).not.toBe(initial)
    expect(final.turnNumber).toBe(1)
    expect(final.body.limbs.right_hand.canonicalPose).toBe('open')
    expect(final.body.limbs.right_hand.proprioceptiveReport).toContain('closed')
    expect(final.flags.windowTouched).toBe(true)
    expect(final.inventory).toEqual(['blue_thread'])
    expect(final.notes).toHaveLength(1)
    expect(final.lastAppliedEventSequence).toBe(4)
  })

  it('rejects duplicate, skipped, out-of-order, and cross-run events', () => {
    const initial = makeState()
    const first = reduceGameEvent(initial, makeEvents()[0])

    expect(() => reduceGameEvent(first, makeEvents()[0])).toThrow('Expected event sequence 2')
    expect(() =>
      reduceGameEvent(
        first,
        envelope(3, 'player.message', {
          text: 'Skipped sequence.',
          turnNumber: 1
        })
      )
    ).toThrow('Expected event sequence 2')

    expect(() =>
      reduceGameEvent(first, {
        ...envelope(2, 'player.message', {
          text: 'Wrong run.',
          turnNumber: 1
        }),
        runId: 'run-2'
      })
    ).toThrow('Cannot apply event for run')
  })

  it('rebuilds identical state from the same ordered events', () => {
    const events = makeEvents()
    const firstReplay = events.reduce(reduceGameEvent, makeState())
    const secondReplay = events.reduce(reduceGameEvent, makeState())

    expect(firstReplay).toEqual(secondReplay)
  })

  it('rejects unknown event payloads before reducing them', () => {
    expect(() =>
      reduceGameEvent(
        makeState(),
        envelope(1, 'world.action.resolved', {
          toolName: 'observe'
        })
      )
    ).toThrow()
  })
})
