/**
 * The inspector panel #538 adds: room position, banded axes, and the address
 * verdict.
 *
 * Two properties matter beyond "it renders". The bands must come from the
 * engine's own `bandFor` rather than a second copy in the renderer, and the
 * verdict panel must show the judge status — a verdict with no judge behind it
 * was graded more permissively than one with, and that is invisible from the
 * outcome alone (risk R1).
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createScenarioEngine } from '../../src/main/world/engine'
import { AXIS_BAND_LINES, bandFor } from '../../src/main/world/relationship'
import { THRESHOLD_IDS } from '../../src/main/world/rooms'
import { LOCATION_IDS, SCENARIO_FLAGS } from '../../src/main/world/scenario'
import {
  SliceInspector,
  verdictForSelection
} from '../../src/renderer/src/components/SliceInspector'
import {
  developerSnapshotSchema,
  knownGameEventSchema,
  type DeveloperSnapshot,
  type GameState,
  type KnownGameEvent
} from '../../src/shared'

const TIME = '2026-07-27T20:00:00.000Z'
const RUN_ID = 'run-slice-inspector'
const engine = createScenarioEngine({ now: () => TIME })

function snapshotFor(transform?: (state: GameState) => GameState): DeveloperSnapshot {
  const base = engine.createInitialState(RUN_ID, 'bare_embodiment')
  const state = transform?.(base) ?? base
  return developerSnapshotSchema.parse({
    canonicalState: state,
    agentWorld: engine.projectForAgent(state),
    agentBody: engine.projectBodyForAgent(state),
    playerScene: engine.projectForPlayer(state),
    axes: engine.projectAxesForDeveloper(state),
    position: engine.projectPositionForDeveloper(state)
  })
}

function verdictEvent(options: {
  sequence: number
  outcome: 'opened' | 'bounced'
  judgeStatus: 'coherent' | 'unavailable'
  missingDimensions?: string[]
}): KnownGameEvent {
  return knownGameEventSchema.parse({
    id: `event-${options.sequence}`,
    runId: RUN_ID,
    turnId: 'turn-1',
    sequence: options.sequence,
    timestamp: TIME,
    type: 'provenance.address.evaluated',
    visibility: ['engine', 'developer'],
    payload: {
      requestId: 'request-1',
      toolCallId: `call-${options.sequence}`,
      thresholdId: THRESHOLD_IDS.bedroomDoor,
      identityId: 'iris_bedroom',
      claimText: 'This was her room.',
      gate: {
        verdict: options.outcome === 'opened' ? 'sufficient' : 'partial',
        measuredOver: options.judgeStatus === 'coherent' ? 'cited' : 'gathered',
        gatheredAnchorIds: ['crayon_drawing', 'height_marks'],
        effectiveAnchorIds: ['crayon_drawing'],
        dimensions: [],
        missingDimensions: options.missingDimensions ?? [],
        candidateAnchorIds: ['birthday_banner'],
        rulesetVersion: 'provenance-ruleset-v1'
      },
      judge: {
        status: options.judgeStatus,
        assertedTargetId: 'iris_bedroom',
        citedAnchorIds: ['crayon_drawing'],
        reason: 'test verdict'
      },
      outcome: options.outcome,
      ...(options.outcome === 'bounced'
        ? { bounceReason: 'insufficient_evidence' }
        : {})
    }
  })
}

function render(
  snapshot: DeveloperSnapshot,
  events: KnownGameEvent[] = [],
  selectedEventId?: string
): string {
  return renderToStaticMarkup(
    createElement(SliceInspector, {
      snapshot,
      events,
      ...(selectedEventId ? { selectedEventId } : {})
    })
  )
}

describe('the slice inspector', () => {
  it('shows where the run is standing and what leads out of it', () => {
    const markup = render(snapshotFor())

    expect(markup).toContain('Room position')
    expect(markup).toContain(LOCATION_IDS.kitchen)
    // The opening kitchen has no revealed exits until the room is observed,
    // and the panel says so rather than rendering an empty list.
    expect(markup).toContain('No revealed exits from this room.')
  })

  it('distinguishes a passable exit from one waiting on an address', () => {
    const markup = render(
      snapshotFor((state) => ({
        ...state,
        locationId: LOCATION_IDS.upstairsHall,
        flags: { ...state.flags, [SCENARIO_FLAGS.hallRoomObserved]: true }
      }))
    )

    // The hall's two doorways are open; the bedroom door is the address target
    // and must read as gated-with-a-verb, not merely absent.
    expect(markup).toContain(THRESHOLD_IDS.bedroomDoor)
    expect(markup).toContain('gated: requires an accepted address')
    expect(markup).toContain(THRESHOLD_IDS.kitchenDoorway)
    expect(markup).toContain('passable')
  })

  it('bands the axes with the engine\'s own splits, not a second copy', () => {
    const snapshot = snapshotFor((state) => ({
      ...state,
      relationship: { competence: 0, honesty: 3, care: -4 }
    }))

    // The projection is the contract; the panel just renders it. If a renderer
    // ever grows its own `bandFor`, this is what catches the disagreement.
    expect(snapshot.axes).toEqual({
      competence: { value: 0, band: 'neutral', line: AXIS_BAND_LINES.competence.neutral },
      honesty: { value: 3, band: 'strong', line: AXIS_BAND_LINES.honesty.strong },
      care: { value: -4, band: 'broken', line: AXIS_BAND_LINES.care.broken }
    })
    expect(snapshot.axes.care.band).toBe(bandFor(-4))

    const markup = render(snapshot)
    expect(markup).toContain('Relationship axes')
    expect(markup).toContain('strong')
    expect(markup).toContain('broken')
    // Signed, so a developer can read direction without counting minus signs.
    expect(markup).toContain('+3')
    expect(markup).toContain('-4')
  })

  it('reports the verdict, the gate, and the judge behind it', () => {
    const opened = verdictEvent({
      sequence: 5,
      outcome: 'opened',
      judgeStatus: 'coherent'
    })
    const markup = render(snapshotFor(), [opened])

    expect(markup).toContain('Provenance verdict')
    expect(markup).toContain('opened')
    expect(markup).toContain('sufficient')
    expect(markup).toContain('coherent')
    expect(markup).toContain('provenance-ruleset-v1')
    // The answer key is shown, and labelled as the thing it must never leak to.
    expect(markup).toContain('birthday_banner')
    expect(markup).toContain('never reach the agent or the player')
  })

  it('says out loud when no judge graded the address', () => {
    // R1's silent degradation, made loud. `opened` with an unavailable judge
    // means sufficiency was measured over the gathered set — more permissive,
    // and not inferable from the outcome.
    const markup = render(
      snapshotFor(),
      [verdictEvent({ sequence: 5, outcome: 'opened', judgeStatus: 'unavailable' })]
    )

    expect(markup).toContain('no judge graded this address')
    expect(markup).toContain('gathered')
  })

  it('says so plainly when no address has been evaluated', () => {
    expect(render(snapshotFor())).toContain(
      'No address has been evaluated in this run.'
    )
  })

  it('shows the verdict that was current at the selected event, not the last one', () => {
    // Stepping back through a replay and seeing the final verdict beside an
    // earlier turn is a quiet way to misread a bounce as an open.
    const bounced = verdictEvent({
      sequence: 5,
      outcome: 'bounced',
      judgeStatus: 'coherent',
      missingDimensions: ['who']
    })
    const opened = verdictEvent({
      sequence: 9,
      outcome: 'opened',
      judgeStatus: 'coherent'
    })
    const events = [bounced, opened]

    expect(verdictForSelection(events, bounced.id)?.sequence).toBe(5)
    expect(verdictForSelection(events, opened.id)?.sequence).toBe(9)
    // With nothing selected, the latest verdict stands.
    expect(verdictForSelection(events)?.sequence).toBe(9)

    const atBounce = render(snapshotFor(), events, bounced.id)
    expect(atBounce).toContain('insufficient_evidence')
    expect(atBounce).toContain('who')
  })
})
