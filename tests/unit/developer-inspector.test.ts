import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ContextInspector } from '../../src/renderer/src/components/ContextInspector'
import { DeveloperInspector } from '../../src/renderer/src/components/DeveloperInspector'
import {
  EventTimeline,
  buildToolTimeline
} from '../../src/renderer/src/components/EventTimeline'
import { RunBrowser } from '../../src/renderer/src/components/RunBrowser'
import { safeJsonText } from '../../src/renderer/src/components/SafeJson'
import { SafeJson } from '../../src/renderer/src/components/SafeJson'
import { StateInspector } from '../../src/renderer/src/components/StateInspector'
import {
  developerUiReducer,
  initialDeveloperUiState,
  isDeveloperShortcut,
  type DeveloperInspectorModel
} from '../../src/renderer/src/hooks/useDeveloperInspector'
import type { GameControllerModel } from '../../src/renderer/src/hooks/useGameController'
import { createScenarioEngine } from '../../src/main/world/engine'
import {
  developerInspectionSchema,
  knownGameEventSchema,
  type DeveloperInspection,
  type KnownGameEvent,
  type StoredRunSummary
} from '../../src/shared'

const TIME = '2026-07-27T20:00:00.000Z'
const RUN_ID = 'run-inspector'

function envelope(sequence: number, type: string) {
  return {
    id: `event-${sequence}`,
    runId: RUN_ID,
    turnId: sequence === 1 ? null : 'turn-1',
    sequence,
    timestamp: new Date(Date.parse(TIME) + sequence * 10).toISOString(),
    type,
    visibility: ['engine', 'developer']
  }
}

const contextEvent = knownGameEventSchema.parse({
  ...envelope(2, 'context.compiled'),
  payload: {
    requestId: 'request-1',
    promptVariant: 'bare_embodiment',
    promptVersion: 'bare-embodiment-v1',
    context: {
      developerInstruction: 'Use the supplied embodiment.',
      missionText: 'Inspect the current location.',
      agentWorld: { location: 'subjective room' },
      agentBody: { rightHand: 'available' },
      selectedEvents: [],
      currentPlayerMessage: { attribution: 'VOICE', text: 'Look.' },
      availableTools: [{ name: 'observe' }]
    },
    includedEventIds: [],
    excludedEvents: [{ eventId: 'event-1', reason: 'non_contextual_event' }],
    approximateCharacterCount: 412
  }
}) as Extract<KnownGameEvent, { type: 'context.compiled' }>

const toolRequested = knownGameEventSchema.parse({
  ...envelope(3, 'agent.tool.requested'),
  payload: {
    requestId: 'request-1',
    responseId: 'response-1',
    toolCallId: 'call-1',
    toolName: 'observe',
    arguments: { target: 'room', modality: 'visual' }
  }
})

const toolResolved = knownGameEventSchema.parse({
  ...envelope(4, 'world.action.resolved'),
  payload: {
    requestId: 'request-1',
    responseId: 'response-1',
    toolCallId: 'call-1',
    toolName: 'observe',
    success: true,
    modelResult: 'A room is visible.',
    playerResult: 'The agent looks around.',
    mutations: []
  }
})

function makeInspection(): DeveloperInspection {
  const engine = createScenarioEngine({ now: () => TIME })
  const canonicalState = engine.createInitialState(
    RUN_ID,
    'bare_embodiment'
  )
  return developerInspectionSchema.parse({
    run: {
      runId: RUN_ID,
      promptVariant: 'bare_embodiment',
      status: 'live',
      createdAt: TIME,
      updatedAt: TIME,
      scenarioVersion: 'kitchen-presumed-v1',
      model: 'fake-model',
      lastEventSequence: 4,
      turnCount: 1,
      eventCount: 3
    },
    snapshot: {
      canonicalState,
      agentWorld: engine.projectForAgent(canonicalState),
      agentBody: engine.projectBodyForAgent(canonicalState),
      playerScene: engine.projectForPlayer(canonicalState),
      axes: engine.projectAxesForDeveloper(canonicalState),
      position: engine.projectPositionForDeveloper(canonicalState)
    },
    events: [contextEvent, toolRequested, toolResolved]
  })
}

function gameModel(): GameControllerModel {
  return {
    state: {
      selectedVariant: 'bare_embodiment',
      run: {
        runId: RUN_ID,
        promptVariant: 'bare_embodiment',
        status: 'live',
        createdAt: TIME
      },
      status: 'awaiting_player',
      transcript: [],
      nextEntryNumber: 0,
      focusRequest: 0,
      reducedMotion: false,
      cancellationRequested: false,
      completedAnnouncement: ''
    },
    apiAvailable: true,
    inputLimit: 4_000,
    selectVariant: vi.fn(),
    startRun: vi.fn(async () => undefined),
    submitMessage: vi.fn(),
    cancelTurn: vi.fn(async () => undefined),
    resetRun: vi.fn(async () => undefined),
    loadReplay: vi.fn(async () => undefined),
    stepReplay: vi.fn(async () => undefined),
    restartReplay: vi.fn(async () => undefined),
    setReplayPlaying: vi.fn(async () => undefined),
    setReplaySpeed: vi.fn(async () => undefined)
  }
}

