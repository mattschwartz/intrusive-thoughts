import type { TranscriptEntryState } from '../hooks/useGameController'

export interface TranscriptEntryProps {
  entry: TranscriptEntryState
}

export function TranscriptEntry({
  entry
}: TranscriptEntryProps): React.JSX.Element {
  return (
    <article
      className={`transcript-entry channel-${entry.channel} effect-${entry.effect}`}
      data-complete={entry.complete}
    >
      <header>
        <span className="channel-mark" aria-hidden="true">
          {entry.channel === 'agent'
            ? '◈'
            : entry.channel === 'player'
              ? '›'
              : entry.channel === 'reflection'
                ? '※'
                : '—'}
        </span>
        <span>{entry.label}</span>
      </header>
      <p>{entry.text}</p>
      {!entry.complete && (
        <span className="stream-cursor" aria-label="Response in progress" />
      )}
    </article>
  )
}
