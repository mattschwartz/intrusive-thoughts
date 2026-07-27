import type { StoredRunSummary } from '../../../shared'

export function RunBrowser({
  runs,
  selectedRunId,
  loading,
  onInspect,
  onReplay,
  onExport
}: {
  runs: StoredRunSummary[]
  selectedRunId?: string
  loading: boolean
  onInspect(runId: string): void
  onReplay(runId: string): void
  onExport(runId: string): void
}): React.JSX.Element {
  const ordered = [...runs].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      left.runId.localeCompare(right.runId)
  )
  return (
    <section className="developer-section run-browser" aria-labelledby="run-browser-heading">
      <h3 id="run-browser-heading">Stored runs</h3>
      {ordered.length === 0 ? (
        <p className="developer-note">No stored runs.</p>
      ) : (
        <div className="run-list">
          {ordered.map((run) => (
            <article data-selected={run.runId === selectedRunId} key={run.runId}>
              <button
                type="button"
                className="run-select"
                disabled={loading}
                onClick={() => onInspect(run.runId)}
              >
                <strong>{run.runId}</strong>
                <span>{run.promptVariant} · {run.model}</span>
                <span>
                  {run.createdAt} · {run.status} · {run.turnCount} turns ·{' '}
                  {run.eventCount} events
                </span>
              </button>
              <div>
                <button type="button" disabled={loading} onClick={() => onReplay(run.runId)}>
                  Replay
                </button>
                <button type="button" disabled={loading} onClick={() => onExport(run.runId)}>
                  Export
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
