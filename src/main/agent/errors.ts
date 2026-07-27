export class AgentLoopError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly recoverable = true
  ) {
    super(message)
    this.name = 'AgentLoopError'
  }
}

export class AgentConfigurationError extends AgentLoopError {
  constructor(message: string) {
    super('configuration_error', message, true)
    this.name = 'AgentConfigurationError'
  }
}

export function safeErrorMessage(
  error: unknown,
  secrets: readonly string[] = []
): string {
  let message = error instanceof Error ? error.message : String(error)
  for (const secret of secrets) {
    if (secret.length > 0) {
      message = message.split(secret).join('[REDACTED]')
    }
  }
  return message
    .replace(
      /\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/=-]{8,})\b/gi,
      '[REDACTED]'
    )
    .slice(0, 2_000)
}
