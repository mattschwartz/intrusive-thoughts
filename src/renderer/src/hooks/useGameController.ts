import { useCallback, useEffect, useMemo, useReducer } from 'react'

import {
  MAX_PLAYER_INPUT_CHARACTERS,
  type ControllerStatus,
  type IntrusiveThoughtsAPI,
  type PlayerSceneView,
  type PromptVariant,
  type PublicRunInfo,
  type RendererEvent
} from '../../../shared'

export type TranscriptChannel =
  | 'player'
  | 'agent'
  | 'reflection'
  | 'system'
  | 'tool'
  | 'error'

export type TextEffect =
  | 'steady'
  | 'hesitant'
  | 'burst'
  | 'shake'
  | 'fading'
  | 'corrupted'

export interface TranscriptEntryState {
  id: string
  channel: TranscriptChannel
  text: string
  turnId?: string
  complete: boolean
  effect: TextEffect
  label: string
}

export interface RendererGameState {
  selectedVariant: PromptVariant
  run?: PublicRunInfo
  status: ControllerStatus
  scene?: PlayerSceneView
  transcript: TranscriptEntryState[]
  nextEntryNumber: number
  focusRequest: number
  reducedMotion: boolean
  cancellationRequested: boolean
  completedAnnouncement: string
}

export type RendererGameAction =
  | { type: 'variant.selected'; variant: PromptVariant }
  | { type: 'renderer.event'; event: RendererEvent }
  | { type: 'run.returned'; run: PublicRunInfo }
  | { type: 'cancel.requested' }
  | { type: 'local.error'; message: string }
  | { type: 'motion.changed'; reduced: boolean }

export const initialRendererGameState: RendererGameState = {
  selectedVariant: 'bare_embodiment',
  status: 'no_run',
  transcript: [],
  nextEntryNumber: 0,
  focusRequest: 0,
  reducedMotion: false,
  cancellationRequested: false,
  completedAnnouncement: ''
}

const labels: Record<TranscriptChannel, string> = {
  player: 'OPERATOR',
  agent: 'AGENT 07',
  reflection: 'UNROUTED COGNITION',
  system: 'FIELD TERMINAL',
  tool: 'ACTIVITY',
  error: 'RECOVERY'
}

function effectForAgentText(text: string): TextEffect {
  if (/[\uFFFD\u2588]|(?:\?{3,}|#{3,})/u.test(text)) return 'corrupted'
  if (text.length <= 120 && /!{1,3}(?:\s|$)/u.test(text)) return 'burst'
  if (/(?:\.{3}|…|\?$)/u.test(text.trim())) return 'hesitant'
  return 'steady'
}

function appendEntry(
  state: RendererGameState,
  entry: Omit<TranscriptEntryState, 'id' | 'label'>
): RendererGameState {
  const id = `entry-${state.nextEntryNumber}`
  return {
    ...state,
    transcript: [
      ...state.transcript,
      { ...entry, id, label: labels[entry.channel] }
    ],
    nextEntryNumber: state.nextEntryNumber + 1
  }
}

function eventBelongsToLoadedRun(
  state: RendererGameState,
  event: RendererEvent
): boolean {
  if (!('runId' in event) || !state.run) return true
  return event.runId === state.run.runId
}

function findActiveAgentEntry(
  entries: TranscriptEntryState[],
  turnId: string
): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (
      entry.channel === 'agent' &&
      entry.turnId === turnId &&
      !entry.complete
    ) {
      return index
    }
  }
  return -1
}

