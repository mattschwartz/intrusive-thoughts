import type { InspectableModelInput } from './model-input'
import type {
  ModelHistoryItem,
  NormalizedModelEvent
} from './stream-events'

export interface ModelGatewayRequest {
  input: InspectableModelInput
  history: readonly ModelHistoryItem[]
  signal: AbortSignal
}

export interface ModelGateway {
  readonly model: string
  stream(request: ModelGatewayRequest): AsyncIterable<NormalizedModelEvent>
}
