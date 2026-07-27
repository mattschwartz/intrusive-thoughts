import type {
  ResponseInputItem,
  ResponseOutputItem
} from 'openai/resources/responses/responses'

export interface ModelUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type ModelHistoryItem = ResponseInputItem | ResponseOutputItem

export type NormalizedModelEvent =
  | {
      type: 'response.metadata'
      responseId?: string
      providerRequestId?: string
      model?: string
    }
  | {
      type: 'text.delta'
      delta: string
      refusal: boolean
    }
  | {
      type: 'refusal.completed'
      text: string
    }
  | {
      type: 'output_item.completed'
      outputIndex: number
      item: ResponseOutputItem
    }
  | {
      type: 'usage'
      usage: ModelUsage
    }
  | {
      type: 'response.failed'
      code: string
      message: string
    }
  | {
      type: 'response.completed'
    }

export function isFunctionCallItem(
  item: ResponseOutputItem
): item is Extract<ResponseOutputItem, { type: 'function_call' }> {
  return item.type === 'function_call'
}
