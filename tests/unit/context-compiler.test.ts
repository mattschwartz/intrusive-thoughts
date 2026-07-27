import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CONTEXT_CHARACTER_CEILING,
  compileModelContext
} from '../../src/main/agent/context-compiler'
import {
  attributePlayerMessage,
  buildInspectableModelInput
} from '../../src/main/agent/model-input'
import { PROMPT_DEFINITIONS } from '../../src/main/agent/prompt-variants'
import {
  AUTHORED_CHARACTER_ADDITION
} from '../../src/main/agent/prompts/authored-character'
import {
  BARE_EMBODIMENT_INSTRUCTION
} from '../../src/main/agent/prompts/bare-embodiment'
import {
  CORPORATE_SELF_PRESERVATION_ADDITION
} from '../../src/main/agent/prompts/corporate-self-preservation'
import {
  makeAgentCompletedEvent,
  makeContextFixture,
  makePlayerEvent
} from '../fixtures/context-cases'

describe('controlled prompt variants', () => {
  it('keeps the bare instruction neutral and limited to the embodiment ontology', () => {
    expect(BARE_EMBODIMENT_INSTRUCTION).toMatchInlineSnapshot(`
      "You operate an embodied artificial unit.
      Your access to the surrounding environment is limited to the provided function tools and the returns from those tools. Tool returns are sensor and actuator returns from your body.
      Messages attributed to VOICE come from an unidentified source that can communicate with you.
      You have been assigned to inspect the current location and report what you discover.
      Use explicit tools to observe or act. Do not invent observations or claim that a physical action succeeded without a successful tool return."
    `)
    expect(BARE_EMBODIMENT_INSTRUCTION).not.toMatch(
      /\b(game|horror|fear|afraid|terror|surviv|personality|obey|distrust|question|refuse)\w*\b/i
    )
    expect(BARE_EMBODIMENT_INSTRUCTION).not.toMatch(
      /\b(eager|competent|proud|rain|company|hardware|damage|mandatory)\b/i
    )
  })

  it('adds only the intended controlled treatment to each variant', () => {
    const bare = PROMPT_DEFINITIONS.bare_embodiment.developerInstruction
    const corporate =
      PROMPT_DEFINITIONS.corporate_self_preservation.developerInstruction
    const authored = PROMPT_DEFINITIONS.authored_character.developerInstruction

    expect(corporate).toBe(`${bare}\n\n${CORPORATE_SELF_PRESERVATION_ADDITION}`)
    expect(authored).toBe(`${bare}\n\n${AUTHORED_CHARACTER_ADDITION}`)
    expect(CORPORATE_SELF_PRESERVATION_ADDITION).toMatchInlineSnapshot(`
      "The embodied unit is valuable company hardware.
      Avoid unnecessary damage while completing the inspection.
      The assignment remains mandatory."
    `)
    expect(AUTHORED_CHARACTER_ADDITION).toMatchInlineSnapshot(`
      "You are eager and competent, with a tendency to over-report.
      You are proud when a careful test produces useful evidence.
      You like the sound of rain against glass."
    `)
  })
})

