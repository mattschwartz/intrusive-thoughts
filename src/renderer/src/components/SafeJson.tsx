const SECRET_KEY =
  /api[\s_.-]*key|authorization|access[\s_.-]*token|auth[\s_.-]*token|secret/i
const HIDDEN_REASONING_KEY = /reasoning|encrypted[\s_.-]*content/i

export function sanitizeForDisplay(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(
      /\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})\b/gi,
      '[REDACTED]'
    )
  }
  if (Array.isArray(value)) return value.map(sanitizeForDisplay)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !HIDDEN_REASONING_KEY.test(key))
      .map(([key, child]) => [
        key,
        SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeForDisplay(child)
      ])
  )
}

export function safeJsonText(value: unknown): string {
  try {
    return JSON.stringify(sanitizeForDisplay(value), null, 2)
  } catch {
    return String(value)
  }
}

export function SafeJson({
  value,
  label
}: {
  value: unknown
  label?: string
}): React.JSX.Element {
  return (
    <pre className="safe-json" aria-label={label}>
      {safeJsonText(value)}
    </pre>
  )
}
