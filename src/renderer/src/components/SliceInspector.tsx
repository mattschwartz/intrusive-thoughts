import type {
  DeveloperSnapshot,
  KnownGameEvent,
  ProvenanceAddressEvaluatedEvent
} from '../../../shared'

/**
 * The three things a v1 run has to be readable by, and that raw canonical JSON
 * does not make readable: where the run is standing in the room graph, what the
 * relationship axes are actually doing, and what the last address was graded
 * on.
 *
 * Task #538, acceptance criterion 3. Everything here is out of fiction and
 * developer-only — the provenance panel in particular shows the candidate
 * anchor set, which is the answer key, and must never reach the agent or the
 * player (§1.6).
 */

/**
 * The most recent verdict at or before the selected event.
 *
 * Selection-aware for the same reason the context panel is: stepping back
 * through a replay and seeing the *final* verdict beside an earlier turn is a
 * quiet way to misread a bounce as an open.
 */
export function verdictForSelection(
  events: readonly KnownGameEvent[],
  selectedEventId?: string
): ProvenanceAddressEvaluatedEvent | undefined {
  const selected = events.find((event) => event.id === selectedEventId)
  return [...events]
    .reverse()
    .find(
      (event): event is ProvenanceAddressEvaluatedEvent =>
        event.type === 'provenance.address.evaluated' &&
        (!selected || event.sequence <= selected.sequence)
    )
}

function PositionPanel({
  position
}: {
  position: DeveloperSnapshot['position']
}): React.JSX.Element {
  return (
    <article>
      <h4>Room position</h4>
      <dl className="diagnostic-grid">
        <div>
          <dt>Room</dt>
          <dd>
            {position.roomLabel} (<code>{position.roomId}</code>)
          </dd>
        </div>
        <div>
          <dt>Revealed exits</dt>
          <dd>{position.thresholds.length}</dd>
        </div>
      </dl>
      {position.thresholds.length === 0 ? (
        <p className="developer-note">No revealed exits from this room.</p>
      ) : (
        <ul className="threshold-list">
          {position.thresholds.map((threshold) => (
            <li key={threshold.id}>
              <code>{threshold.id}</code> → <code>{threshold.toRoomId}</code>
              {' — '}
              {threshold.passable
                ? 'passable'
                : threshold.requiresAddress
                  ? 'gated: requires an accepted address'
                  : 'gated'}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function AxesPanel({
  axes
}: {
  axes: DeveloperSnapshot['axes']
}): React.JSX.Element {
  const rows = [
    ['Competence', axes.competence],
    ['Honesty', axes.honesty],
    ['Care', axes.care]
  ] as const
  return (
    <article>
      <h4>Relationship axes</h4>
      <p className="developer-note">
        The number is developer-only. The agent is shown the band line and never
        a value.
      </p>
      <dl className="diagnostic-grid">
        {rows.map(([label, axis]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {axis.value >= 0 ? `+${axis.value}` : axis.value} — {axis.band}
              <span className="band-line">{axis.line}</span>
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function ProvenancePanel({
  verdict
}: {
  verdict?: ProvenanceAddressEvaluatedEvent
}): React.JSX.Element {
  if (!verdict) {
    return (
      <article>
        <h4>Provenance verdict</h4>
        <p className="developer-note">No address has been evaluated in this run.</p>
      </article>
    )
  }
  const payload = verdict.payload
  const { gate, judge } = payload
  return (
    <article>
      <h4>Provenance verdict</h4>
      <dl className="diagnostic-grid">
        <div>
          <dt>Threshold / identity</dt>
          <dd>
            <code>{payload.thresholdId}</code> / <code>{payload.identityId}</code>
          </dd>
        </div>
        <div>
          <dt>Outcome</dt>
          <dd>
            {payload.outcome}
            {payload.bounceReason ? ` — ${payload.bounceReason}` : ''}
          </dd>
        </div>
        <div>
          <dt>Gate</dt>
          <dd>
            {gate.verdict}, measured over {gate.measuredOver}
          </dd>
        </div>
        {/* Risk R1: a verdict with no judge behind it was graded more
            permissively, and that is invisible from the outcome alone. */}
        <div>
          <dt>Judge</dt>
          <dd>
            {judge.status}
            {judge.model ? ` (${judge.model})` : ''}
            {judge.status === 'unavailable' || judge.status === 'skipped'
              ? ' — no judge graded this address'
              : ''}
          </dd>
        </div>
        <div>
          <dt>Missing dimensions</dt>
          <dd>{gate.missingDimensions.join(', ') || 'none'}</dd>
        </div>
        <div>
          <dt>Gathered anchors</dt>
          <dd>{gate.gatheredAnchorIds.join(', ') || 'none'}</dd>
        </div>
        <div>
          <dt>Effective anchors</dt>
          <dd>{gate.effectiveAnchorIds.join(', ') || 'none'}</dd>
        </div>
        <div>
          <dt>Candidate anchors</dt>
          <dd>{gate.candidateAnchorIds.join(', ') || 'none'}</dd>
        </div>
        <div>
          <dt>Ruleset</dt>
          <dd>
            <code>{gate.rulesetVersion}</code>
          </dd>
        </div>
      </dl>
      <p className="developer-note">
        Candidate anchors are the answer key. They are developer-visible only and
        never reach the agent or the player.
      </p>
    </article>
  )
}

export function SliceInspector({
  snapshot,
  events,
  selectedEventId
}: {
  snapshot: DeveloperSnapshot
  events: readonly KnownGameEvent[]
  selectedEventId?: string
}): React.JSX.Element {
  return (
    <section className="developer-section" aria-labelledby="slice-inspector-heading">
      <h3 id="slice-inspector-heading">Slice state</h3>
      <p className="developer-note">
        Position in the room graph, the banded relationship axes, and the most
        recent address verdict. Out of fiction; opening this changes nothing.
      </p>
      <div className="state-comparison">
        <PositionPanel position={snapshot.position} />
        <AxesPanel axes={snapshot.axes} />
        <ProvenancePanel verdict={verdictForSelection(events, selectedEventId)} />
      </div>
    </section>
  )
}