function reduceRendererEvent(
  state: RendererGameState,
  event: RendererEvent
): RendererGameState {
  if (event.type === 'replay.reset') {
    return {
      ...state,
      run: event.snapshot.run,
      selectedVariant: event.snapshot.run.promptVariant,
      status: 'replaying',
      scene: event.snapshot.scene,
      transcript: [],
      nextEntryNumber: 0,
      cancellationRequested: false,
      completedAnnouncement: ''
    }
  }

  if (event.type === 'snapshot') {
    const isNewRun = !state.run || state.run.runId !== event.snapshot.run.runId
    return {
      ...state,
      run: event.snapshot.run,
      selectedVariant: event.snapshot.run.promptVariant,
      scene: event.snapshot.scene,
      status:
        (isNewRun || state.status === 'no_run') &&
        event.snapshot.run.status === 'live'
          ? 'awaiting_player'
          : state.status,
      transcript: isNewRun ? [] : state.transcript,
      nextEntryNumber: isNewRun ? 0 : state.nextEntryNumber,
      cancellationRequested: isNewRun ? false : state.cancellationRequested,
      completedAnnouncement: isNewRun ? '' : state.completedAnnouncement
    }
  }

  if (!eventBelongsToLoadedRun(state, event)) return state

  switch (event.type) {
    case 'player.message.accepted':
      return appendEntry(state, {
        channel: 'player',
        text: event.text,
        turnId: event.turnId,
        complete: true,
        effect: 'steady'
      })
    case 'agent.text.delta': {
      const activeIndex = findActiveAgentEntry(state.transcript, event.turnId)
      if (activeIndex < 0) {
        return appendEntry(state, {
          channel: 'agent',
          text: event.delta,
          turnId: event.turnId,
          complete: false,
          effect: 'hesitant'
        })
      }
      const transcript = [...state.transcript]
      transcript[activeIndex] = {
        ...transcript[activeIndex],
        text: transcript[activeIndex].text + event.delta
      }
      return { ...state, transcript }
    }
    case 'agent.text.completed': {
      const activeIndex = findActiveAgentEntry(state.transcript, event.turnId)
      if (activeIndex < 0) {
        const lastEntry = state.transcript.at(-1)
        if (
          lastEntry?.channel === 'agent' &&
          lastEntry.turnId === event.turnId &&
          lastEntry.complete &&
          lastEntry.text === event.text
        ) {
          return state
        }
        const next = appendEntry(state, {
          channel: 'agent',
          text: event.text,
          turnId: event.turnId,
          complete: true,
          effect: effectForAgentText(event.text)
        })
        return { ...next, completedAnnouncement: event.text }
      }
      const transcript = [...state.transcript]
      transcript[activeIndex] = {
        ...transcript[activeIndex],
        text: event.text,
        complete: true,
        effect: effectForAgentText(event.text)
      }
      return { ...state, transcript, completedAnnouncement: event.text }
    }
    case 'agent.private_reflection':
      return appendEntry(state, {
        channel: 'reflection',
        text: event.text,
        turnId: event.turnId,
        complete: true,
        effect: 'corrupted'
      })
    case 'tool.activity':
      return appendEntry(state, {
        channel: 'tool',
        text: event.summary,
        turnId: event.turnId,
        complete: true,
        effect:
          event.status === 'rejected'
            ? 'shake'
            : event.status === 'resolved'
              ? 'fading'
              : 'steady'
      })
    case 'scene.updated':
      return { ...state, scene: event.scene }
    case 'loop.status': {
      const focusRequest =
        state.status === 'running_turn' && event.status === 'awaiting_player'
          ? state.focusRequest + 1
          : state.focusRequest
      return {
        ...state,
        status: event.status,
        focusRequest,
        cancellationRequested:
          event.status === 'running_turn' && state.cancellationRequested
      }
    }
    case 'recoverable.error':
      return {
        ...appendEntry(state, {
          channel: 'error',
          text: event.message,
          complete: true,
          effect: 'shake'
        }),
        cancellationRequested: false
      }
    case 'replay.complete':
      return {
        ...state,
        status: 'replaying',
        completedAnnouncement: 'Playback complete.'
      }
    case 'replay.event':
      return state
  }
}

