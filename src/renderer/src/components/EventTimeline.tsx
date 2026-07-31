import type { KnownGameEvent } from '../../../shared'
import { SafeJson } from './SafeJson'

export interface ToolTimelineRecord {
  toolCallId: string
  turnId: string | null
  toolName: string
  arguments: unknown
  validation: 'accepted' | 'rejected' | 'pending'
  result?: string
  domainEvents: KnownGameEvent[]
  durationMs?: number
}

export function buildToolTimeline(
  events: readonly KnownGameEvent[]
): ToolTimelineRecord[] {
  return events
    .filter(
      (event): event is Extract<KnownGameEvent, { type: 'agent.tool.requested' }> =>
        event.type === 'agent.tool.requested'
    )
    .map((requested) => {
      const related = events.filter(
        (event) =>
          (event.type === 'agent.tool.rejected' ||
            event.type === 'world.action.resolved' ||
            event.type === 'agent.private_reflection' ||
            event.type === 'agent.note.recorded') &&
          event.payload.toolCallId === requested.payload.toolCallId
      )
      const rejected = related.find(
        (event) => event.type === 'agent.tool.rejected'
      )
      const resolved = related.find(
        (event) => event.type === 'world.action.resolved'
      )
      const finished = related.at(-1)
      return {
        toolCallId: requested.payload.toolCallId,
        turnId: requested.turnId,
        toolName: requested.payload.toolName,
        arguments: requested.payload.arguments,
        validation: rejected ? 'rejected' : resolved ? 'accepted' : 'pending',
        ...(rejected
          ? { result: rejected.payload.reason }
          : resolved
            ? { result: resolved.payload.modelResult }
            : {}),
        domainEvents: related,
        ...(finished
          ? {
              durationMs: Math.max(
                0,
                Date.parse(finished.timestamp) - Date.parse(requested.timestamp)
              )
            }
          : {})
      } satisfies ToolTimelineRecord
    })
}

function eventCategory(type: KnownGameEvent['type']): string {
  if (type.startsWith('agent.tool') || type === 'world.action.resolved') {
    return 'TOOL'
  }
  // The room acting on its own. Nobody called a tool for this, and reading it
  // in a review as if somebody had would misread the run.
  if (type === 'world.ambient.occurred') return 'ROOM'
  if (type.startsWith('agent.text') || type === 'player.message') return 'VOICE'
  if (type.startsWith('turn.') || type.startsWith('loop.')) return 'LOOP'
  if (type === 'context.compiled') return 'CONTEXT'
  if (type.startsWith('state.') || type.startsWith('run.')) return 'STATE'
  return 'RECORD'
}

export function EventTimeline({
  events,
  selectedEventId,
  selectedToolCallId,
  onSelectEvent,
  onSelectTool
}: {
  events: KnownGameEvent[]
  selectedEventId?: string
  selectedToolCallId?: string
  onSelectEvent(eventId: string): void
  onSelectTool(toolCallId: string): void
}): React.JSX.Element {
  const selectedEvent = events.find((event) => event.id === selectedEventId)
  const tools = buildToolTimeline(events)
  const selectedTool = tools.find(
    (tool) => tool.toolCallId === selectedToolCallId
  )
  return (
    <>
      <section className="developer-section" aria-labelledby="tool-timeline-heading">
        <h3 id="tool-timeline-heading">Tool timeline</h3>
        {tools.length === 0 ? (
          <p className="developer-note">No tool calls recorded.</p>
        ) : (
          <div className="timeline-list">
            {tools.map((tool) => (
              <button
                type="button"
                aria-pressed={selectedToolCallId === tool.toolCallId}
                key={tool.toolCallId}
                onClick={() => onSelectTool(tool.toolCallId)}
              >
                <span>{tool.validation.toUpperCase()}</span>
                <strong>{tool.toolName}</strong>
                <small>{tool.toolCallId}</small>
              </button>
            ))}
          </div>
        )}
        {selectedTool && (
          <SafeJson
            label="Selected tool call details"
            value={{
              toolCallId: selectedTool.toolCallId,
              toolName: selectedTool.toolName,
              parsedArguments: selectedTool.arguments,
              validationResult: selectedTool.validation,
              agentVisibleResult: selectedTool.result,
              domainEventsProduced: selectedTool.domainEvents,
              durationMs: selectedTool.durationMs
            }}
          />
        )}
      </section>
      <section className="developer-section" aria-labelledby="event-timeline-heading">
        <h3 id="event-timeline-heading">Event timeline</h3>
        <div className="timeline-list event-list">
          {events.map((event) => (
            <button
              type="button"
              aria-pressed={event.id === selectedEventId}
              key={event.id}
              onClick={() => onSelectEvent(event.id)}
            >
              <span>{eventCategory(event.type)}</span>
              <strong>#{event.sequence} {event.type}</strong>
              <small>
                {event.timestamp} · {event.turnId ?? 'no turn'} ·{' '}
                {event.visibility.join(', ')}
              </small>
            </button>
          ))}
        </div>
        {selectedEvent && (
          <SafeJson label="Selected event payload" value={selectedEvent.payload} />
        )}
      </section>
    </>
  )
}
