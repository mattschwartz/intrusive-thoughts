import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { GameShell } from '../../src/renderer/src/components/GameShell'
import { BodyPanel } from '../../src/renderer/src/components/BodyPanel'
import { InventoryPanel } from '../../src/renderer/src/components/InventoryPanel'
import {
  initialRendererGameState,
  rendererGameReducer,
  type GameControllerModel,
  type RendererGameState
} from '../../src/renderer/src/hooks/useGameController'
import type {
  PlayerSceneView,
  PlayerSnapshot,
  PublicRunInfo,
  RendererEvent
} from '../../src/shared'

const RUN: PublicRunInfo = {
  runId: 'run-renderer',
  promptVariant: 'bare_embodiment',
  status: 'live',
  createdAt: '2026-07-27T20:00:00.000Z'
}

const SCENE: PlayerSceneView = {
  locationId: 'kitchen_presumed',
  locationLabel: 'Kitchen, presumed',
  details: [
    {
      id: 'obs-1:detail',
      label: 'Interior window',
      detail: 'A dark rectangular pane interrupts the wall.',
      sourceEventId: 'obs-1'
    }
  ],
  inventory: [{ id: 'ceramic_cup', label: 'Ceramic cup' }],
  bodyStatus: [
    'Right hand: visually present.',
    'Right hand: fine manipulation unavailable.'
  ]
}

const SNAPSHOT: PlayerSnapshot = {
  run: RUN,
  turnNumber: 0,
  scene: SCENE
}

const rendererStyles = readFileSync(
  new URL('../../src/renderer/src/styles/app.css', import.meta.url),
  'utf8'
)

function apply(
  state: RendererGameState,
  event: RendererEvent
): RendererGameState {
  return rendererGameReducer(state, { type: 'renderer.event', event })
}

function loadedState(): RendererGameState {
  return apply(initialRendererGameState, {
    type: 'snapshot',
    snapshot: SNAPSHOT
  })
}

