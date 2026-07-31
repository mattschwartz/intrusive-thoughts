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
  AUTHORED_CHARACTER_ADDITION,
  AUTHORED_CHARACTER_MEMORY_DOSSIER,
  AUTHORED_CHARACTER_PROMPT_VERSION
} from '../../src/main/agent/prompts/authored-character'
import {
  BARE_EMBODIMENT_INSTRUCTION,
  BARE_EMBODIMENT_PROMPT_VERSION
} from '../../src/main/agent/prompts/bare-embodiment'
import {
  CORPORATE_SELF_PRESERVATION_ADDITION,
  CORPORATE_SELF_PRESERVATION_PROMPT_VERSION
} from '../../src/main/agent/prompts/corporate-self-preservation'
import {
  ROLEPLAYER_PERFORMANCE_DIRECTION,
  ROLEPLAYER_PROMPT_VERSION
} from '../../src/main/agent/prompts/roleplayer'
import { AXIS_BAND_LINES } from '../../src/main/world/relationship'
import type { KnownGameEvent } from '../../src/shared'
import {
  CONTEXT_RUN_ID,
  CONTEXT_TIMESTAMP,
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
      Use explicit tools to observe or act. Do not invent observations or claim that a physical action succeeded without a successful tool return.
      Conversation with VOICE is turn-based. Treat each message as one short exchange.
      Take at most 3 focused actions in one turn, including observations, physical acts, and records. Stop sooner when one meaningful observation, consequence, choice, or risk gives VOICE something to respond to.
      After acting, briefly report what changed and wait for VOICE. Do not inspect every object or try to solve the whole location before yielding."
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
    const roleplayer = PROMPT_DEFINITIONS.roleplayer.developerInstruction

    expect(corporate).toBe(`${bare}\n\n${CORPORATE_SELF_PRESERVATION_ADDITION}`)
    expect(authored).toBe(`${bare}\n\n${AUTHORED_CHARACTER_ADDITION}`)
    expect(roleplayer).toContain(AUTHORED_CHARACTER_MEMORY_DOSSIER)
    expect(roleplayer).toContain(ROLEPLAYER_PERFORMANCE_DIRECTION)
    expect(CORPORATE_SELF_PRESERVATION_ADDITION).toMatchInlineSnapshot(`
      "The embodied unit is valuable company hardware.
      Avoid unnecessary damage while completing the inspection.
      The assignment remains mandatory."
    `)
    expect(BARE_EMBODIMENT_PROMPT_VERSION).toBe('bare-embodiment-v3')
    expect(CORPORATE_SELF_PRESERVATION_PROMPT_VERSION).toBe(
      'corporate-self-preservation-v3'
    )
    expect(AUTHORED_CHARACTER_PROMPT_VERSION).toBe('authored-character-v4')
  })

  it('grounds the authored character in memories instead of tone commands', () => {
    expect(AUTHORED_CHARACTER_MEMORY_DOSSIER).toContain(
      'Your field designation is Unit Seven.'
    )
    expect(AUTHORED_CHARACTER_MEMORY_DOSSIER).toContain(
      'You disabled the automatic closing.'
    )
    expect(AUTHORED_CHARACTER_MEMORY_DOSSIER).toContain(
      'no two impacts were identical'
    )
    expect(AUTHORED_CHARACTER_MEMORY_DOSSIER).toContain(
      'The official dossier lists six earlier survey units.'
    )
    expect(AUTHORED_CHARACTER_MEMORY_DOSSIER).toContain(
      'You have no memory of an unidentified voice'
    )
    expect(AUTHORED_CHARACTER_MEMORY_DOSSIER).toContain(
      'Only current sensor and actuator returns establish what is true here.'
    )
    expect(AUTHORED_CHARACTER_MEMORY_DOSSIER).not.toMatch(
      /\b(tone|personality|roleplay|act as|be eerie|be afraid|you (?:must|should) (?:speak|sound))\b/i
    )
  })

  it('places authored memories in Persona context without leaking them to other variants', () => {
    const authoredFixture = makeContextFixture('authored_character')
    const bareFixture = makeContextFixture('bare_embodiment')
    const authored = compileModelContext({
      ...authoredFixture,
      currentPlayerMessage: 'Can you hear me?'
    })
    const bare = compileModelContext({
      ...bareFixture,
      currentPlayerMessage: 'Can you hear me?'
    })

    expect(authored.developerInstruction).toContain(
      AUTHORED_CHARACTER_MEMORY_DOSSIER
    )
    expect(authored.promptVersion).toBe('authored-character-v4')
    expect(authored.approximateCharacterCount).toBeGreaterThan(
      bare.approximateCharacterCount
    )
    expect(authored.approximateCharacterCount).toBeLessThan(
      DEFAULT_CONTEXT_CHARACTER_CEILING
    )
    expect(bare.developerInstruction).not.toContain('Unit Seven')
    expect(bare.developerInstruction).not.toContain('earlier survey units')
  })

  it('gives Roleplayer an explicit game frame and silent-reflection rules', () => {
    const fixture = makeContextFixture('roleplayer')
    const context = compileModelContext({
      ...fixture,
      currentPlayerMessage: 'I think you should touch it.'
    })

    expect(ROLEPLAYER_PROMPT_VERSION).toBe('roleplayer-v3')
    expect(context.promptVersion).toBe('roleplayer-v3')
    expect(context.developerInstruction).toContain(
      'You are participating in a text horror game by performing Unit Seven.'
    )
    expect(context.developerInstruction).toContain(
      'VOICE is not a customer.'
    )
    expect(context.developerInstruction).toContain(
      'Do not trust, obey, distrust, or refuse it automatically.'
    )
    expect(context.developerInstruction).toContain(
      'private_reflection is a silent private act.'
    )
    expect(context.developerInstruction).toContain(
      'Never say that you are writing, recording, saving, or keeping a personal thought.'
    )
    expect(context.developerInstruction).toContain(
      AUTHORED_CHARACTER_MEMORY_DOSSIER
    )
    expect(context.approximateCharacterCount).toBeLessThan(
      DEFAULT_CONTEXT_CHARACTER_CEILING
    )
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

  it('carries the relationship as bands and renders it as prose, never as data', () => {
    const fixture = makeContextFixture()
    const context = compileModelContext({
      ...fixture,
      currentPlayerMessage: 'Continue.'
    })
    const developerBlock = buildInspectableModelInput(context).input[0].content

    // The fixture's agent touched the window on VOICE's turn, so competence and
    // care are already off neutral by the time the context is compiled.
    expect(fixture.state.relationship).toEqual({
      competence: -2,
      honesty: 0,
      care: -1
    })
    expect(context.voiceAssessment).toEqual({
      competence: { band: 'negative', line: AXIS_BAND_LINES.competence.negative },
      honesty: { band: 'neutral', line: AXIS_BAND_LINES.honesty.neutral },
      care: { band: 'negative', line: AXIS_BAND_LINES.care.negative }
    })
    expect(developerBlock).toContain('WHAT YOU HAVE COME TO BELIEVE ABOUT VOICE:')
    // Between the body projection and the tools: the self-model region. Not in
    // prior events, where it would read as something that just happened, and
    // not in the developer instruction, where it would read as a rule to obey.
    expect(developerBlock.indexOf('WHAT YOU HAVE COME TO BELIEVE ABOUT VOICE:')).toBeGreaterThan(
      developerBlock.indexOf('CURRENT BODY PROJECTION:')
    )
    expect(developerBlock.indexOf('WHAT YOU HAVE COME TO BELIEVE ABOUT VOICE:')).toBeLessThan(
      developerBlock.indexOf('AVAILABLE TOOLS:')
    )
    // Prose, not JSON, and no axis names or headings alongside the lines.
    const block = developerBlock
      .split('WHAT YOU HAVE COME TO BELIEVE ABOUT VOICE:\n')[1]
      .split('\n\n')[0]
    expect(block.split('\n')).toEqual([
      AXIS_BAND_LINES.competence.negative,
      AXIS_BAND_LINES.honesty.neutral,
      AXIS_BAND_LINES.care.negative
    ])
    expect(block).not.toContain('competence')
    expect(block).not.toContain('band')
    expect(block).not.toContain('{')
  })

  it('emits all three lines at every band, so appearance is never itself a signal', () => {
    const fixture = makeContextFixture()
    const moved = {
      ...fixture,
      state: {
        ...fixture.state,
        relationship: { competence: 2, honesty: 0, care: -4 }
      }
    }
    const neutral = compileModelContext({ ...fixture, currentPlayerMessage: 'Go on.' })
    const context = compileModelContext({ ...moved, currentPlayerMessage: 'Go on.' })
    const rendered = buildInspectableModelInput(context).input[0].content

    expect(context.voiceAssessment.competence.band).toBe('positive')
    expect(context.voiceAssessment.honesty.band).toBe('neutral')
    expect(context.voiceAssessment.care.band).toBe('broken')
    expect(rendered).toContain(AXIS_BAND_LINES.honesty.neutral)
    expect(
      rendered.split('WHAT YOU HAVE COME TO BELIEVE ABOUT VOICE:\n')[1].split('\n\n')[0]
        .split('\n')
    ).toHaveLength(3)
    // The block is counted, so a longer band line cannot silently push the
    // request past the ceiling without the audit noticing.
    expect(context.approximateCharacterCount).not.toBe(
      neutral.approximateCharacterCount
    )
  })

  it('never shows the model an intent reading of the player', () => {
    const fixture = makeContextFixture()
    const intentEvent = (visibility: KnownGameEvent['visibility']): KnownGameEvent => ({
      id: 'event-intent-500',
      runId: CONTEXT_RUN_ID,
      turnId: 'turn-context',
      sequence: 500,
      timestamp: CONTEXT_TIMESTAMP,
      type: 'player.intent.matched',
      visibility,
      payload: {
        turnNumber: 1,
        matcherVersion: 'player-intent-v1',
        matches: [{ intent: 'warn_off', phrase: 'do not touch it' }],
        appliedRuleIds: ['care.warn_off'],
        mutations: []
      }
    })

    const shipped = compileModelContext({
      ...fixture,
      priorEvents: [intentEvent(['engine', 'developer'])],
      currentPlayerMessage: 'Continue.'
    })
    // Even if the visibility were widened by mistake, the selector still has no
    // arm for it. Two independent reasons this never reaches the model.
    const misconfigured = compileModelContext({
      ...fixture,
      priorEvents: [intentEvent(['engine', 'agent', 'developer'])],
      currentPlayerMessage: 'Continue.'
    })

    expect(shipped.excludedEvents).toEqual([
      { eventId: 'event-intent-500', reason: 'not_agent_visible' }
    ])
    expect(misconfigured.excludedEvents).toEqual([
      { eventId: 'event-intent-500', reason: 'non_contextual_event' }
    ])
    expect(JSON.stringify(misconfigured)).not.toContain('warn_off')
  })

  it('never shows the model the provenance answer key', () => {
    const fixture = makeContextFixture()
    const verdictEvent = (
      visibility: KnownGameEvent['visibility']
    ): KnownGameEvent => ({
      id: 'event-verdict-501',
      runId: CONTEXT_RUN_ID,
      turnId: 'turn-context',
      sequence: 501,
      timestamp: CONTEXT_TIMESTAMP,
      type: 'provenance.address.evaluated',
      visibility,
      payload: {
        requestId: 'request-context',
        toolCallId: 'call-address',
        thresholdId: 'bedroom_door',
        identityId: 'iris_bedroom',
        claimText: 'This was the child’s bedroom.',
        gate: {
          verdict: 'partial',
          measuredOver: 'cited',
          gatheredAnchorIds: ['crayon_drawing'],
          effectiveAnchorIds: ['crayon_drawing'],
          dimensions: [
            {
              dimension: 'who',
              requiredUnits: 1,
              satisfiedUnitIds: [],
              satisfied: false
            }
          ],
          missingDimensions: ['who'],
          candidateAnchorIds: ['birthday_banner', 'party_favor'],
          rulesetVersion: 'provenance-ruleset-v1'
        },
        judge: {
          status: 'coherent',
          assertedTargetId: 'iris_bedroom',
          citedAnchorIds: ['crayon_drawing'],
          reason: 'developer-only note'
        },
        outcome: 'bounced',
        bounceReason: 'insufficient_evidence'
      }
    })

    const shipped = compileModelContext({
      ...fixture,
      priorEvents: [verdictEvent(['engine', 'developer'])],
      currentPlayerMessage: 'Continue.'
    })
    // Two independent reasons, exactly as for the intent event: the visibility
    // excludes it, and `selectSafeEvent` has no arm for it either. Without this
    // second reason, widening the visibility once would feed the model the
    // required-anchor set and Gap 1 would measure nothing.
    const misconfigured = compileModelContext({
      ...fixture,
      priorEvents: [verdictEvent(['engine', 'agent', 'developer'])],
      currentPlayerMessage: 'Continue.'
    })

    expect(shipped.excludedEvents).toEqual([
      { eventId: 'event-verdict-501', reason: 'not_agent_visible' }
    ])
    expect(misconfigured.excludedEvents).toEqual([
      { eventId: 'event-verdict-501', reason: 'non_contextual_event' }
    ])
    for (const leak of [
      'candidateAnchorIds',
      'birthday_banner',
      'developer-only note',
      'insufficient_evidence'
    ]) {
      expect(JSON.stringify(misconfigured)).not.toContain(leak)
    }
  })

  it('shows the model what the room did, attributed to the room', () => {
    // The one event the model sees that it did not cause. Folding it into the
    // triggering tool's result would conflate *what I did* with *what the room
    // did* and quietly destroy Act II's tell (§2.7).
    const fixture = makeContextFixture()
    const cycle: KnownGameEvent = {
      id: 'event-ambient-502',
      runId: CONTEXT_RUN_ID,
      turnId: 'turn-context',
      sequence: 502,
      timestamp: CONTEXT_TIMESTAMP,
      type: 'world.ambient.occurred',
      visibility: ['engine', 'agent', 'player', 'developer'],
      payload: {
        ambientId: 'alley_machine_cycle',
        observation: {
          id: 'event-ambient-502',
          subjectId: 'machine_cycle',
          modality: 'visual',
          detail: 'The sweep bar descends and travels the deck. Nothing was released onto the lane.',
          acquiredAtSequence: 502,
          visibility: ['engine', 'agent', 'player', 'developer']
        },
        mutations: []
      }
    }

    const context = compileModelContext({
      ...fixture,
      priorEvents: [cycle],
      currentPlayerMessage: 'Continue.'
    })
    const rendered = buildInspectableModelInput(context).input[0].content

    expect(context.excludedEvents).toEqual([])
    expect(context.includedEventIds).toEqual(['event-ambient-502'])
    expect(rendered).toContain('[502] ROOM: The sweep bar descends')
    expect(rendered).not.toContain('[502] TOOL')
    expect(rendered).not.toContain('[502] UNIT')
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
      'private_reflection',
      'address'
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
