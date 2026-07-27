import OpenAI from 'openai'
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems'
import type {
  EasyInputMessage,
  FunctionTool,
  Response
} from 'openai/resources/responses/responses'

import { AgentConfigurationError } from './errors'
import type { ModelGateway, ModelGatewayRequest } from './model-gateway'
import type { ModelUsage, NormalizedModelEvent } from './stream-events'

export interface OpenAIResponsesConfiguration {
  apiKey: string
  model: string
}

export interface OpenAIResponsesGatewayOptions
  extends OpenAIResponsesConfiguration {
  client?: OpenAI
}

export function readOpenAIResponsesConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): OpenAIResponsesConfiguration {
  const apiKey = environment.OPENAI_API_KEY?.trim()
  const model = environment.OPENAI_MODEL?.trim()
  const missing = [
    ...(apiKey ? [] : ['OPENAI_API_KEY']),
    ...(model ? [] : ['OPENAI_MODEL'])
  ]
  if (missing.length > 0) {
    throw new AgentConfigurationError(
      `Live agent configuration is missing ${missing.join(' and ')}.`
    )
  }
  if (!apiKey || !model) {
    throw new AgentConfigurationError('Live agent configuration is incomplete.')
  }
  return { apiKey, model }
}

function normalizeUsage(response: Response): ModelUsage | undefined {
  if (!response.usage) return undefined
  return {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.total_tokens
  }
}

function responseFailure(response: Response): {
  code: string
  message: string
} {
  if (response.error) {
    return {
      code: response.error.code ?? 'provider_response_failed',
      message: response.error.message
    }
  }
  const incompleteReason = response.incomplete_details?.reason
  return {
    code:
      incompleteReason === 'content_filter'
        ? 'provider_content_filter'
        : 'provider_response_incomplete',
    message: incompleteReason
      ? `The model response was incomplete: ${incompleteReason}.`
      : 'The model response ended without completing.'
  }
}

export class OpenAIResponsesGateway implements ModelGateway {
  readonly model: string

  private readonly client: OpenAI

  constructor(options: OpenAIResponsesGatewayOptions) {
    const apiKey = options.apiKey.trim()
    const model = options.model.trim()
    if (!apiKey || !model) {
      throw new AgentConfigurationError(
        'OpenAIResponsesGateway requires both an API key and a model.'
      )
    }
    this.model = model
    this.client = options.client ?? new OpenAI({ apiKey })
  }

  static fromEnvironment(
    environment: NodeJS.ProcessEnv = process.env
  ): OpenAIResponsesGateway {
    return new OpenAIResponsesGateway(
      readOpenAIResponsesConfiguration(environment)
    )
  }

  async *stream(
    request: ModelGatewayRequest
  ): AsyncIterable<NormalizedModelEvent> {
    const messages: EasyInputMessage[] = request.input.input.map((message) => ({
      type: 'message',
      role: message.role,
      content: message.content
    }))
    const tools: FunctionTool[] = request.input.tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: false
    }))
    const input = [
      ...messages,
      ...toResponseInputItems(request.history)
    ]

    const pending = this.client.responses.create(
      {
        model: this.model,
        input,
        tools,
        stream: true,
        store: false
      },
      { signal: request.signal }
    )
    const { data: stream, request_id: providerRequestId } =
      await pending.withResponse()

    if (providerRequestId) {
      yield {
        type: 'response.metadata',
        providerRequestId
      }
    }

    for await (const event of stream) {
      switch (event.type) {
        case 'response.created':
          yield {
            type: 'response.metadata',
            responseId: event.response.id,
            model: event.response.model
          }
          break
        case 'response.output_text.delta':
          yield {
            type: 'text.delta',
            delta: event.delta,
            refusal: false
          }
          break
        case 'response.refusal.delta':
          yield {
            type: 'text.delta',
            delta: event.delta,
            refusal: true
          }
          break
        case 'response.refusal.done':
          yield {
            type: 'refusal.completed',
            text: event.refusal
          }
          break
        case 'response.output_item.done':
          yield {
            type: 'output_item.completed',
            outputIndex: event.output_index,
            item: event.item
          }
          break
        case 'response.completed': {
          yield {
            type: 'response.metadata',
            responseId: event.response.id,
            model: event.response.model
          }
          const usage = normalizeUsage(event.response)
          if (usage) yield { type: 'usage', usage }
          yield { type: 'response.completed' }
          break
        }
        case 'response.failed':
        case 'response.incomplete': {
          yield {
            type: 'response.metadata',
            responseId: event.response.id,
            model: event.response.model
          }
          const usage = normalizeUsage(event.response)
          if (usage) yield { type: 'usage', usage }
          yield {
            type: 'response.failed',
            ...responseFailure(event.response)
          }
          return
        }
        case 'error':
          yield {
            type: 'response.failed',
            code: event.code ?? 'provider_stream_error',
            message: event.message
          }
          return
      }
    }
  }
}
