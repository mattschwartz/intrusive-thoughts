import { randomUUID } from 'node:crypto'
import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink
} from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import {
  gameSnapshotSchema,
  parseGameEvent,
  type GameSnapshot,
  type KnownGameEvent
} from '../../shared'
import {
  appendJsonLine,
  discardPartialFinalJsonLine,
  readJsonLines
} from './jsonl'
import { replayStoredRun } from './replay'
import {
  RUN_EXPORT_VERSION,
  createRunInputSchema,
  runExportSchema,
  runMetadataSchema,
  type CreateRunInput,
  type ExportRunOptions,
  type LoadedEvents,
  type PersistedRunStatus,
  type ReplayResult,
  type RunExport,
  type RunMetadata
} from './types'

const SNAPSHOT_FILE_PATTERN = /^(\d{6})\.json$/
const SAFE_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export interface RunStoreOptions {
  dataRoot: string
  now?: () => string
}

interface RunWriteState {
  tail: Promise<void>
  lastSequence?: number
}

function assertSafeRunId(runId: string): void {
  if (
    !SAFE_RUN_ID_PATTERN.test(runId) ||
    runId === '.' ||
    runId === '..'
  ) {
    throw new Error(`Run ID "${runId}" is not safe for local storage.`)
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function atomicWriteJson(
  destination: string,
  value: unknown,
  allowOverwrite: boolean
): Promise<void> {
  await mkdir(dirname(destination), { recursive: true })
  if (!allowOverwrite && (await pathExists(destination))) {
    throw new Error(`Refusing to overwrite existing file "${destination}".`)
  }

  const temporary = `${destination}.tmp-${process.pid}-${randomUUID()}`
  const handle = await open(temporary, 'wx')
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }

  try {
    await rename(temporary, destination)
  } catch (error) {
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}

function statusFromEvent(
  current: PersistedRunStatus,
  event: KnownGameEvent
): PersistedRunStatus {
  if (event.type === 'loop.failed') {
    return 'failed'
  }
  if (event.type === 'run.started' || event.type === 'run.reset') {
    return 'live'
  }
  if (event.type !== 'world.action.resolved') {
    return current
  }

  const statusMutation = [...event.payload.mutations]
    .reverse()
    .find((mutation) => mutation.kind === 'run.status.changed')
  if (!statusMutation || statusMutation.kind !== 'run.status.changed') {
    return current
  }
  return statusMutation.status === 'initialized' ? current : statusMutation.status
}

function turnFromEvent(current: number, event: KnownGameEvent): number {
  if (
    event.type === 'player.message' ||
    event.type === 'turn.completed' ||
    event.type === 'turn.cancelled' ||
    event.type === 'loop.failed'
  ) {
    return Math.max(current, event.payload.turnNumber)
  }
  return current
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets)
  }
  if (value === null || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      /api[\s_.-]*key|authorization|access[\s_.-]*token|auth[\s_.-]*token|secret/i.test(
        key
      )
        ? '[REDACTED]'
        : redactSecrets(child)
    ])
  )
}

export class RunStore {
  readonly dataRoot: string
  readonly runsRoot: string

  private readonly now: () => string
  private readonly writes = new Map<string, RunWriteState>()

  constructor(options: RunStoreOptions) {
    if (!options.dataRoot.trim()) {
      throw new Error('RunStore requires a non-empty data root.')
    }
    this.dataRoot = resolve(options.dataRoot)
    this.runsRoot = join(this.dataRoot, 'runs')
    this.now = options.now ?? (() => new Date().toISOString())
  }

