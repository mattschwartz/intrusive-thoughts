import type {
  ResponseFunctionToolCall,
  ResponseOutputItem,
  ResponseReasoningItem
} from 'openai/resources/responses/responses'

import type {
  ModelGateway,
  ModelGatewayRequest
} from '../../src/main/agent/model-gateway'
import type {
  ModelHistoryItem,
  ModelUsage,
  NormalizedModelEvent
} from '../../src/main/agent/stream-events'

export interface FakeModelRound {
  events: readonly NormalizedModelEvent[]
  waitForAbort?: boolean
  throwAfterEvents?: unknown
}

export interface CapturedModelRequest {
  input: ModelGatewayRequest['input']
  history: readonly ModelHistoryItem[]
}

export class FakeModelGateway implements ModelGateway {
  readonly requests: CapturedModelRequest[] = []
  private nextRound = 0

  constructor(
    readonly rounds: readonly FakeModelRound[],
    readonly model = 'fake-model'
  ) {}

  async *stream(
    request: ModelGatewayRequest
  ): AsyncIterable<NormalizedModelEvent> {
    const round = this.rounds[this.nextRound++]
    if (!round) {
      throw new Error(`No fake model round scripted for request ${this.nextRound}.`)
    }
    this.requests.push({
      input: request.input,
      history: [...request.history]
    })

    for (const event of round.events) {
      if (request.signal.aborted) throw request.signal.reason
      yield event
    }
    if (round.throwAfterEvents !== undefined) {
      throw round.throwAfterEvents
    }
    if (round.waitForAbort) {
      await new Promise<never>((_resolve, reject) => {
        const rejectFromAbort = () =>
          reject(request.signal.reason ?? new Error('Fake stream aborted.'))
        if (request.signal.aborted) {
          rejectFromAbort()
          return
        }
        request.signal.addEventListener('abort', rejectFromAbort, { once: true })
      })
    }
  }
}

export function fakeFunctionCall(
  callId: string,
  name: string,
  argumentsText: string
): ResponseFunctionToolCall {
  return {
    id: `item-${callId}`,
    type: 'function_call',
    status: 'completed',
    call_id: callId,
    name,
    arguments: argumentsText
  }
}

export function fakeReasoningItem(id: string): ResponseReasoningItem {
  return {
    id,
    type: 'reasoning',
    status: 'completed',
    summary: [],
    encrypted_content: `opaque-${id}`
  }
}

export function metadata(
  responseId: string,
  providerRequestId = `provider-${responseId}`
): NormalizedModelEvent {
  return {
    type: 'response.metadata',
    responseId,
    providerRequestId,
    model: 'fake-model'
  }
}

export function outputItem(
  outputIndex: number,
  item: ResponseOutputItem
): NormalizedModelEvent {
  return {
    type: 'output_item.completed',
    outputIndex,
    item
  }
}

export function textDelta(
  delta: string,
  refusal = false
): NormalizedModelEvent {
  return { type: 'text.delta', delta, refusal }
}

export const TEST_USAGE: ModelUsage = {
  inputTokens: 10,
  outputTokens: 4,
  totalTokens: 14
}

export const completedEvents: readonly NormalizedModelEvent[] = [
  { type: 'usage', usage: TEST_USAGE },
  { type: 'response.completed' }
]