export function rendererGameReducer(
  state: RendererGameState,
  action: RendererGameAction
): RendererGameState {
  switch (action.type) {
    case 'variant.selected':
      return state.run ? state : { ...state, selectedVariant: action.variant }
    case 'run.returned': {
      const isNewRun = !state.run || state.run.runId !== action.run.runId
      return {
        ...state,
        run: action.run,
        selectedVariant: action.run.promptVariant,
        status:
          isNewRun && action.run.status === 'live'
            ? 'awaiting_player'
            : state.status,
        scene: isNewRun ? undefined : state.scene,
        transcript: isNewRun ? [] : state.transcript,
        nextEntryNumber: isNewRun ? 0 : state.nextEntryNumber,
        cancellationRequested: isNewRun ? false : state.cancellationRequested,
        completedAnnouncement: isNewRun ? '' : state.completedAnnouncement
      }
    }
    case 'renderer.event':
      return reduceRendererEvent(state, action.event)
    case 'cancel.requested':
      return {
        ...appendEntry(state, {
          channel: 'system',
          text: 'Interrupt requested. Awaiting transport acknowledgement.',
          complete: true,
          effect: 'fading'
        }),
        cancellationRequested: true
      }
    case 'local.error':
      return {
        ...appendEntry(state, {
          channel: 'error',
          text: action.message,
          complete: true,
          effect: 'shake'
        }),
        cancellationRequested: false
      }
    case 'motion.changed':
      return { ...state, reducedMotion: action.reduced }
  }
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

export interface GameControllerModel {
  state: RendererGameState
  apiAvailable: boolean
  inputLimit: number
  selectVariant(variant: PromptVariant): void
  startRun(): Promise<void>
  submitMessage(text: string): void
  cancelTurn(): Promise<void>
  resetRun(): Promise<void>
}

export function useGameController(
  api: IntrusiveThoughtsAPI | undefined
): GameControllerModel {
  const [state, dispatch] = useReducer(
    rendererGameReducer,
    initialRendererGameState
  )

  useEffect(() => {
    if (!api) return undefined
    return api.subscribe((event) => {
      dispatch({ type: 'renderer.event', event })
    })
  }, [api])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return undefined
    const apply = (): void => {
      dispatch({ type: 'motion.changed', reduced: media.matches })
    }
    apply()
    media.addEventListener?.('change', apply)
    return () => media.removeEventListener?.('change', apply)
  }, [])

  const hydrateSnapshot = useCallback(
    async (run: PublicRunInfo): Promise<void> => {
      if (!api) return
      try {
        const snapshot = await api.getSnapshot({ runId: run.runId })
        dispatch({ type: 'renderer.event', event: { type: 'snapshot', snapshot } })
      } catch (cause) {
        dispatch({
          type: 'local.error',
          message: errorMessage(cause, 'The field record could not be synchronized.')
        })
      }
    },
    [api]
  )

  const startRun = useCallback(async (): Promise<void> => {
    if (!api) return
    try {
      const run = await api.startRun({ promptVariant: state.selectedVariant })
      dispatch({ type: 'run.returned', run })
      await hydrateSnapshot(run)
    } catch (cause) {
      dispatch({
        type: 'local.error',
        message: errorMessage(cause, 'The record could not be initialized.')
      })
    }
  }, [api, hydrateSnapshot, state.selectedVariant])

  const submitMessage = useCallback(
    (text: string): void => {
      if (
        !api ||
        !state.run ||
        state.status !== 'awaiting_player' ||
        text.trim().length === 0
      ) {
        return
      }
      void api
        .submitPlayerMessage({ runId: state.run.runId, text })
        .catch((cause: unknown) => {
          dispatch({
            type: 'local.error',
            message: errorMessage(cause, 'The message could not be transmitted.')
          })
        })
    },
    [api, state.run, state.status]
  )

  const cancelTurn = useCallback(async (): Promise<void> => {
    if (!api || !state.run || state.status !== 'running_turn') return
    dispatch({ type: 'cancel.requested' })
    try {
      await api.cancelTurn({ runId: state.run.runId })
    } catch (cause) {
      dispatch({
        type: 'local.error',
        message: errorMessage(cause, 'The response could not be interrupted.')
      })
    }
  }, [api, state.run, state.status])

  const resetRun = useCallback(async (): Promise<void> => {
    if (!api) return
    if (
      state.status === 'running_turn' &&
      !window.confirm(
        'The current response will be interrupted. Start a new field record?'
      )
    ) {
      return
    }
    try {
      const run = await api.resetRun({
        ...(state.run ? { runId: state.run.runId } : {}),
        promptVariant: state.selectedVariant
      })
      dispatch({ type: 'run.returned', run })
      await hydrateSnapshot(run)
    } catch (cause) {
      dispatch({
        type: 'local.error',
        message: errorMessage(cause, 'A new record could not be initialized.')
      })
    }
  }, [api, hydrateSnapshot, state.run, state.selectedVariant, state.status])

  return useMemo(
    () => ({
      state,
      apiAvailable: Boolean(api),
      inputLimit: MAX_PLAYER_INPUT_CHARACTERS,
      selectVariant: (variant: PromptVariant) =>
        dispatch({ type: 'variant.selected', variant }),
      startRun,
      submitMessage,
      cancelTurn,
      resetRun
    }),
    [api, cancelTurn, resetRun, startRun, state, submitMessage]
  )
}
