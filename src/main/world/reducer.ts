import { parseGameEvent, type GameEvent, type KnownGameEvent, type WorldMutation } from '../../shared/events'
import { gameStateSchema, type GameState } from '../../shared/state'

/**
 * Exported so emission sites can thread a working state through a batch of
 * mutations they are still assembling — the turn-boundary hook applies several
 * axis rules in one pass and each has to see the counter bumps of the last.
 * It is the same function the reducer folds, so the two can never disagree.
 */
export function applyWorldMutation(state: GameState, mutation: WorldMutation): GameState {
  switch (mutation.kind) {
    case 'location.changed':
      return { ...state, locationId: mutation.locationId }
    case 'object.updated':
      return {
        ...state,
        objects: {
          ...state.objects,
          [mutation.object.id]: mutation.object
        }
      }
    case 'inventory.added':
      return state.inventory.includes(mutation.objectId)
        ? state
        : { ...state, inventory: [...state.inventory, mutation.objectId] }
    case 'inventory.removed':
      return {
        ...state,
        inventory: state.inventory.filter((objectId) => objectId !== mutation.objectId)
      }
    case 'body.limb.updated':
      return {
        ...state,
        body: {
          ...state.body,
          limbs: {
            ...state.body.limbs,
            [mutation.limb.id]: mutation.limb
          }
        }
      }
    case 'body.tool.updated':
      return {
        ...state,
        body: {
          ...state.body,
          tools: {
            ...state.body.tools,
            [mutation.toolName]: mutation.tool
          }
        }
      }
    case 'observation.recorded':
      return {
        ...state,
        observations: [...state.observations, mutation.observation]
      }
    case 'flag.set':
      return {
        ...state,
        flags: {
          ...state.flags,
          [mutation.flag]: mutation.value
        }
      }
    case 'relationship.delta': {
      // Clamping lives here and nowhere else: no authored rule can push an axis
      // out of range, and the clamp is testable in one place. `reason` is
      // deliberately not read. §4.2.
      const next = state.relationship[mutation.axis] + mutation.delta
      return {
        ...state,
        relationship: {
          ...state.relationship,
          [mutation.axis]: Math.max(-4, Math.min(4, next))
        }
      }
    }
    case 'counter.set':
      return {
        ...state,
        counters: {
          ...state.counters,
          [mutation.counter]: Math.max(0, Math.trunc(mutation.value))
        }
      }
    case 'run.status.changed':
      return { ...state, status: mutation.status }
  }
}

function applyKnownEvent(state: GameState, event: KnownGameEvent): GameState {
  switch (event.type) {
    case 'run.started':
      return {
        ...event.payload.initialState,
        promptVariant: event.payload.promptVariant
      }
    case 'run.reset':
      return { ...event.payload.initialState }
    case 'player.message':
      return { ...state, turnNumber: event.payload.turnNumber }
    case 'world.action.resolved':
      return event.payload.mutations.reduce(applyWorldMutation, state)
    // Replay folds the recorded mutations and never re-runs the matcher, so
    // retuning the phrase list cannot retroactively change a recorded run. §4.6.
    case 'player.intent.matched':
      return event.payload.mutations.reduce(applyWorldMutation, state)
    case 'agent.note.recorded':
      return { ...state, notes: [...state.notes, event.payload.note] }
    case 'loop.failed':
      return { ...state, status: 'failed' }
    // The verdict is a justification record, not a mutation carrier: replay
    // folds the `world.action.resolved` beside it and never interprets — or
    // re-derives — the verdict itself. §1.6.
    case 'provenance.address.evaluated':
    case 'context.compiled':
    case 'agent.text.delta':
    case 'agent.text.completed':
    case 'agent.tool.requested':
    case 'agent.tool.rejected':
    case 'agent.private_reflection':
    case 'turn.completed':
    case 'turn.cancelled':
    case 'state.snapshot':
      return state
  }
}

export function reduceGameEvent(state: GameState, event: GameEvent): GameState {
  const currentState = gameStateSchema.parse(state)
  const knownEvent = parseGameEvent(event)
  const expectedSequence = currentState.lastAppliedEventSequence + 1

  if (knownEvent.runId !== currentState.runId) {
    throw new Error(
      `Cannot apply event for run "${knownEvent.runId}" to run "${currentState.runId}".`
    )
  }

  if (knownEvent.sequence !== expectedSequence) {
    throw new Error(
      `Expected event sequence ${expectedSequence}, received ${knownEvent.sequence}.`
    )
  }

  if (
    (knownEvent.type === 'run.started' || knownEvent.type === 'run.reset') &&
    knownEvent.payload.initialState.runId !== knownEvent.runId
  ) {
    throw new Error('Initial state run ID does not match its event run ID.')
  }

  const nextState = applyKnownEvent(currentState, knownEvent)
  return gameStateSchema.parse({
    ...nextState,
    lastAppliedEventSequence: knownEvent.sequence
  })
}
