/**
 * The live provenance judge. Architecture §1.4, decision D-3.
 *
 * A separate model configuration from the narrating agent: different job, much
 * shorter latency budget, plausibly a much smaller model. `JUDGE_MODEL`
 * overrides the model for this surface only; provider, key and base URL are
 * shared with the narrating gateway so there is one place to configure a
 * provider.
 *
 * Every failure mode here is the caller's `unavailable` verdict: this class
 * throws, and `AgentLoop` converts any throw into `status: 'unavailable'`. A
 * judge outage must not break the run — the security property lives entirely in
 * the gate, and failing closed would make the only ending unreachable during a
 * provider blip.
 */
import OpenAI from 'openai'

import { AgentConfigurationError } from './errors'
import {
  JUDGE_CLAIM_CHARACTER_LIMIT,
  resolveJudgeResult,
  type JudgeGateway,
  type JudgeGatewayRequest,
  type JudgeGatewayResult
} from './judge-gateway'
import {
  readOpenAIResponsesConfiguration,
  type OpenAIResponsesConfiguration
} from './openai-responses-gateway'
import {
  PROVENANCE_JUDGE_INSTRUCTION,
  PROVENANCE_JUDGE_PROMPT_VERSION,
  renderJudgePrompt
} from './prompts/provenance-judge'

export interface OpenAIJudgeGatewayOptions extends OpenAIResponsesConfiguration {
  client?: OpenAI
}

export function readJudgeConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): OpenAIResponsesConfiguration {
  const base = readOpenAIResponsesConfiguration(environment)
  const judgeModel = environment.JUDGE_MODEL?.trim()
  return judgeModel ? { ...base, model: judgeModel } : base
}

/**
 * Pull the JSON object out of a model reply. Models fence, prefix and apologise;
 * none of that is worth an `unavailable` verdict, but anything genuinely
 * unparseable is.
 */
export function extractJudgeJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('The judge reply contained no JSON object.')
  }
  return JSON.parse(text.slice(start, end + 1)) as unknown
}

export class OpenAIJudgeGateway implements JudgeGateway {
  readonly model: string
  readonly promptVersion = PROVENANCE_JUDGE_PROMPT_VERSION

  private readonly client: OpenAI

  constructor(options: OpenAIJudgeGatewayOptions) {
    const apiKey = options.apiKey.trim()
    const model = options.model.trim()
    if (!apiKey || !model) {
      throw new AgentConfigurationError(
        'OpenAIJudgeGateway requires both an API key and a model.'
      )
    }
    this.model = model
    this.client =
      options.client ??
      new OpenAI({
        apiKey,
        ...(options.baseURL ? { baseURL: options.baseURL } : {}),
        ...(options.defaultHeaders
          ? { defaultHeaders: options.defaultHeaders }
          : {})
      })
  }

  static fromEnvironment(
    environment: NodeJS.ProcessEnv = process.env
  ): OpenAIJudgeGateway {
    return new OpenAIJudgeGateway(readJudgeConfiguration(environment))
  }

  async judge(request: JudgeGatewayRequest): Promise<JudgeGatewayResult> {
    // Truncated *before* the call, so a 40 000-character claim cannot be used to
    // push the instruction block out of the model's attention.
    const claim = request.claim.slice(0, JUDGE_CLAIM_CHARACTER_LIMIT)
    const response = await this.client.responses.create(
      {
        model: this.model,
        input: [
          {
            type: 'message',
            role: 'developer',
            content: PROVENANCE_JUDGE_INSTRUCTION
          },
          {
            type: 'message',
            role: 'user',
            content: renderJudgePrompt({
              claim,
              identity: request.identity,
              anchorCatalog: request.anchorCatalog
            })
          }
        ],
        stream: false,
        store: false
      },
      { signal: request.signal }
    )

    // Validated against the request this gateway itself sent, before the result
    // crosses inward. Without it a model-authored string lands in the persisted
    // event log and in a label lookup the agent then speaks aloud. §1.4.
    return resolveJudgeResult(request, extractJudgeJson(response.output_text))
  }
}
