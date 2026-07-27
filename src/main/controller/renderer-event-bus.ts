import {
  rendererEventSchema,
  type RendererEvent
} from '../../shared'

export type RendererEventListener = (event: RendererEvent) => void

/**
 * A small process-local fan-out point. Validation here gives every producer a
 * single serialization boundary before an event can reach Electron.
 */
export class RendererEventBus {
  private readonly listeners = new Set<RendererEventListener>()

  emit(rawEvent: RendererEvent): void {
    const event = rendererEventSchema.parse(rawEvent)
    for (const listener of [...this.listeners]) {
      listener(event)
    }
  }

  subscribe(listener: RendererEventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