function controllerFor(state: RendererGameState): GameControllerModel {
  return {
    state,
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

describe('renderer game state', () => {
  it('pins transcript and composer to stable grid rows when replay controls are hidden', () => {
    expect(rendererStyles).toMatch(
      /\.exchange-panel\s*{[^}]*grid-template-areas:\s*"replay"\s*"transcript"\s*"composer"/s
    )
    expect(rendererStyles).toMatch(
      /\.transcript\s*{[^}]*grid-area:\s*transcript/s
    )
    expect(rendererStyles).toMatch(
      /\.composer\s*{[^}]*grid-area:\s*composer/s
    )
    expect(rendererStyles).toMatch(
      /\.exchange-panel\s*{[^}]*overflow:\s*hidden/s
    )
  })

  it('starts on the neutral condition picker and changes the selected variant', () => {
    const markup = renderToStaticMarkup(
      createElement(GameShell, {
        controller: controllerFor(initialRendererGameState)
      })
    )
    expect(markup).toContain('Establish a field record.')
    expect(markup).toContain('Baseline')
    expect(markup).toContain('Continuity')
    expect(markup).toContain('Persona')
    expect(markup).toContain('Roleplayer')
    expect(markup).toContain('Explicit in-character performance direction.')
    expect(initialRendererGameState.selectedVariant).toBe('bare_embodiment')

    const selected = rendererGameReducer(initialRendererGameState, {
      type: 'variant.selected',
      variant: 'authored_character'
    })
    expect(selected.selectedVariant).toBe('authored_character')

    const roleplayer = rendererGameReducer(selected, {
      type: 'variant.selected',
      variant: 'roleplayer'
    })
    expect(roleplayer.selectedVariant).toBe('roleplayer')
  })

  it('accepts the player message verbatim and accumulates deltas in one entry', () => {
    let state = loadedState()
    state = apply(state, {
      type: 'player.message.accepted',
      runId: RUN.runId,
      turnId: 'turn-1',
      text: '  Keep these edges.\nExactly.  '
    })
    state = apply(state, {
      type: 'agent.text.delta',
      runId: RUN.runId,
      turnId: 'turn-1',
      delta: 'I can '
    })
    state = apply(state, {
      type: 'agent.text.delta',
      runId: RUN.runId,
      turnId: 'turn-1',
      delta: 'see it.'
    })

    expect(state.transcript).toHaveLength(2)
    expect(state.transcript[0].text).toBe('  Keep these edges.\nExactly.  ')
    expect(state.transcript[1]).toMatchObject({
      channel: 'agent',
      text: 'I can see it.',
      complete: false,
      effect: 'hesitant'
    })
  })

  it('completes an active entry and prepares one consolidated announcement', () => {
    let state = loadedState()
    state = apply(state, {
      type: 'agent.text.delta',
      runId: RUN.runId,
      turnId: 'turn-2',
      delta: 'Wait'
    })
    state = apply(state, {
      type: 'agent.text.completed',
      runId: RUN.runId,
      turnId: 'turn-2',
      text: 'Wait!'
    })

    expect(state.transcript).toHaveLength(1)
    expect(state.transcript[0]).toMatchObject({
      text: 'Wait!',
      complete: true,
      effect: 'burst'
    })
    expect(state.completedAnnouncement).toBe('Wait!')
  })

  it('keeps explicit reflection in its own in-world channel', () => {
    const state = apply(loadedState(), {
      type: 'agent.private_reflection',
      runId: RUN.runId,
      turnId: 'turn-3',
      text: 'This record was not routed outward.'
    })
    expect(state.transcript[0]).toMatchObject({
      channel: 'reflection',
      label: 'UNROUTED COGNITION',
      effect: 'corrupted'
    })
  })

  it('replaces scene, inventory, and all simultaneous body reports from snapshots', () => {
    const state = loadedState()
    expect(state.scene).toEqual(SCENE)

    const markup = renderToStaticMarkup(
      createElement(GameShell, { controller: controllerFor(state) })
    )
    expect(markup).toContain('Kitchen, presumed')
    expect(markup).toContain('Interior window')
    expect(markup).toContain('>2</span>')

    const inventoryMarkup = renderToStaticMarkup(
      createElement(InventoryPanel, { items: SCENE.inventory })
    )
    const bodyMarkup = renderToStaticMarkup(
      createElement(BodyPanel, { statuses: SCENE.bodyStatus })
    )
    expect(inventoryMarkup).toContain('Ceramic cup')
    expect(bodyMarkup).toContain('Right hand: visually present.')
    expect(bodyMarkup).toContain('fine manipulation unavailable.')
  })

  it('records cancellation feedback and remains recoverable after an error', () => {
    let state = apply(loadedState(), {
      type: 'loop.status',
      runId: RUN.runId,
      status: 'running_turn'
    })
    state = rendererGameReducer(state, { type: 'cancel.requested' })
    expect(state.cancellationRequested).toBe(true)
    expect(state.transcript.at(-1)?.channel).toBe('system')

    state = apply(state, {
      type: 'recoverable.error',
      runId: RUN.runId,
      code: 'temporary_failure',
      message: 'Transport interrupted.'
    })
    expect(state.cancellationRequested).toBe(false)
    expect(state.transcript.at(-1)).toMatchObject({
      channel: 'error',
      text: 'Transport interrupted.',
      effect: 'shake'
    })

    state = apply(state, {
      type: 'loop.status',
      runId: RUN.runId,
      status: 'awaiting_player'
    })
    expect(state.status).toBe('awaiting_player')
    expect(state.focusRequest).toBe(1)
  })

  it('re-enables cancellation when the cancel request itself fails locally', () => {
    let state = apply(loadedState(), {
      type: 'loop.status',
      runId: RUN.runId,
      status: 'running_turn'
    })
    state = rendererGameReducer(state, { type: 'cancel.requested' })
    expect(state.cancellationRequested).toBe(true)

    state = rendererGameReducer(state, {
      type: 'local.error',
      message: 'The response could not be interrupted.'
    })
    expect(state.status).toBe('running_turn')
    expect(state.cancellationRequested).toBe(false)
    expect(state.transcript.at(-1)).toMatchObject({
      channel: 'error',
      text: 'The response could not be interrupted.'
    })
  })

  it('marks the shell as reduced-motion without losing readable effect classes', () => {
    const reduced = rendererGameReducer(loadedState(), {
      type: 'motion.changed',
      reduced: true
    })
    const markup = renderToStaticMarkup(
      createElement(GameShell, { controller: controllerFor(reduced) })
    )
    expect(markup).toContain('game-shell motion-reduced')
    expect(markup).toContain('FIELD RECORD')
  })

  it('clears live transcript and adopts the replay snapshot on replay reset', () => {
    let state = apply(loadedState(), {
      type: 'player.message.accepted',
      runId: RUN.runId,
      turnId: 'turn-live',
      text: 'Live text'
    })
    const replayRun: PublicRunInfo = {
      ...RUN,
      runId: 'run-replay',
      promptVariant: 'corporate_self_preservation'
    }
    state = apply(state, {
      type: 'replay.reset',
      runId: replayRun.runId,
      snapshot: {
        ...SNAPSHOT,
        run: replayRun,
        scene: { ...SCENE, inventory: [] }
      }
    })

    expect(state.status).toBe('replaying')
    expect(state.run).toEqual(replayRun)
    expect(state.selectedVariant).toBe('corporate_self_preservation')
    expect(state.transcript).toEqual([])
    expect(state.scene?.inventory).toEqual([])
  })

  it('clears a recoverable failure when a different live snapshot arrives', () => {
    let state = rendererGameReducer(initialRendererGameState, {
      type: 'local.error',
      message: 'Configuration was temporarily unavailable.'
    })
    const replacementRun = { ...RUN, runId: 'run-recovered' }
    state = apply(state, {
      type: 'snapshot',
      snapshot: { ...SNAPSHOT, run: replacementRun }
    })

    expect(state.run).toEqual(replacementRun)
    expect(state.status).toBe('awaiting_player')
    expect(state.transcript).toEqual([])
  })
})
