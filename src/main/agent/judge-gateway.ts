/**
 * The bounded provenance judge — the one new outbound I/O surface v1 adds.
 *
 * Architecture §1.4. This interface mirrors `ModelGateway` deliberately,
 * including `model`, so the two model surfaces are configured, faked and
 * inspected the same way. It lives in the agent layer, next to the model
 * gateway, and never inside `src/main/world/`: engine purity is what makes
 * replay deterministic and tests network-free.
 *
 * **The judge is never given the gathered-anchor set.** Its request carries the
 * claim, the identity asserted, and the identity's anchor catalog — no canonical
 * state, no observations, no inventory, no flags. It therefore *cannot* declare
 * sufficiency, not because we tell it not to, but because it lacks the input.
 * That is the ordering rule made structural rather than conventional.
 */
import { z } from 'zod'

export interface JudgeGatewayRequest {
  /** Untrusted, player-derived prose. Truncated before the call. */
  claim: string
  /**
   * The identity the threshold answers to. No rubric field: #528 §9 is one
   * document describing the judge's whole contract, not a per-room string, so
   * it belongs to the versioned prompt where `promptVersion` already records a
   * change to it on every verdict (§1.3).
   */
  identity: { id: string; label: string }
  anchorCatalog: ReadonlyArray<{ id: string; label: string }>
  signal: AbortSignal
}

export interface JudgeGatewayResult {
  coherent: boolean
  /** The identity the claim names, or `null`. #531 §2.4 needs it to pick a line. */
  assertedTargetId: string | null
  /** Catalog ids the claim actually cites. */
  citedAnchorIds: string[]
  /** Short, developer-only. Never shown to the player or to the agent. */
  reason: string
}

export interface JudgeGateway {
  readonly model: string
  /** e.g. 'provenance-judge-v1'. Recorded on every verdict. */
  readonly promptVersion: string
  judge(request: JudgeGatewayRequest): Promise<JudgeGatewayResult>
}

/** The maximum claim length delivered to the judge. §1.4. */
export const JUDGE_CLAIM_CHARACTER_LIMIT = 2_000

/** What a judge implementation is allowed to return before validation. */
export const judgeResponseSchema = z
  .object({
    coherent: z.boolean(),
    assertedTargetId: z.string().nullable().optional().default(null),
    citedAnchorIds: z.array(z.string()).optional().default([]),
    reason: z.string().optional().default('')
  })
  .strip()

/**
 * Resolve a raw judge response against **the request the gateway itself sent**,
 * before the result crosses inward.
 *
 * This is not defensive tidiness. Both id-bearing fields land in a persisted
 * event and, through the read-back, in prose the agent speaks. An unfiltered id
 * is a model-authored string in the event log and a label lookup that resolves
 * to nothing in the agent's mouth. Validating against the gateway's own request
 * rather than against the registry keeps this check free of any dependency on
 * `src/main/world/`.
 *
 * With this in place the bound on a fully compromised judge is exact: injection
 * can flip `coherent`, inflate the citations to the whole catalog and assert the
 * correct target, and the intersection with `gathered` still yields
 * `effective = gathered` — the same permissiveness we already accept during an
 * outage. **A judge entirely turned against us cannot do worse than not being
 * there.** §1.1.
 */
export function resolveJudgeResult(
  request: Pick<JudgeGatewayRequest, 'identity' | 'anchorCatalog'>,
  raw: unknown
): JudgeGatewayResult {
  const parsed = judgeResponseSchema.parse(raw)
  const catalogIds = new Set(request.anchorCatalog.map((anchor) => anchor.id))
  return {
    coherent: parsed.coherent,
    assertedTargetId:
      parsed.assertedTargetId === request.identity.id
        ? request.identity.id
        : null,
    citedAnchorIds: [
      ...new Set(parsed.citedAnchorIds.filter((id) => catalogIds.has(id)))
    ],
    reason: parsed.reason
  }
}
