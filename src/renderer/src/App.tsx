import { useEffect, useState, type FormEvent } from 'react'

import type {
  ControllerStatus,
  PublicRunInfo,
  StoredRunSummary
} from '../../shared'

function App(): React.JSX.Element {
  const api = window.intrusiveThoughts
  const [run, setRun] = useState<PublicRunInfo>()
  const [status, setStatus] = useState<ControllerStatus>('no_run')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [storedRuns, setStoredRuns] = useState<StoredRunSummary[]>([])

  document.title = api
    ? 'Intrusive Thoughts — controller diagnostic'
    : 'Intrusive Thoughts — controller diagnostic [preload unavailable]'

  useEffect(() => {
    if (!api) return undefined
    return api.subscribe((event) => {
      if (event.type === 'loop.status') setStatus(event.status)
      if (event.type === 'agent.text.delta') {
        setOutput((current) => current + event.delta)
      }
      if (event.type === 'agent.text.completed') setOutput(event.text)
      if (event.type === 'replay.reset') {
        setRun(event.snapshot.run)
        setOutput('')
      }
      if (event.type === 'recoverable.error') setError(event.message)
    })
  }, [api])

  const start = async (): Promise<void> => {
    if (!api) return
    setError('')
    setOutput('')
    try {
      setRun(await api.startRun({ promptVariant: 'bare_embodiment' }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Start failed.')
    }
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!api || !run || !input.trim()) return
    const text = input
    setInput('')
    setOutput('')
    setError('')
    void api
      .submitPlayerMessage({ runId: run.runId, text })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Turn failed.')
      )
  }

  const reset = async (): Promise<void> => {
    if (!api) return
    setError('')
    try {
      setOutput('')
      setRun(
        await api.resetRun({
          ...(run ? { runId: run.runId } : {}),
          promptVariant: 'bare_embodiment'
        })
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reset failed.')
    }
  }

  const refreshRuns = async (): Promise<void> => {
    if (!api) return
    try {
      setStoredRuns(await api.listRuns())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Run listing failed.')
    }
  }

  return (
    <main className="prototype-shell">
      <section className="status-panel" aria-labelledby="prototype-title">
        <p className="eyebrow">TEMPORARY CONTROLLER DIAGNOSTIC</p>
        <h1 id="prototype-title">Intrusive Thoughts</h1>
        <p className="runtime-status">Controller status: {status}</p>
        {!api && <p role="alert">Secure preload bridge unavailable.</p>}
        <div className="diagnostic-actions">
          <button type="button" onClick={() => void start()} disabled={!api || Boolean(run)}>
            Start bare embodiment
          </button>
          <button type="button" onClick={() => void reset()} disabled={!api}>
            Reset / new run
          </button>
          <button
            type="button"
            onClick={() => run && void api?.cancelTurn({ runId: run.runId })}
            disabled={!run || status !== 'running_turn'}
          >
            Cancel turn
          </button>
          <button type="button" onClick={() => void refreshRuns()} disabled={!api}>
            List stored runs
          </button>
        </div>
        {run && <p className="run-id">Run: {run.runId}</p>}
        <form onSubmit={submit} className="diagnostic-form">
          <label htmlFor="player-message">Player message</label>
          <input
            id="player-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!run || status !== 'awaiting_player'}
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={!run || status !== 'awaiting_player' || !input.trim()}
          >
            Send
          </button>
        </form>
        <pre className="diagnostic-output" aria-live="polite">{output || '—'}</pre>
        {error && <p role="alert" className="diagnostic-error">{error}</p>}
        {storedRuns.length > 0 && (
          <ul className="stored-runs">
            {storedRuns.map((stored) => (
              <li key={stored.runId}>
                <button
                  type="button"
                  onClick={() => void api?.loadReplay({ runId: stored.runId })}
                >
                  Replay {stored.runId}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
