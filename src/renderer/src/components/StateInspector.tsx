import type { DeveloperSnapshot } from '../../../shared'
import { SafeJson } from './SafeJson'

export function StateInspector({
  snapshot
}: {
  snapshot: DeveloperSnapshot
}): React.JSX.Element {
  return (
    <section className="developer-section" aria-labelledby="state-inspector-heading">
      <h3 id="state-inspector-heading">State comparison</h3>
      <p className="developer-note">
        Canonical truth and audience projections are separate records. Compare
        body and limb fields across columns.
      </p>
      <div className="state-comparison">
        <article>
          <h4>Canonical engine state</h4>
          <SafeJson value={snapshot.canonicalState} label="Canonical engine state JSON" />
        </article>
        <article>
          <h4>Agent-visible projection</h4>
          <SafeJson
            value={{ world: snapshot.agentWorld, body: snapshot.agentBody }}
            label="Agent-visible state JSON"
          />
        </article>
        <article>
          <h4>Player-visible projection</h4>
          <SafeJson value={snapshot.playerScene} label="Player-visible state JSON" />
        </article>
      </div>
    </section>
  )
}
