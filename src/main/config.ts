import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'

import type {
  ModelGateway,
  ModelGatewayRequest,
  NormalizedModelEvent
} from './agent'
import { OpenAIResponsesGateway } from './agent'

export type GatewayMode = 'live' | 'fake'

export interface ApplicationConfiguration {
  dataRoot: string
  gatewayMode: GatewayMode
  createGateway: () => ModelGateway
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

  return {
    dataRoot,
    gatewayMode,
    secretsToRedact: [
      ...(environment.OPENAI_API_KEY ? [environment.OPENAI_API_KEY] : [])
    ],
    createGateway:
      gatewayMode === 'fake'
        ? () => new DiagnosticFakeGateway()
        : () => OpenAIResponsesGateway.fromEnvironment(environment)
  }
}