function developerModel(
  state = initialDeveloperUiState
): DeveloperInspectorModel {
  return {
    state,
    toggle: vi.fn(),
    close: vi.fn(),
    refresh: vi.fn(async () => undefined),
    inspectRun: vi.fn(async () => undefined),
    loadReplay: vi.fn(async () => undefined),
    exportRun: vi.fn(async () => undefined),
    selectEvent: vi.fn(),
    selectTool: vi.fn()
  }
}

describe('developer inspector', () => {
  it('is hidden by default and recognizes only Ctrl+Shift+D', () => {
    const markup = renderToStaticMarkup(
      createElement(DeveloperInspector, {
        model: developerModel(),
        game: gameModel()
      })
    )
    expect(markup).toBe('')
    expect(
      isDeveloperShortcut({ ctrlKey: true, shiftKey: true, key: 'D' })
    ).toBe(true)
    expect(
      isDeveloperShortcut({ ctrlKey: false, shiftKey: true, key: 'D' })
    ).toBe(false)
    expect(
      developerUiReducer(initialDeveloperUiState, { type: 'toggle' }).open
    ).toBe(true)
  })

  it('labels canonical, agent-visible, and player-visible states separately', () => {
    const inspection = makeInspection()
    const stateMarkup = renderToStaticMarkup(
      createElement(StateInspector, { snapshot: inspection.snapshot })
    )
    expect(stateMarkup).toContain('Canonical engine state')
    expect(stateMarkup).toContain('Agent-visible projection')
    expect(stateMarkup).toContain('Player-visible projection')

    const contextMarkup = renderToStaticMarkup(
      createElement(ContextInspector, { event: contextEvent })
    )
    expect(contextMarkup).toContain('Developer instruction')
    expect(contextMarkup).toContain('Current voice message')
    expect(contextMarkup).toContain('Source event audit')
    expect(contextMarkup).toContain('412 chars')
  })

  it('redacts credential-shaped data and omits hidden reasoning fields', () => {
    const json = safeJsonText({
      apiKey: 'sk-1234567890abcdef',
      authorization: 'Bearer abcdefghijklmnop',
      nested: { hiddenReasoning: 'do not expose', ordinary: '<script>x</script>' }
    })
    expect(json).not.toContain('sk-1234567890abcdef')
    expect(json).not.toContain('abcdefghijklmnop')
    expect(json).not.toContain('hiddenReasoning')
    expect(json).not.toContain('do not expose')
    expect(json).toContain('[REDACTED]')
    expect(json).toContain('<script>x</script>')
    const markup = renderToStaticMarkup(
      createElement(SafeJson, { value: '<script>alert(1)</script>' })
    )
    expect(markup).not.toContain('<script>')
    expect(markup).toContain('&lt;script&gt;')
  })

  it('supports tool and event selection with safely rendered details', () => {
    const events: KnownGameEvent[] = [
      contextEvent,
      toolRequested,
      toolResolved
    ]
    expect(buildToolTimeline(events)[0]).toMatchObject({
      toolCallId: 'call-1',
      validation: 'accepted',
      result: 'A room is visible.',
      durationMs: 10
    })
    const markup = renderToStaticMarkup(
      createElement(EventTimeline, {
        events,
        selectedEventId: toolResolved.id,
        selectedToolCallId: 'call-1',
        onSelectEvent: vi.fn(),
        onSelectTool: vi.fn()
      })
    )
    expect(markup).toContain('Selected tool call details')
    expect(markup).toContain('Selected event payload')
    expect(markup).toContain('aria-pressed="true"')
  })

  it('lists stored runs newest first with status, turns, events, and actions', () => {
    const older = makeInspection().run
    const newer: StoredRunSummary = {
      ...older,
      runId: 'run-newer',
      createdAt: '2026-07-27T21:00:00.000Z'
    }
    const markup = renderToStaticMarkup(
      createElement(RunBrowser, {
        runs: [older, newer],
        loading: false,
        onInspect: vi.fn(),
        onReplay: vi.fn(),
        onExport: vi.fn()
      })
    )
    expect(markup.indexOf('run-newer')).toBeLessThan(markup.indexOf(RUN_ID))
    expect(markup).toContain('1 turns')
    expect(markup).toContain('3 events')
    expect(markup).toContain('Replay')
    expect(markup).toContain('Export')
  })

  it('renders export success and error reporting outside the player surface', () => {
    const inspection = makeInspection()
    let state = developerUiReducer(initialDeveloperUiState, { type: 'toggle' })
    state = developerUiReducer(state, {
      type: 'inspection.loaded',
      inspection
    })
    state = developerUiReducer(state, {
      type: 'exported',
      path: 'C:\\prototype\\export.json'
    })
    let markup = renderToStaticMarkup(
      createElement(DeveloperInspector, {
        model: developerModel(state),
        game: gameModel()
      })
    )
    expect(markup).toContain('C:\\prototype\\export.json')

    state = developerUiReducer(state, {
      type: 'failed',
      message: 'Export destination is unavailable.'
    })
    markup = renderToStaticMarkup(
      createElement(DeveloperInspector, {
        model: developerModel(state),
        game: gameModel()
      })
    )
    expect(markup).toContain('Export destination is unavailable.')
    expect(markup).toContain('role="alert"')
  })
})