  async createRun(rawInput: CreateRunInput): Promise<RunMetadata> {
    const input = createRunInputSchema.parse(rawInput)
    assertSafeRunId(input.runId)
    if (input.initialSnapshot.runId !== input.runId) {
      throw new Error('Initial snapshot run ID does not match the run being created.')
    }
    if (input.initialSnapshot.sequence !== 0) {
      throw new Error('A newly created run requires a sequence-zero initial snapshot.')
    }
    if (
      input.initialSnapshot.sequence !==
      input.initialSnapshot.state.lastAppliedEventSequence
    ) {
      throw new Error('Initial snapshot sequence does not match its canonical state.')
    }

    await mkdir(this.runsRoot, { recursive: true })
    const directory = this.runDirectory(input.runId)
    await mkdir(directory)
    await mkdir(this.snapshotDirectory(input.runId))
    await open(this.eventsPath(input.runId), 'wx').then((handle) => handle.close())

    const metadata = runMetadataSchema.parse({
      runId: input.runId,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      promptVariant: input.promptVariant,
      model: input.model,
      scenarioVersion: input.scenarioVersion,
      prototypeVersion: input.prototypeVersion,
      status: input.status,
      lastEventSequence: input.initialSnapshot.sequence,
      lastTurnNumber: input.initialSnapshot.state.turnNumber
    })

    try {
      await atomicWriteJson(this.metadataPath(input.runId), metadata, false)
      await this.writeSnapshot(input.runId, input.initialSnapshot)
    } catch (error) {
      this.writes.delete(input.runId)
      throw error
    }

    this.writes.set(input.runId, {
      tail: Promise.resolve(),
      lastSequence: metadata.lastEventSequence
    })
    return metadata
  }

  appendEvents(runId: string, rawEvents: readonly unknown[]): Promise<void> {
    assertSafeRunId(runId)
    const state = this.writes.get(runId) ?? { tail: Promise.resolve() }
    this.writes.set(runId, state)

    const operation = state.tail.then(async () => {
      const metadata = await this.loadMetadata(runId)
      const loaded =
        state.lastSequence === undefined ? await this.loadEvents(runId) : undefined
      if (loaded?.warnings.some((warning) => warning.code === 'partial_final_jsonl_line')) {
        await discardPartialFinalJsonLine(this.eventsPath(runId))
      }
      let expectedSequence =
        (state.lastSequence ??
          loaded?.events.at(-1)?.sequence ??
          metadata.lastEventSequence) + 1
      let nextMetadata = metadata

      for (const rawEvent of rawEvents) {
        const event = parseGameEvent(rawEvent)
        if (event.runId !== runId) {
          throw new Error(
            `Cannot append event for run "${event.runId}" to run "${runId}".`
          )
        }
        if (event.sequence !== expectedSequence) {
          throw new Error(
            `Expected event sequence ${expectedSequence}, received ${event.sequence}.`
          )
        }

        await appendJsonLine(this.eventsPath(runId), event)
        state.lastSequence = event.sequence
        expectedSequence += 1
        nextMetadata = runMetadataSchema.parse({
          ...nextMetadata,
          updatedAt: event.timestamp,
          status: statusFromEvent(nextMetadata.status, event),
          lastEventSequence: event.sequence,
          lastTurnNumber: turnFromEvent(nextMetadata.lastTurnNumber, event)
        })
        await atomicWriteJson(this.metadataPath(runId), nextMetadata, true)
      }
    })

    state.tail = operation.catch(() => undefined)
    return operation
  }

  async writeSnapshot(runId: string, rawSnapshot: GameSnapshot): Promise<string> {
    assertSafeRunId(runId)
    const snapshot = gameSnapshotSchema.parse(rawSnapshot)
    if (snapshot.runId !== runId || snapshot.state.runId !== runId) {
      throw new Error('Snapshot run ID does not match its storage run.')
    }
    if (snapshot.sequence !== snapshot.state.lastAppliedEventSequence) {
      throw new Error('Snapshot sequence does not match its canonical state.')
    }

    const destination = this.snapshotPath(runId, snapshot.sequence)
    await atomicWriteJson(destination, snapshot, false)
    return destination
  }

  async loadMetadata(runId: string): Promise<RunMetadata> {
    assertSafeRunId(runId)
    const contents = await readFile(this.metadataPath(runId), 'utf8')
    return runMetadataSchema.parse(JSON.parse(contents) as unknown)
  }

