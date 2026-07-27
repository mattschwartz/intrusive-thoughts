import { useCallback, useEffect, useMemo, useReducer } from 'react'

import type {
  DeveloperInspection,
  IntrusiveThoughtsAPI,
  StoredRunSummary
} from '../../../shared'

export interface DeveloperUiState {
  open: boolean
  runs: StoredRunSummary[]
  inspection?: DeveloperInspection
  selectedEventId?: string
  selectedToolCallId?: string
  loading: boolean
  error?: string
  exportPath?: string
}

export type DeveloperUiAction =
  | { type: 'toggle' }
  | { type: 'close' }
  | { type: 'loading' }
  | { type: 'runs.loaded'; runs: StoredRunSummary[] }
  | { type: 'inspection.loaded'; inspection: DeveloperInspection }
  | { type: 'event.selected'; eventId: string }
  | { type: 'tool.selected'; toolCallId: string }
  | { type: 'exported'; path: string }
  | { type: 'failed'; message: string }

export const initialDeveloperUiState: DeveloperUiState = {
  open: false,
  runs: [],
  loading: false
}

export function developerUiReducer(
  state: DeveloperUiState,
  action: DeveloperUiAction
): DeveloperUiState {
  switch (action.type) {
    case 'toggle':
      return { ...state, open: !state.open, error: undefined }
    case 'close':
      return { ...state, open: false }
    case 'loading':
      return { ...state, loading: true, error: undefined }
    case 'runs.loaded':
      return { ...state, runs: action.runs, loading: false }
    case 'inspection.loaded':
      return {
        ...state,
        inspection: action.inspection,
        selectedEventId: action.inspection.events.at(-1)?.id,
        selectedToolCallId: undefined,
        loading: false,
        error: undefined,
        exportPath: undefined
      }
    case 'event.selected':
      return { ...state, selectedEventId: action.eventId }
    case 'tool.selected':
      return { ...state, selectedToolCallId: action.toolCallId }
    case 'exported':
      return { ...state, exportPath: action.path, loading: false, error: undefined }
    case 'failed':
      return { ...state, loading: false, error: action.message }
  }
}

export function isDeveloperShortcut(
  event: Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'key'>
): boolean {
  return event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd'
}

function messageFor(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

export interface DeveloperInspectorModel {
  state: DeveloperUiState
  toggle(): void
  close(): void
  refresh(currentRunId?: string): Promise<void>
  inspectRun(runId: string): Promise<void>
  loadReplay(runId: string): Promise<void>
  exportRun(runId: string): Promise<void>
  selectEvent(eventId: string): void
  selectTool(toolCallId: string): void
}

export function useDeveloperInspector(
  api: IntrusiveThoughtsAPI | undefined,
  currentRunId: string | undefined,
  loadReplayThroughGame: (runId: string) => Promise<void>
): DeveloperInspectorModel {
  const [state, dispatch] = useReducer(
    developerUiReducer,
    initialDeveloperUiState
  )

  const inspectRun = useCallback(
    async (runId: string): Promise<void> => {
      if (!api) return
      dispatch({ type: 'loading' })
      try {
        const inspection = await api.getDeveloperInspection({ runId })
        dispatch({ type: 'inspection.loaded', inspection })
      } catch (cause) {
        dispatch({
          type: 'failed',
          message: messageFor(cause, 'Developer data could not be loaded.')
        })
      }
    },
    [api]
  )

  const refresh = useCallback(
    async (runId = currentRunId): Promise<void> => {
      if (!api) return
      dispatch({ type: 'loading' })
      try {
        const runs = await api.listRuns()
        dispatch({ type: 'runs.loaded', runs })
        const target = runId ?? runs[0]?.runId
        if (target) await inspectRun(target)
      } catch (cause) {
        dispatch({
          type: 'failed',
          message: messageFor(cause, 'Stored runs could not be listed.')
        })
      }
    },
    [api, currentRunId, inspectRun]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isDeveloperShortcut(event)) return
      event.preventDefault()
      dispatch({ type: 'toggle' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (state.open) void refresh()
  }, [refresh, state.open])

  const loadReplay = useCallback(
    async (runId: string): Promise<void> => {
      dispatch({ type: 'loading' })
      try {
        await loadReplayThroughGame(runId)
        if (api) {
          const inspection = await api.getDeveloperInspection({ runId })
          dispatch({ type: 'inspection.loaded', inspection })
        }
      } catch (cause) {
        dispatch({
          type: 'failed',
          message: messageFor(cause, 'Replay could not be loaded.')
        })
      }
    },
    [api, loadReplayThroughGame]
  )

  const exportRun = useCallback(
    async (runId: string): Promise<void> => {
      if (!api) return
      dispatch({ type: 'loading' })
      try {
        const result = await api.exportRun({ runId, allowOverwrite: true })
        dispatch({ type: 'exported', path: result.path })
      } catch (cause) {
        dispatch({
          type: 'failed',
          message: messageFor(cause, 'The run could not be exported.')
        })
      }
    },
    [api]
  )

  return useMemo(
    () => ({
      state,
      toggle: () => dispatch({ type: 'toggle' }),
      close: () => dispatch({ type: 'close' }),
      refresh,
      inspectRun,
      loadReplay,
      exportRun,
      selectEvent: (eventId: string) =>
        dispatch({ type: 'event.selected', eventId }),
      selectTool: (toolCallId: string) =>
        dispatch({ type: 'tool.selected', toolCallId })
    }),
    [exportRun, inspectRun, loadReplay, refresh, state]
  )
}
