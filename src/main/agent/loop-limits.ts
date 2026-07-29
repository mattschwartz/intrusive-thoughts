export const DEFAULT_MAX_TOOL_CALLS_PER_TURN = 3
export const DEFAULT_MAX_IDENTICAL_TOOL_CALLS_PER_TURN = 2
export const DEFAULT_TURN_TIMEOUT_MS = 90_000

export interface AgentLoopLimits {
  maxToolCallsPerTurn: number
  maxIdenticalToolCallsPerTurn: number
  turnTimeoutMs: number
}

export type AgentLoopLimitOverrides = Partial<AgentLoopLimits>

export function resolveAgentLoopLimits(
  overrides: AgentLoopLimitOverrides = {}
): AgentLoopLimits {
  const limits: AgentLoopLimits = {
    maxToolCallsPerTurn:
      overrides.maxToolCallsPerTurn ?? DEFAULT_MAX_TOOL_CALLS_PER_TURN,
    maxIdenticalToolCallsPerTurn:
      overrides.maxIdenticalToolCallsPerTurn ??
      DEFAULT_MAX_IDENTICAL_TOOL_CALLS_PER_TURN,
    turnTimeoutMs: overrides.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS
  }

  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive integer.`)
    }
  }
  return limits
}
