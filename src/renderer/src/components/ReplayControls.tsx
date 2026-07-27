import type { ReplayPlaybackState } from '../hooks/useGameController'

export function ReplayControls({
  replay,
  onPlayPause,
  onStep,
  onRestart,
  onSpeed
}: {
  replay?: ReplayPlaybackState
  onPlayPause(playing: boolean): void
  onStep(): void
  onRestart(): void
  onSpeed(speed: ReplayPlaybackState['speed']): void
}): React.JSX.Element | null {
  if (!replay) return null
  const playing = replay.playbackStatus === 'playing'
  const blocked =
    replay.playbackStatus === 'loading' ||
    replay.playbackStatus === 'complete'
  return (
    <section className="replay-controls" aria-label="Replay controls">
      <div>
        <strong>REPLAY</strong>
        <span>
          {replay.position} / {replay.eventCount} · {replay.playbackStatus}
        </span>
      </div>
      <button type="button" onClick={onRestart}>Restart</button>
      <button type="button" disabled={blocked} onClick={() => onPlayPause(!playing)}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" disabled={blocked || playing} onClick={onStep}>
        Step
      </button>
      <label>
        Speed
        <select
          value={replay.speed}
          onChange={(event) =>
            onSpeed(Number(event.currentTarget.value) as ReplayPlaybackState['speed'])
          }
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
        </select>
      </label>
    </section>
  )
}
