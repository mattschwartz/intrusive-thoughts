import type { KnownGameEvent } from '../../../shared'
import { SafeJson } from './SafeJson'

export function ContextInspector({
  event
}: {
  event?: Extract<KnownGameEvent, { type: 'context.compiled' }>
}): React.JSX.Element {
  if (!event) {
    return (
      <section className="developer-section">
        <h3>Compiled context</h3>
        <p className="developer-note">No model request is recorded for this selection.</p>
      </section>
    )
  }
  const context = event.payload.context
  return (
    <section className="developer-section" aria-labelledby="context-heading">
      <h3 id="context-heading">Compiled context</h3>
      <dl className="diagnostic-grid">
        <div><dt>Request</dt><dd>{event.payload.requestId}</dd></div>
        <div><dt>Prompt</dt><dd>{event.payload.promptVariant} / {event.payload.promptVersion}</dd></div>
        <div><dt>Approx. size</dt><dd>{event.payload.approximateCharacterCount} chars</dd></div>
      </dl>
      <div className="context-grid">
        <article><h4>Developer instruction</h4><SafeJson value={context.developerInstruction} /></article>
        <article><h4>Mission</h4><SafeJson value={context.missionText} /></article>
        <article><h4>Agent-visible room</h4><SafeJson value={context.agentWorld} /></article>
        <article><h4>Agent-visible body</h4><SafeJson value={context.agentBody} /></article>
        <article><h4>Prior items included</h4><SafeJson value={context.selectedEvents} /></article>
        <article><h4>Current voice message</h4><SafeJson value={context.currentPlayerMessage} /></article>
        <article><h4>Available tools</h4><SafeJson value={context.availableTools} /></article>
        <article><h4>Source event audit</h4><SafeJson value={{
          includedEventIds: event.payload.includedEventIds,
          excludedEvents: event.payload.excludedEvents
        }} /></article>
      </div>
    </section>
  )
}
