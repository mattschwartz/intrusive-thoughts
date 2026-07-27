import { useEffect, useRef } from 'react'

import type { TranscriptEntryState } from '../hooks/useGameController'
import { TranscriptEntry } from './TranscriptEntry'

export interface TranscriptProps {
  entries: TranscriptEntryState[]
}

export function Transcript({ entries }: TranscriptProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const followsTail = useRef(true)
  const lastEntry = entries.at(-1)

  useEffect(() => {
    const node = scrollRef.current
    if (node && followsTail.current) {
      node.scrollTop = node.scrollHeight
    }
  }, [entries.length, lastEntry?.text])

  return (
    <div
      className="transcript"
      ref={scrollRef}
      role="log"
      aria-label="Exchange transcript"
      aria-live="off"
      onScroll={(event) => {
        const node = event.currentTarget
        followsTail.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 96
      }}
    >
      {entries.length === 0 ? (
        <div className="transcript-empty">
          <span aria-hidden="true">⌁</span>
          <p>Channel open. No exchange recorded.</p>
        </div>
      ) : (
        entries.map((entry) => (
          <TranscriptEntry entry={entry} key={entry.id} />
        ))
      )}
    </div>
  )
}