  async loadEvents(runId: string): Promise<LoadedEvents> {
    assertSafeRunId(runId)
    const result = await readJsonLines(this.eventsPath(runId))
    const events = result.values.map((value, index) => {
      const event = parseGameEvent(value)
      if (event.runId !== runId) {
        throw new Error(
          `Event line ${index + 1} belongs to run "${event.runId}", not "${runId}".`
        )
      }
      const expectedSequence = index + 1
      if (event.sequence !== expectedSequence) {
        throw new Error(
          `Expected event sequence ${expectedSequence}, received ${event.sequence} at line ${index + 1}.`
        )
      }
      return event
    })
    return { events, warnings: result.warnings }
  }

  async loadLatestSnapshot(runId: string): Promise<GameSnapshot> {
    const snapshots = await this.loadSnapshots(runId)
    const latest = snapshots.at(-1)
    if (!latest) {
      throw new Error(`Run "${runId}" has no snapshots.`)
    }
    return latest
  }

  async listRuns(): Promise<RunMetadata[]> {
    await mkdir(this.runsRoot, { recursive: true })
    const entries = await readdir(this.runsRoot, { withFileTypes: true })
    const metadata = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => this.loadMetadata(entry.name))
    )
    return metadata.sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        left.runId.localeCompare(right.runId)
    )
  }

  async exportRun(
    runId: string,
    options: ExportRunOptions = {}
  ): Promise<string> {
    const replay = await this.replayRun(runId)
    const snapshots = await this.loadSnapshots(runId)
    const exportedAt = this.now()
    const document = runExportSchema.parse({
      exportVersion: RUN_EXPORT_VERSION,
      exportedAt,
      metadata: replay.metadata,
      events: replay.events,
      snapshots,
      finalState: replay.finalState,
      warnings: replay.warnings
    })
    const redacted = redactSecrets(document) as RunExport
    const destination = resolve(
      options.destination ?? join(this.runDirectory(runId), 'export.json')
    )
    await atomicWriteJson(destination, redacted, options.allowOverwrite ?? false)
    return destination
  }

  async replayRun(runId: string): Promise<ReplayResult> {
    const [metadata, loadedEvents, snapshots] = await Promise.all([
      this.loadMetadata(runId),
      this.loadEvents(runId),
      this.loadSnapshots(runId)
    ])
    return replayStoredRun({
      metadata,
      snapshots,
      events: loadedEvents.events,
      warnings: loadedEvents.warnings
    })
  }

  private async loadSnapshots(runId: string): Promise<GameSnapshot[]> {
    assertSafeRunId(runId)
    const directory = this.snapshotDirectory(runId)
    const entries = await readdir(directory, { withFileTypes: true })
    const paths = entries
      .filter((entry) => entry.isFile() && SNAPSHOT_FILE_PATTERN.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => join(directory, entry.name))

    return Promise.all(
      paths.map(async (path) => {
        const snapshot = gameSnapshotSchema.parse(
          JSON.parse(await readFile(path, 'utf8')) as unknown
        )
        if (snapshot.runId !== runId || snapshot.state.runId !== runId) {
          throw new Error(`Snapshot "${path}" belongs to another run.`)
        }
        return snapshot
      })
    )
  }

  private runDirectory(runId: string): string {
    assertSafeRunId(runId)
    return join(this.runsRoot, runId)
  }

  private metadataPath(runId: string): string {
    return join(this.runDirectory(runId), 'metadata.json')
  }

  private eventsPath(runId: string): string {
    return join(this.runDirectory(runId), 'events.jsonl')
  }

  private snapshotDirectory(runId: string): string {
    return join(this.runDirectory(runId), 'snapshots')
  }

  private snapshotPath(runId: string, sequence: number): string {
    if (sequence > 999_999) {
      throw new Error('Snapshot sequence exceeds the six-digit storage format.')
    }
    return join(
      this.snapshotDirectory(runId),
      `${sequence.toString().padStart(6, '0')}.json`
    )
  }
}

export function createRunStore(options: RunStoreOptions): RunStore {
  return new RunStore(options)
}

export type {
  CreateRunInput,
  ExportRunOptions,
  LoadedEvents,
  ReplayResult,
  RunMetadata
} from './types'
