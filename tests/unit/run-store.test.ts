import { appendFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import { RunStore } from '../../src/main/storage/run-store'
import { createScenarioEngine } from '../../src/main/world/engine'
import { SCENARIO_VERSION } from '../../src/main/world/scenario'
import {
  gameSnapshotSchema,
  knownGameEventSchema,
  type GameSnapshot,
  type KnownGameEvent
} from '../../src/shared'

const createdAt = '2026-07-27T12:00:00.000Z'
const later = '2026-07-27T12:01:00.000Z'
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'intrusive-thoughts-store-'))
  temporaryRoots.push(root)
  return root
}

function snapshotFor(runId: string, sequence = 0): GameSnapshot {
  const engine = createScenarioEngine()
  const state = engine.createInitialState(runId, 'bare_embodiment')
  state.lastAppliedEventSequence = sequence
  return gameSnapshotSchema.parse({
    runId,
    sequence,
    timestamp: createdAt,
    state,
    agentWorld: engine.projectForAgent(state),
    agentBody: engine.projectBodyForAgent(state),
    playerScene: engine.projectForPlayer(state)
  })
}

async function makeStore(runId = 'run-1'): Promise<{
  root: string
  store: RunStore
  initialSnapshot: GameSnapshot
}> {
  const root = await makeRoot()
  const store = new RunStore({ dataRoot: root, now: () => later })
  const initialSnapshot = snapshotFor(runId)
  await store.createRun({
    runId,
    createdAt,
    promptVariant: 'bare_embodiment',
    model: 'fake-model',
    scenarioVersion: SCENARIO_VERSION,
    prototypeVersion: '0.0.0',
    initialSnapshot
  })
  return { root, store, initialSnapshot }
}

function runStarted(runId: string, sequence = 1): KnownGameEvent {
  const initialState = snapshotFor(runId).state
  return knownGameEventSchema.parse({
    id: `${runId}-event-${sequence}`,
    runId,
    turnId: null,
    sequence,
    timestamp: createdAt,
    type: 'run.started',
    visibility: ['engine', 'developer'],
    payload: {
      initialState,
      promptVariant: 'bare_embodiment',
      scenarioVersion: SCENARIO_VERSION
    }
  })
}

function playerMessage(runId: string, sequence: number, turnNumber: number): KnownGameEvent {
  return knownGameEventSchema.parse({
    id: `${runId}-event-${sequence}`,
    runId,
    turnId: `${runId}-turn-${turnNumber}`,
    sequence,
    timestamp: later,
    type: 'player.message',
    visibility: ['engine', 'agent', 'player', 'developer'],
    payload: { text: `Voice message ${turnNumber}`, turnNumber }
  })
}

