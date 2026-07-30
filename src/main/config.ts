import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'

import type {
  JudgeGateway,
  JudgeGatewayRequest,
  JudgeGatewayResult,
  ModelGateway,
  ModelGatewayRequest,
  NormalizedModelEvent
} from './agent'
import {
  OpenAIJudgeGateway,
  OpenAIResponsesGateway,
  resolveJudgeResult
} from './agent'

export type GatewayMode = 'live' | 'fake'

export interface ApplicationConfiguration {
  dataRoot: string
  gatewayMode: GatewayMode
  createGateway: () => ModelGateway
  createJudgeGateway: () => JudgeGateway
  secretsToRedact: readonly string[]
}

export interface ApplicationConfigurationOptions {
  userDataPath: string
  environment?: NodeJS.ProcessEnv
  dataRoot?: string
}

class DiagnosticFakeGateway implements ModelGateway {
  readonly model = 'fake-diagnostic-model'

  async *stream(
    request: ModelGatewayRequest
  ): AsyncIterable<NormalizedModelEvent> {
    if (request.signal.aborted) throw request.signal.reason
    const responseId = `fake-${randomUUID()}`
    yield {
      type: 'response.metadata',
      responseId,
      providerRequestId: `local-${responseId}`,
      model: this.model
    }
    yield {
      type: 'text.delta',
      delta: 'I can hear you. I am beginning with what is immediately available.',
      refusal: false
    }
    yield {
      type: 'usage',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    }
    yield { type: 'response.completed' }
  }
}

/**
 * The diagnostic mode's judge: a deterministic, model-free label matcher, so the
 * address path is exercisable locally without an API key.
 *
 * It is maximally permissive — it always asserts the catalog target — and that
 * is safe by construction rather than by luck: the gate measures over
 * `cited ∩ gathered`, so a judge that cites everything and asserts everything
 * yields `effective = gathered`, which is the same permissiveness as no judge at
 * all. §1.1's bound is exactly this case.
 */
class DiagnosticFakeJudgeGateway implements JudgeGateway {
  readonly model = 'fake-diagnostic-judge'
  readonly promptVersion = 'diagnostic-fake-judge-v1'

  async judge(request: JudgeGatewayRequest): Promise<JudgeGatewayResult> {
    if (request.signal.aborted) throw request.signal.reason
    const claim = request.claim.toLowerCase()
    const citedAnchorIds = request.anchorCatalog
      .filter((anchor) =>
        claim.includes(anchor.label.replace(/^the /i, '').toLowerCase())
      )
      .map((anchor) => anchor.id)
    return resolveJudgeResult(request, {
      coherent: claim.trim().length > 0,
      assertedTargetId: request.identity.id,
      citedAnchorIds,
      reason: 'diagnostic fake judge: label substring match'
    })
  }
}

export function createApplicationConfiguration(
  options: ApplicationConfigurationOptions
): ApplicationConfiguration {
  const environment = options.environment ?? process.env
  const requestedMode = environment.INTRUSIVE_THOUGHTS_GATEWAY?.trim().toLowerCase()
  const gatewayMode: GatewayMode = requestedMode === 'fake' ? 'fake' : 'live'
  const dataRoot = resolve(
    options.dataRoot ??
      environment.INTRUSIVE_THOUGHTS_DATA_ROOT ??
      join(options.userDataPath, 'prototype-data')
  )
  const secretsToRedact = [
    environment.OPENAI_API_KEY?.trim(),
    environment.OPENROUTER_API_KEY?.trim()
  ].filter((value): value is string => Boolean(value))

  return {
    dataRoot,
    gatewayMode,
    secretsToRedact,
    createGateway:
      gatewayMode === 'fake'
        ? () => new DiagnosticFakeGateway()
        : () => OpenAIResponsesGateway.fromEnvironment(environment),
    // The judge follows the same mode switch, and in live mode reads
    // `JUDGE_MODEL` if it is set — a different job with a much shorter latency
    // budget, plausibly a much smaller model (D-3).
    createJudgeGateway:
      gatewayMode === 'fake'
        ? () => new DiagnosticFakeJudgeGateway()
        : () => OpenAIJudgeGateway.fromEnvironment(environment)
  }
}
