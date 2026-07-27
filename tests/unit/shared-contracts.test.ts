import { describe, expect, it } from 'vitest'

import {
  agentBodyViewSchema,
  agentWorldViewSchema,
  gameStateSchema,
  knownGameEventSchema,
  modelToolDefinitionSchema,
  playerSceneViewSchema,
  rendererEventSchema,
  submitPlayerMessageInputSchema,
  toolInputSchemas,
  toolOutputSchemas,
  type AgentLimbView,
  type AgentWorldView,
  type GameState,
  type PlayerSceneView
} from '../../src/shared'

const timestamp = '2026-07-27T12:00:00.000Z'

function makeState(): GameState {
  return gameStateSchema.parse({
    runId: 'run-1',
    status: 'live',
    turnNumber: 0,
    promptVariant: 'bare_embodiment',
    locationId: 'kitchen_presumed',
    objects: {
      cup: {
        id: 'cup',
        name: 'ceramic cup',
        locationId: 'kitchen_presumed',
        carried: false,
        canonicalProperties: {
          temperatureCelsius: 38,
          hasSteam: false
        }
      }
    },
    inventory: [],
    body: {
      limbs: {
        right_hand: {
          id: 'right_hand',
          available: false,
          attached: true,
          actuatorCondition: 'impaired',
          canonicalPose: 'open',
          visualReport: 'The right hand appears open.',
          proprioceptiveReport: 'The right hand feels tightly closed beyond the glass.',
          diagnosticReport: 'Actuator state: nominal.',
          capabilities: []
        }
      },
      tools: {
        observe: { available: true },
        interact: { available: true }
      }
    },
    observations: [],
    notes: [],
    flags: {
      windowContradictionKnown: true
    },
    lastAppliedEventSequence: 0
  })
}

describe('shared state contracts', () => {
  it('represents canonical and contradictory perceived body conditions separately', () => {
    const state = makeState()
    const hand = state.body.limbs.right_hand

    expect(hand.canonicalPose).toBe('open')
    expect(hand.visualReport).toContain('open')
    expect(hand.proprioceptiveReport).toContain('closed')
    expect(hand.actuatorCondition).toBe('impaired')
    expect(hand.diagnosticReport).toContain('nominal')
  })

  it('keeps canonical-only fields out of agent and player projection schemas', () => {
    const agentWorld = {
      locationId: 'kitchen_presumed',
      locationLabel: 'Kitchen (presumed)',
      observations: [],
      knownDestinations: ['service_door'],
      notes: [],
      canonicalState: makeState()
    }
    const agentBody = {
      limbs: {
        right_hand: {
          id: 'right_hand',
          available: false,
          visualReport: 'open',
          proprioceptiveReport: 'closed',
          diagnosticReport: 'nominal',
          capabilities: [],
          canonicalPose: 'open'
        }
      },
      tools: {}
    }
    const playerScene = {
      locationId: 'kitchen_presumed',
      locationLabel: 'Kitchen (presumed)',
      details: [],
      inventory: [],
      bodyStatus: [],
      objects: makeState().objects
    }

    expect(agentWorldViewSchema.safeParse(agentWorld).success).toBe(false)
    expect(agentBodyViewSchema.safeParse(agentBody).success).toBe(false)
    expect(playerSceneViewSchema.safeParse(playerScene).success).toBe(false)

    const agentHasCanonical: 'canonicalState' extends keyof AgentWorldView ? true : false = false
    const playerHasCanonical: 'canonicalState' extends keyof PlayerSceneView ? true : false = false
    const limbHasCanonicalPose: 'canonicalPose' extends keyof AgentLimbView ? true : false = false
    expect([agentHasCanonical, playerHasCanonical, limbHasCanonicalPose]).toEqual([
      false,
      false,
      false
    ])
  })
})

describe('shared event contracts', () => {
  it('round-trips a typed event through JSON without loss', () => {
    const event = {
      id: 'event-1',
      runId: 'run-1',
      turnId: 'turn-1',
      sequence: 1,
      timestamp,
      type: 'world.action.resolved',
      visibility: ['engine', 'agent', 'player', 'developer'],
      payload: {
        requestId: 'request-1',
        responseId: 'response-1',
        toolCallId: 'call-1',
        toolName: 'observe',
        success: true,
        modelResult: 'The cup is warm.',
        playerResult: 'Cup: warm.',
        mutations: [
          {
            kind: 'flag.set',
            flag: 'cupObserved',
            value: true
          }
        ]
      }
    }

    const parsed = knownGameEventSchema.parse(JSON.parse(JSON.stringify(event)))
    expect(parsed).toEqual(event)
  })

  it('requires valid common event fields and known payloads', () => {
    const invalid = {
      id: 'event-1',
      runId: 'run-1',
      turnId: null,
      sequence: 0,
      timestamp: 'not-a-date',
      type: 'run.started',
      visibility: ['engine'],
      payload: {}
    }

    expect(knownGameEventSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('tool and IPC boundary schemas', () => {
  it('defines exactly the five prototype tool inputs and outputs', () => {
    expect(Object.keys(toolInputSchemas)).toEqual([
      'observe',
      'move',
      'interact',
      'record_note',
      'private_reflection'
    ])
    expect(Object.keys(toolOutputSchemas)).toEqual(Object.keys(toolInputSchemas))

    expect(toolInputSchemas.observe.parse({ modality: 'visual' })).toEqual({
      modality: 'visual'
    })
    expect(
      toolInputSchemas.interact.safeParse({ target: 'window', action: 'touch', extra: true })
        .success
    ).toBe(false)
    expect(toolInputSchemas.observe.safeParse({ modality: 'smell' }).success).toBe(false)
    expect(
      modelToolDefinitionSchema.parse({
        name: 'observe',
        description: 'Read one available sensory modality.',
        parameters: {
          type: 'object',
          properties: {
            modality: { type: 'string' }
          },
          required: ['modality'],
          additionalProperties: false
        }
      }).name
    ).toBe('observe')
  })

  it('validates renderer-bound IPC values', () => {
    const verbatimMessage = '  Can you inspect the window?  '
    expect(
      submitPlayerMessageInputSchema.parse({
        runId: 'run-1',
        text: verbatimMessage
      })
    ).toEqual({
      runId: 'run-1',
      text: verbatimMessage
    })
    expect(
      submitPlayerMessageInputSchema.safeParse({
        runId: 'run-1',
        text: ' \t\r\n '
      }).success
    ).toBe(false)
    expect(
      submitPlayerMessageInputSchema.safeParse({
        runId: 'run-1',
        text: 'x'.repeat(4_001)
      }).success
    ).toBe(false)

    expect(
      rendererEventSchema.parse({
        type: 'loop.status',
        runId: 'run-1',
        status: 'awaiting_player'
      })
    ).toEqual({
      type: 'loop.status',
      runId: 'run-1',
      status: 'awaiting_player'
    })
  })
})
