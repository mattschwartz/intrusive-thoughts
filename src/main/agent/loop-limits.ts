export const DEFAULT_MAX_TOOL_CALLS_PER_TURN = 3
export const DEFAULT_MAX_IDENTICAL_TOOL_CALLS_PER_TURN = 2
export const DEFAULT_TURN_TIMEOUT_MS = 90_000
/**
 * The judge gets its own budget, well inside the turn's: it is a small,
 * structured, single-shot call, and a slow one must degrade to `unavailable`
 * rather than spend the turn. Composed with the turn abort signal. §1.5.
 */
export const DEFAULT_JUDGE_TIMEOUT_MS = 20_000

export interface AgentLoopLimits {
  maxToolCallsPerTurn: number
  maxIdenticalToolCallsPerTurn: number
  turnTimeoutMs: number
  judgeTimeoutMs: number
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
    turnTimeoutMs: overrides.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS,
    judgeTimeoutMs: overrides.judgeTimeoutMs ?? DEFAULT_JUDGE_TIMEOUT_MS
  }

  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive integer.`)
    }
  }
  return limits
}