describe('RunStore', () => {
  it('creates the documented run layout and a validated sequence-zero snapshot', async () => {
    const { root, store, initialSnapshot } = await makeStore()
    const runDirectory = join(root, 'runs', 'run-1')

    expect(await readdir(runDirectory)).toEqual([
      'events.jsonl',
      'metadata.json',
      'snapshots'
    ])
    expect(await readdir(join(runDirectory, 'snapshots'))).toEqual(['000000.json'])
    expect(await store.loadMetadata('run-1')).toMatchObject({
      runId: 'run-1',
      status: 'live',
      lastEventSequence: 0,
      lastTurnNumber: 0
    })
    expect(await store.loadLatestSnapshot('run-1')).toEqual(initialSnapshot)
    expect((await store.loadEvents('run-1')).events).toEqual([])
  })

  it('appends and reloads events in exact order while updating metadata', async () => {
    const { store } = await makeStore()
    const events = [runStarted('run-1'), playerMessage('run-1', 2, 1)]

    await store.appendEvents('run-1', events)

    expect((await store.loadEvents('run-1')).events).toEqual(events)
    expect(await store.loadMetadata('run-1')).toMatchObject({
      lastEventSequence: 2,
      lastTurnNumber: 1,
      updatedAt: later
    })
  })

  it('serializes concurrent append calls in invocation order', async () => {
    const { store } = await makeStore()
    const events = [
      runStarted('run-1'),
      playerMessage('run-1', 2, 1),
      playerMessage('run-1', 3, 2)
    ]

    await Promise.all(events.map((event) => store.appendEvents('run-1', [event])))

    expect((await store.loadEvents('run-1')).events.map((event) => event.sequence)).toEqual([
      1, 2, 3
    ])
  })

  it('rejects skipped, duplicate, and cross-run event sequences without poisoning the queue', async () => {
    const { store } = await makeStore()
    await expect(store.appendEvents('run-1', [playerMessage('run-1', 2, 1)])).rejects.toThrow(
      'Expected event sequence 1'
    )
    await expect(store.appendEvents('run-1', [runStarted('other-run')])).rejects.toThrow(
      'Cannot append event for run'
    )

    await store.appendEvents('run-1', [runStarted('run-1')])
    await expect(store.appendEvents('run-1', [runStarted('run-1')])).rejects.toThrow(
      'Expected event sequence 2'
    )
    expect((await store.loadEvents('run-1')).events).toHaveLength(1)
  })

  it('reinitializes sequence state from disk after a process-like restart', async () => {
    const { root, store } = await makeStore()
    await store.appendEvents('run-1', [runStarted('run-1')])

    const reinitialized = new RunStore({ dataRoot: root })
    await reinitialized.appendEvents('run-1', [playerMessage('run-1', 2, 1)])

    expect((await reinitialized.loadEvents('run-1')).events).toHaveLength(2)
  })

  it('writes snapshots atomically and leaves no temporary sibling', async () => {
    const { root, store } = await makeStore()
    const second = snapshotFor('run-1', 1)

    await store.writeSnapshot('run-1', second)

    const files = await readdir(join(root, 'runs', 'run-1', 'snapshots'))
    expect(files).toEqual(['000000.json', '000001.json'])
    expect(files.some((file) => file.includes('.tmp-'))).toBe(false)
    await expect(store.writeSnapshot('run-1', second)).rejects.toThrow(
      'Refusing to overwrite'
    )
  })

  it('accepts an empty event file and ignores an unterminated crash tail with a warning', async () => {
    const { root, store } = await makeStore()
    expect(await store.loadEvents('run-1')).toEqual({ events: [], warnings: [] })

    const eventsPath = join(root, 'runs', 'run-1', 'events.jsonl')
    await appendFile(eventsPath, '{"id":"unfinished"', 'utf8')
    const loaded = await store.loadEvents('run-1')

    expect(loaded.events).toEqual([])
    expect(loaded.warnings).toEqual([
      expect.objectContaining({
        code: 'partial_final_jsonl_line',
        lineNumber: 1
      })
    ])
  })

  it('discards an ignored crash tail before appending after reinitialization', async () => {
    const { root, store } = await makeStore()
    await store.appendEvents('run-1', [runStarted('run-1')])
    const eventsPath = join(root, 'runs', 'run-1', 'events.jsonl')
    await appendFile(eventsPath, '{"id":"unfinished"', 'utf8')

    const restarted = new RunStore({ dataRoot: root })
    await restarted.appendEvents('run-1', [playerMessage('run-1', 2, 1)])

    expect(await restarted.loadEvents('run-1')).toMatchObject({
      warnings: [],
      events: [
        expect.objectContaining({ sequence: 1 }),
        expect.objectContaining({ sequence: 2 })
      ]
    })
  })

  it('tolerates trailing empty lines but rejects an empty line between events', async () => {
    const { root, store } = await makeStore()
    const first = JSON.stringify(runStarted('run-1'))
    const second = JSON.stringify(playerMessage('run-1', 2, 1))
    const eventsPath = join(root, 'runs', 'run-1', 'events.jsonl')
    await writeFile(eventsPath, `${first}\n\n`, 'utf8')
    expect((await store.loadEvents('run-1')).events).toHaveLength(1)

    await writeFile(eventsPath, `${first}\n\n${second}\n`, 'utf8')
    await expect(store.loadEvents('run-1')).rejects.toThrow('Unexpected empty JSONL line 2')
  })

  it('fails loudly for middle-of-file corruption', async () => {
    const { root, store } = await makeStore()
    const valid = JSON.stringify(runStarted('run-1'))
    await writeFile(
      join(root, 'runs', 'run-1', 'events.jsonl'),
      `${valid}\nnot-json\n{"partial":`,
      'utf8'
    )

    await expect(store.loadEvents('run-1')).rejects.toThrow('Invalid JSONL')
  })

  it('lists runs newest first with a stable run-ID tie break', async () => {
    const root = await makeRoot()
    const store = new RunStore({ dataRoot: root })
    for (const [runId, timestamp] of [
      ['run-b', '2026-07-27T12:00:00.000Z'],
      ['run-a', '2026-07-27T12:00:00.000Z'],
      ['run-newest', '2026-07-27T13:00:00.000Z']
    ] as const) {
      await store.createRun({
        runId,
        createdAt: timestamp,
        promptVariant: 'bare_embodiment',
        model: 'fake-model',
        scenarioVersion: SCENARIO_VERSION,
        prototypeVersion: '0.0.0',
        initialSnapshot: snapshotFor(runId)
      })
    }

    expect((await store.listRuns()).map(({ runId }) => runId)).toEqual([
      'run-newest',
      'run-a',
      'run-b'
    ])
  })

  it('exports a self-contained redacted document without implicit overwrite', async () => {
    const { root, store } = await makeStore()
    const secret = 'must-not-leave-storage'
    const contextEvent = knownGameEventSchema.parse({
      id: 'run-1-event-2',
      runId: 'run-1',
      turnId: 'run-1-turn-1',
      sequence: 2,
      timestamp: later,
      type: 'context.compiled',
      visibility: ['engine', 'developer'],
      payload: {
        requestId: 'request-1',
        promptVariant: 'bare_embodiment',
        promptVersion: 'test-v1',
        context: {
          mission: 'Inspect.',
          apiKey: secret,
          nested: { authorization: `Bearer ${secret}` }
        },
        includedEventIds: [],
        excludedEvents: [],
        approximateCharacterCount: 8
      }
    })
    await store.appendEvents('run-1', [runStarted('run-1'), contextEvent])

    const destination = await store.exportRun('run-1')
    const contents = await readFile(destination, 'utf8')
    const exported = JSON.parse(contents) as Record<string, unknown>

    expect(destination).toBe(join(root, 'runs', 'run-1', 'export.json'))
    expect(exported.exportVersion).toBe(1)
    expect(exported).toHaveProperty('metadata')
    expect(exported).toHaveProperty('events')
    expect(exported).toHaveProperty('snapshots')
    expect(exported).toHaveProperty('finalState')
    expect(contents).not.toContain(secret)
    expect(contents).toContain('[REDACTED]')
    await expect(store.exportRun('run-1')).rejects.toThrow('Refusing to overwrite')
    await store.exportRun('run-1', { allowOverwrite: true })
  })
})
