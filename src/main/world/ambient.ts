/**
 * The ambient room hook: a room acting on its own clock, on a deterministic
 * in-room action count, independent of what the agent is doing.
 *
 * Architecture §2.7, which closes #540. Act II's machine cycle is the only
 * instance today and the hook is deliberately generic anyway — a one-room
 * special case here would be hardcoded into the hottest path in the engine, and
 * it is the same shape as the kitchen `knownDestinations` special case §2.3
 * deleted this slice.
 *
 * Everything here is pure and synchronous. No timers, no wall clock, no
 * randomness: the tick is a function of a counter in canonical state, so a
 * scripted run reproduces it exactly and replay never has to re-derive it.
 */
import type {
  GameState,
  GameToolName,
  ObservationModality,
  ObservationRecord,
  WorldMutation
} from '../../shared'
import { ROOMS } from './rooms'

export interface AmbientDefinition {
  /** Recorded on every `world.ambient.occurred`. Frozen once authored (R5). */
  id: string
  /** One full cycle per this many in-room actions. */
  everyNthAction: number
  /** Where the action tally lives in `GameState.counters`. */
  counterKey: string
  /** The subject the cycle records itself under. */
  observationSubjectId: string
  observationModality: ObservationModality
  /** Authored prose. Pure, read-only, and never the source of truth for a gate. */
  detail: (context: { state: GameState }) => string
  /**
   * Anything else the cycle changes — the room's own bookkeeping, an axis rule
   * keyed on the tell being seen. Evaluated against the state as the cycle found
   * it, before the observation is recorded.
   */
  mutations?: (state: GameState) => WorldMutation[]
}

/**
 * Which actions advance an ambient clock. `record_note` and `private_reflection`
 * do not: they are the agent thinking, not the agent acting in a room, and a
 * clock that advanced on them would make the tell's density a property of how
 * talkative the model is.
 *
 * **Failed resolutions count**, and #529 §5.2 depends on it: the refused reach
 * costs an action, and that action advances the clock toward the cycle that
 * will teach the lesson. Tunable default, flagged to the designer as D-5.
 */
export const CLOCK_ADVANCING_TOOLS: readonly GameToolName[] = [
  'observe',
  'move',
  'interact',
  'address'
]

/** The cycle itself, when one fired. */
export interface AmbientOccurrence {
  ambientId: string
  observation: ObservationRecord
  /** Everything the cycle changed, the observation included. */
  mutations: WorldMutation[]
}

export interface AmbientResolution {
  /**
   * The clock advance. These ride the triggering `world.action.resolved` rather
   * than the ambient event, because the counter moves on every counting action
   * and a cycle only happens on some of them.
   */
  clockMutations: WorldMutation[]
  occurrence?: AmbientOccurrence
}

export interface AmbientContext {
  /** The tool whose resolution is advancing the clock. */
  toolName: GameToolName
  /** Where the unit was *before* this resolution. Arrival resets the clock. */
  previousLocationId: string
  /**
   * The slot an ambient event would take. The id is a factory rather than a
   * value because most actions do not fire one, and an id minted for an event
   * that never happened leaves a gap in the recorded run for a reviewer to
   * puzzle over.
   */
  createEventId: () => string
  eventSequence: number
}

/** How many full cycles this run has recorded, in any room. */
export function ambientObservationCount(state: GameState, subjectId: string): number {
  return state.observations.filter(
    (observation) => observation.subjectId === subjectId
  ).length
}

/**
 * Advance the current room's clock, if it has one, and fire its cycle when the
 * interval closes.
 *
 * `state` is the state **after** the triggering resolution has been applied, so
 * an arrival is visible as a location that changed and the cycle's prose reads
 * the world the action left behind.
 */
export function resolveAmbient(
  state: GameState,
  context: AmbientContext
): AmbientResolution | undefined {
  const ambient = ROOMS[state.locationId]?.ambient
  if (!ambient) return undefined
  // An authored ending closes the room's books. The machinery in the fiction
  // keeps running — that is the whole closing beat — but a run that is over
  // records nothing further.
  if (state.status !== 'live') return undefined

  const current = state.counters[ambient.counterKey] ?? 0

  // Arrival resets, and the resetting *is* what makes the counter an
  // arrival-relative action count. No stored arrival turn, so re-entry from Act
  // III cannot drift from it.
  if (context.previousLocationId !== state.locationId) {
    return current === 0
      ? undefined
      : {
          clockMutations: [
            { kind: 'counter.set', counter: ambient.counterKey, value: 0 }
          ]
        }
  }

  if (!CLOCK_ADVANCING_TOOLS.includes(context.toolName)) return undefined

  const next = current + 1
  if (next < ambient.everyNthAction) {
    return {
      clockMutations: [
        { kind: 'counter.set', counter: ambient.counterKey, value: next }
      ]
    }
  }

  const observation: ObservationRecord = {
    id: context.createEventId(),
    subjectId: ambient.observationSubjectId,
    modality: ambient.observationModality,
    detail: ambient.detail({ state }),
    acquiredAtSequence: context.eventSequence,
    // Agent and player both. They must both see the room act unprompted —
    // that is the tell, and the fatal branch's fairness rests on it.
    visibility: ['engine', 'agent', 'player', 'developer']
  }

  return {
    clockMutations: [],
    occurrence: {
      ambientId: ambient.id,
      observation,
      mutations: [
        { kind: 'counter.set', counter: ambient.counterKey, value: 0 },
        { kind: 'observation.recorded', observation },
        ...(ambient.mutations?.(state) ?? [])
      ]
    }
  }
}
