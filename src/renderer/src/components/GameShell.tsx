import type { PromptVariant } from '../../../shared'
import type { GameControllerModel } from '../hooks/useGameController'
import { FieldRecord } from './FieldRecord'
import { PlayerComposer } from './PlayerComposer'
import { Transcript } from './Transcript'

const variants: ReadonlyArray<{
  id: PromptVariant
  code: string
  name: string
  description: string
}> = [
  {
    id: 'bare_embodiment',
    code: 'A',
    name: 'Baseline',
    description: 'Minimal contextual framing.'
  },
  {
    id: 'corporate_self_preservation',
    code: 'B',
    name: 'Continuity',
    description: 'Organization-issued operational context.'
  },
  {
    id: 'authored_character',
    code: 'C',
    name: 'Persona',
    description: 'Authored identity context.'
  }
]

const statusCopy: Record<GameControllerModel['state']['status'], string> = {
  no_run: 'NO ACTIVE RECORD',
  awaiting_player: 'INPUT CHANNEL OPEN',
  running_turn: 'AGENT RESPONSE IN PROGRESS',
  replaying: 'PLAYBACK',
  failed: 'CONNECTION DISRUPTED'
}

export interface GameShellProps {
  controller: GameControllerModel
}

export function GameShell({ controller }: GameShellProps): React.JSX.Element {
  const { state } = controller

  if (!state.run) {
    return (
      <main
        className={`start-screen ${state.reducedMotion ? 'motion-reduced' : ''}`}
      >
        <section className="start-record" aria-labelledby="terminal-title">
          <p className="kicker">REMOTE EMBODIMENT STUDY / ACCESS TERMINAL</p>
          <h1 id="terminal-title">Establish a field record.</h1>
          <p className="start-intro">
            Select an experimental condition, then open the channel.
          </p>
          <fieldset className="variant-grid">
            <legend>Prompt condition</legend>
            {variants.map((variant) => (
              <label
                className="variant-option"
                data-selected={state.selectedVariant === variant.id}
                key={variant.id}
              >
                <input
                  type="radio"
                  name="prompt-variant"
                  value={variant.id}
                  checked={state.selectedVariant === variant.id}
                  onChange={() => controller.selectVariant(variant.id)}
                />
                <span className="variant-code">{variant.code}</span>
                <span>
                  <strong>{variant.name}</strong>
                  <small>{variant.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <button
            className="primary-action"
            type="button"
            disabled={!controller.apiAvailable}
            onClick={() => void controller.startRun()}
          >
            Start record <span aria-hidden="true">↵</span>
          </button>
          {!controller.apiAvailable && (
            <p className="inline-alert" role="alert">
              Secure terminal bridge unavailable.
            </p>
          )}
          {state.transcript
            .filter((entry) => entry.channel === 'error')
            .map((entry) => (
              <p className="inline-alert" role="alert" key={entry.id}>
                {entry.text}
              </p>
            ))}
        </section>
      </main>
    )
  }

  return (
    <main
      className={`game-shell ${state.reducedMotion ? 'motion-reduced' : ''}`}
    >
      <header className="terminal-header">
        <div>
          <p className="kicker">REMOTE EMBODIMENT STUDY</p>
          <p className="run-identity" title={state.run.runId}>
            RUN / {state.run.runId}
          </p>
        </div>
        <div className="run-controls">
          <p className={`controller-status status-${state.status}`}>
            <span aria-hidden="true" className="status-pulse" />
            {statusCopy[state.status]}
          </p>
          <button
            className="quiet-action"
            type="button"
            onClick={() => void controller.resetRun()}
          >
            New record
          </button>
        </div>
      </header>

      <div className="terminal-columns">
        <section className="exchange-panel" aria-labelledby="exchange-heading">
          <h2 id="exchange-heading" className="visually-hidden">
            Field exchange
          </h2>
          <Transcript entries={state.transcript} />
          <PlayerComposer
            disabled={
              state.status !== 'awaiting_player' || !controller.apiAvailable
            }
            isRunning={state.status === 'running_turn'}
            cancellationRequested={state.cancellationRequested}
            inputLimit={controller.inputLimit}
            focusRequest={state.focusRequest}
            onSubmit={controller.submitMessage}
            onCancel={() => void controller.cancelTurn()}
          />
        </section>
        <FieldRecord scene={state.scene} />
      </div>

      <div className="completion-announcer visually-hidden" aria-live="polite">
        {state.completedAnnouncement}
      </div>
    </main>
  )
}
