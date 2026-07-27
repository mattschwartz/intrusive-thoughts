import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from 'react'

export interface PlayerComposerProps {
  disabled: boolean
  isRunning: boolean
  cancellationRequested: boolean
  inputLimit: number
  focusRequest: number
  onSubmit(text: string): void
  onCancel(): void
}

export function PlayerComposer({
  disabled,
  isRunning,
  cancellationRequested,
  inputLimit,
  focusRequest,
  onSubmit,
  onCancel
}: PlayerComposerProps): React.JSX.Element {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const remaining = inputLimit - text.length
  const showRemaining = remaining <= Math.min(500, Math.ceil(inputLimit * 0.15))

  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled, focusRequest])

  const submit = (): void => {
    if (disabled || text.trim().length === 0) return
    const verbatimText = text
    setText('')
    onSubmit(verbatimText)
  }

  const onFormSubmit = (event: FormEvent): void => {
    event.preventDefault()
    submit()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className="composer" onSubmit={onFormSubmit}>
      <label htmlFor="player-input">
        <span>Operator input</span>
        <span className="input-instruction">ENTER / SEND · SHIFT+ENTER / LINE</span>
      </label>
      <div className="composer-field">
        <span className="input-prompt" aria-hidden="true">
          &gt;
        </span>
        <textarea
          id="player-input"
          ref={inputRef}
          value={text}
          rows={3}
          maxLength={inputLimit}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck="true"
        />
        {showRemaining && (
          <span className="remaining-count" aria-live="polite">
            {remaining} remaining
          </span>
        )}
      </div>
      <div className="composer-actions">
        {isRunning ? (
          <button
            className="cancel-action"
            type="button"
            disabled={cancellationRequested}
            onClick={onCancel}
          >
            {cancellationRequested ? 'Interrupting…' : 'Interrupt response'}
          </button>
        ) : (
          <button
            className="send-action"
            type="submit"
            disabled={disabled || text.trim().length === 0}
          >
            Transmit
          </button>
        )}
      </div>
    </form>
  )
}
