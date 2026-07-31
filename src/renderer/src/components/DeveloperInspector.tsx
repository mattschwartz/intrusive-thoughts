import type {
  ControllerStatus,
  KnownGameEvent,
  PublicRunInfo
} from '../../../shared'
import type { DeveloperInspectorModel } from '../hooks/useDeveloperInspector'
import type { GameControllerModel } from '../hooks/useGameController'
import { ContextInspector } from './ContextInspector'
import { EventTimeline } from './EventTimeline'
import { RunBrowser } from './RunBrowser'
import { SliceInspector } from './SliceInspector'
import { StateInspector } from './StateInspector'

function contextForSelection(
  events: KnownGameEvent[],
  selectedEventId?: string
): Extract<KnownGameEvent, { type: 'context.compiled' }> | undefined {
  const selected = events.find((event) => event.id === selectedEventId)
  return [...events]
    .reverse()
    .find(
      (
        event
      ): event is Extract<KnownGameEvent, { type: 'context.compiled' }> =>
        event.type === 'context.compiled' &&
        (!selected ||
          (event.sequence <= selected.sequence &&
            (!selected.turnId || event.turnId === selected.turnId)))
    )
}

function terminalForSelection(
  events: KnownGameEvent[],
  selectedEventId?: string
):
  | Extract<
      KnownGameEvent,
      { type: 'turn.completed' | 'turn.cancelled' | 'loop.failed' }
    >
  | undefined {
  const selected = events.find((event) => event.id === selectedEventId)
  return [...events]
    .reverse()
    .find(
      (
        event
      ): event is Extract<
        KnownGameEvent,
        { type: 'turn.completed' | 'turn.cancelled' | 'loop.failed' }
      > =>
        (event.type === 'turn.completed' ||
          event.type === 'turn.cancelled' ||
          event.type === 'loop.failed') &&
        (!selected?.turnId || event.turnId === selected.turnId)
    )
}

function TurnSummary({
  run,
  status,
  events,
  selectedEventId,
  model
}: {
  run?: PublicRunInfo
  status: ControllerStatus
  events: KnownGameEvent[]
  selectedEventId?: string
  model?: string
}): React.JSX.Element {
  const selected = events.find((event) => event.id === selectedEventId)
  const context = contextForSelection(events, selectedEventId)
  const terminal = terminalForSelection(events, selectedEventId)
  const payload = terminal?.payload
  const responseId =
    payload && 'responseId' in payload ? payload.responseId : undefined
  const requestId =
    context?.payload.requestId ??
    (payload && 'requestId' in payload ? payload.requestId : undefined)
  const durationMs =
    terminal?.type === 'turn.completed' ? terminal.payload.durationMs : undefined
  const usage =
    terminal?.type === 'turn.completed' ? terminal.payload.usage : undefined
  const diagnostics =
    terminal?.type === 'turn.cancelled'
      ? terminal.payload.reason
      : terminal?.type === 'loop.failed'
        ? `${terminal.payload.code}: ${terminal.payload.message}`
        : 'none'
  const providerRequestIds =
    payload && 'providerRequestIds' in payload
      ? payload.providerRequestIds
      : undefined
  return (
    <section className="developer-section" aria-labelledby="loop-heading">
      <h3 id="loop-heading">Turn and loop</h3>
      <dl className="diagnostic-grid">
        <div><dt>Mode / phase</dt><dd>{status === 'replaying' ? 'REPLAY' : 'LIVE'} / {status}</dd></div>
        <div><dt>Run ID</dt><dd>{run?.runId ?? 'none'}</dd></div>
        <div><dt>Turn ID</dt><dd>{selected?.turnId ?? 'none'}</dd></div>
        <div><dt>Prompt</dt><dd>{context ? `${context.payload.promptVariant} / ${context.payload.promptVersion}` : run?.promptVariant ?? 'none'}</dd></div>
        <div><dt>Model</dt><dd>{terminal?.type === 'turn.completed' && terminal.payload.model ? terminal.payload.model : model ?? 'unavailable'}</dd></div>
        <div><dt>Request / response</dt><dd>{requestId ?? 'none'} / {responseId ?? 'none'}</dd></div>
        <div><dt>Provider request IDs</dt><dd>{providerRequestIds?.join(', ') ?? 'none'}</dd></div>
        <div><dt>Latency</dt><dd>{durationMs === undefined ? 'unavailable' : `${durationMs} ms`}</dd></div>
        <div><dt>Token usage</dt><dd>{usage ? `${usage.inputTokens} in / ${usage.outputTokens} out / ${usage.totalTokens} total` : 'unavailable'}</dd></div>
        <div><dt>Cancellation / failure</dt><dd>{diagnostics}</dd></div>
      </dl>
    </section>
  )
}

export function DeveloperInspector({
  model,
  game
}: {
  model: DeveloperInspectorModel
  game: GameControllerModel
}): React.JSX.Element | null {
  const { state } = model
  if (!state.open) return null
  const events = state.inspection?.events ?? []
  const context = contextForSelection(events, state.selectedEventId)
  return (
    <aside className="developer-drawer" aria-label="Developer inspector">
      <header className="developer-header">
        <div>
          <p className="kicker">OUT-OF-FICTION DIAGNOSTIC</p>
          <h2>Developer inspector</h2>
          <p>Ctrl+Shift+D toggles this drawer. Opening it never changes run state.</p>
        </div>
        <button type="button" onClick={model.close} aria-label="Close developer inspector">
          Close
        </button>
      </header>
      <div className="developer-scroll">
        <RunBrowser
          runs={state.runs}
          selectedRunId={state.inspection?.run.runId}
          loading={state.loading}
          onInspect={(runId) => void model.inspectRun(runId)}
          onReplay={(runId) => void model.loadReplay(runId)}
          onExport={(runId) => void model.exportRun(runId)}
        />
        {state.error && <p className="developer-error" role="alert">{state.error}</p>}
        {state.exportPath && (
          <p className="developer-success">
            Exported to <code>{state.exportPath}</code>
          </p>
        )}
        {state.inspection && (
          <>
            <TurnSummary
              run={game.state.run}
              status={game.state.status}
              events={events}
              selectedEventId={state.selectedEventId}
              model={state.inspection.run.model}
            />
            <SliceInspector
              snapshot={state.inspection.snapshot}
              events={events}
              {...(state.selectedEventId
                ? { selectedEventId: state.selectedEventId }
                : {})}
            />
            <ContextInspector event={context} />
            <StateInspector snapshot={state.inspection.snapshot} />
            <EventTimeline
              events={events}
              selectedEventId={state.selectedEventId}
              selectedToolCallId={state.selectedToolCallId}
              onSelectEvent={model.selectEvent}
              onSelectTool={model.selectTool}
            />
          </>
        )}
      </div>
    </aside>
  )
}