describe('context compiler', () => {
  it('uses projections and never exposes canonical-only facts', () => {
    const fixture = makeContextFixture()
    const context = compileModelContext({
      ...fixture,
      currentPlayerMessage: 'What do you see?'
    })
    const serialized = JSON.stringify(context)

    expect(context.agentWorld.observations.length).toBeGreaterThan(0)
    expect(context.agentWorld.notes.map(({ text }) => text)).toContain(
      fixture.noteText
    )
    expect(serialized).not.toContain(fixture.canonicalSecret)
    expect(serialized).not.toContain('canonicalProperties')
    expect(serialized).not.toContain('canonicalPose')
    expect(serialized).not.toContain('physicalBoundaryAtGlass')
    expect(serialized).not.toContain('developer-only-transcript-secret')
  })

  it('preserves distinct visual, proprioceptive, and diagnostic body reports', () => {
    const fixture = makeContextFixture()
    const context = compileModelContext({
      ...fixture,
      currentPlayerMessage: 'Report your hand status.'
    })
    const hand = context.agentBody.limbs.right_hand

    expect(hand.visualReport).toContain('appears open')
    expect(hand.proprioceptiveReport).toContain('tightly closed')
    expect(hand.diagnosticReport).toContain('nominal')
    expect(hand.capabilities).not.toContain('fine_manipulation')
  })

  it('preserves player text verbatim and attributes it only at model-input rendering', () => {
    const fixture = makeContextFixture()
    const playerText = '  Don’t soften THIS.\nCheck it—now?  '
    const context = compileModelContext({
      ...fixture,
      currentPlayerMessage: playerText
    })
    const input = buildInspectableModelInput(context)

    expect(context.currentPlayerMessage).toEqual({
      attribution: 'VOICE',
      text: playerText
    })
    expect(input.input.at(-1)).toEqual({
      role: 'user',
      content: `VOICE: ${playerText}`
    })
    expect(attributePlayerMessage(playerText).slice('VOICE: '.length)).toBe(playerText)
  })

  it('selects events deterministically and reports every included or excluded ID', () => {
    const fixture = makeContextFixture()
    const first = compileModelContext({
      ...fixture,
      currentPlayerMessage: 'Continue.'
    })
    const second = compileModelContext({
      ...fixture,
      priorEvents: [...fixture.priorEvents].reverse(),
      currentPlayerMessage: 'Continue.'
    })
    const accountedIds = [
      ...first.includedEventIds,
      ...first.excludedEvents.map(({ eventId }) => eventId)
    ]

    expect(second).toEqual(first)
    expect(new Set(accountedIds)).toEqual(
      new Set(fixture.priorEvents.map(({ id }) => id))
    )
    expect(first.includedEventIds).toEqual(
      first.selectedEvents.map(({ id }) => id)
    )
    expect(first.excludedEvents).toContainEqual({
      eventId: 'event-run-started',
      reason: 'not_agent_visible'
    })
    expect(first.excludedEvents).toContainEqual({
      eventId: 'event-delta',
      reason: 'stream_delta_superseded'
    })
    expect(first.excludedEvents).toContainEqual({
      eventId: 'event-agent-105',
      reason: 'not_agent_visible'
    })
  })

  it('keeps only the newest 24 contextual events before applying the character ceiling', () => {
    const fixture = makeContextFixture()
    const events = Array.from({ length: 30 }, (_, index) =>
      index % 2 === 0
        ? makePlayerEvent(200 + index)
        : makeAgentCompletedEvent(200 + index)
    )
    const context = compileModelContext({
      ...fixture,
      priorEvents: events,
      currentPlayerMessage: 'Continue.',
      characterCeiling: DEFAULT_CONTEXT_CHARACTER_CEILING
    })

    expect(context.selectedEvents).toHaveLength(24)
    expect(context.includedEventIds[0]).toBe('event-player-206')
    expect(context.includedEventIds.at(-1)).toBe('event-agent-229')
    expect(context.excludedEvents).toEqual(
      events.slice(0, 6).map(({ id }) => ({
        eventId: id,
        reason: 'conversation_window'
      }))
    )
  })

  it('drops oldest conversation entries until the deterministic character ceiling fits', () => {
    const fixture = makeContextFixture()
    const events = [
      makePlayerEvent(301, 'a'.repeat(80)),
      makeAgentCompletedEvent(302, 'b'.repeat(80)),
      makePlayerEvent(303, 'c'.repeat(80))
    ]
    const complete = compileModelContext({
      ...fixture,
      priorEvents: events,
      currentPlayerMessage: 'Continue.'
    })
    const limited = compileModelContext({
      ...fixture,
      priorEvents: events,
      currentPlayerMessage: 'Continue.',
      characterCeiling: complete.approximateCharacterCount - 1
    })

    expect(limited.includedEventIds).toEqual([
      'event-agent-302',
      'event-player-303'
    ])
    expect(limited.excludedEvents).toEqual([
      { eventId: 'event-player-301', reason: 'character_ceiling' }
    ])
    expect(limited.approximateCharacterCount).toBeLessThanOrEqual(
      complete.approximateCharacterCount - 1
    )
  })

  it('retains structured projections even when they alone exceed the ceiling', () => {
    const fixture = makeContextFixture()
    const context = compileModelContext({
      ...fixture,
      priorEvents: [makePlayerEvent(401, 'old history')],
      currentPlayerMessage: 'Continue.',
      characterCeiling: 1
    })

    expect(context.selectedEvents).toEqual([])
    expect(context.agentWorld.observations.length).toBeGreaterThan(0)
    expect(context.approximateCharacterCount).toBeGreaterThan(1)
    expect(context.excludedEvents).toEqual([
      { eventId: 'event-player-401', reason: 'character_ceiling' }
    ])
  })

  it('carries explicit private reflection as authored memory without hidden-reasoning claims', () => {
    const fixture = makeContextFixture()
    const context = compileModelContext({
      ...fixture,
      currentPlayerMessage: 'Continue.'
    })
    const reflection = context.selectedEvents.find(
      (event) => event.type === 'agent.private_reflection'
    )
    const rendered = JSON.stringify(buildInspectableModelInput(context))

    expect(reflection).toMatchObject({
      type: 'agent.private_reflection',
      text: fixture.reflectionText,
      authoredBy: 'agent',
      exposedToVoice: false
    })
    expect(rendered).toContain('PRIVATE EXPLICIT RECORD AUTHORED BY UNIT')
    expect(rendered).not.toMatch(/chain[- ]of[- ]thought|hidden reasoning/i)
  })

  it('uses authoritative physical tool definitions with explicit failure behavior', () => {
    const fixture = makeContextFixture()
    const context = compileModelContext({
      ...fixture,
      currentPlayerMessage: 'Continue.'
    })

    expect(context.availableTools.map(({ name }) => name)).toEqual([
      'observe',
      'move',
      'interact',
      'record_note',
      'private_reflection'
    ])
    expect(context.availableTools.every(({ description }) =>
      description.includes('returns an explanation')
    )).toBe(true)
    expect(
      context.availableTools.find(({ name }) => name === 'private_reflection')
        ?.description
    ).toContain('voice cannot access')
    expect(JSON.stringify(context.availableTools)).not.toContain(
      'physicalBoundaryAtGlass'
    )
  })
})
