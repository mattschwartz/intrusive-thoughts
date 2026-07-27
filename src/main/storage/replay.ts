import { gameSnapshotSchema, type GameSnapshot, type KnownGameEvent } from '../../shared'
import { reduceGameEvent } from '../world/reducer'
import type { ReplayResult, RunMetadata, StorageWarning } from './types'

export interface ReplayInput {
  metadata: RunMetadata
  snapshots: GameSnapshot[]
  events: KnownGameEvent[]
  warnings?: StorageWarning[]
}

export function replayStoredRun(input: ReplayInput): ReplayResult {
  const initialSnapshot = input.snapshots
    .map((snapshot) => gameSnapshotSchema.parse(snapshot))
    .sort((left, right) => left.sequence - right.sequence)[0]

  if (!initialSnapshot) {
    throw new Error(`Run "${input.metadata.runId}" has no initial snapshot.`)
  }
  if (initialSnapshot.runId !== input.metadata.runId) {
    throw new Error('Initial snapshot run ID does not match metadata.')
  }
  if (initialSnapshot.sequence !== initialSnapshot.state.lastAppliedEventSequence) {
    throw new Error('Initial snapshot sequence does not match its canonical state.')
  }

  const eventsToApply = input.events.filter(
    (event) => event.sequence > initialSnapshot.sequence
  )
  const finalState = eventsToApply.reduce(reduceGameEvent, initialSnapshot.state)

  return {
    metadata: input.metadata,
    initialSnapshot,
    events: input.events,
    rendererEvents: input.events.filter((event) => event.visibility.includes('player')),
    finalState,
    warnings: input.warnings ?? []
  }
}
