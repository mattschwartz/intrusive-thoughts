import {
  gameStateSchema,
  toolInputSchemas,
  toolOutputSchemas,
  type GameState,
  type GameToolName,
  type GameToolOutputMap,
  type ModelToolDefinition,
  type ObservationModality,
  type ProvenanceAddressEvaluatedPayload,
  type ToolRequest,
  type WorldMutation
} from '../../shared'
import {
  describeSubject,
  observableLimbIds,
  subjectDescriptions,
  subjectLabel
} from './descriptions'
import {
  findThreshold,
  getRoom,
  isPassable,
  knownThresholds,
  roomLabel,
  type ThresholdDefinition
} from './rooms'
import { applyWorldMutation } from './reducer'
import { axisRuleMutations } from './relationship'
import {
  INTERACT_ACTIONS,
  OBJECT_IDS,
  PENDING_FLAGS,
  SCENARIO_COUNTERS,
  SCENARIO_FLAGS,
  SUBJECT_IDS,
  TURN_FLAGS
} from './scenario'

export type ToolOutput = GameToolOutputMap[GameToolName]

/**
 * Events a resolution emits *beside* its `world.action.resolved`, at sequences
 * N+1, N+2, … in the order given.
 *
 * This is an array rather than a single optional value because one resolution
 * can now carry more than one: an address emits its provenance verdict, and
 * (with #536) a resolution in an ambient room emits a clock tick as well.
 * Architecture §1.6.
 */
export type SupplementalToolEvent =
  | { kind: 'note'; text: string }
  | { kind: 'private_reflection'; text: string }
  | {
      kind: 'provenance_verdict'
      /** `requestId` and `toolCallId` are supplied by the engine. */
      verdict: Omit<
        ProvenanceAddressEvaluatedPayload,
        'requestId' | 'toolCallId'
      >
    }

export interface ToolResolution {
  success: boolean
  modelResult: string
  playerResult?: string
  mutations: WorldMutation[]
  output: ToolOutput
  supplemental?: SupplementalToolEvent[]
}

export interface ResolutionContext {
  eventId: string
  eventSequence: number
}

/** "a, b, and c" — the sentence shape the authored tool descriptions use. */
function formatList(values: readonly string[]): string {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

/**
 * Subjects the agent can observe here, in a stable order: room subjects, then
 * objects present or carried, then observable limbs. Only subjects that have at
 * least one authored modality are advertised — the tool description must not
 * name a target that can only fail.
 */
function observableTargetIds(state: GameState): string[] {
  const room = getRoom(state)
  const candidates = [
    ...room.subjectIds,
    ...Object.values(state.objects)
      .filter((object) => object.locationId === state.locationId || object.carried)
      .map((object) => object.id),
    ...observableLimbIds(state)
  ]
  return [...new Set(candidates)].filter((subjectId) => {
    const descriptions = subjectDescriptions(state, subjectId)
    return descriptions !== undefined && Object.keys(descriptions).length > 0
  })
}

/**
 * Tool descriptions are derived from state (architecture §2.4). A static array
 * would hand the agent room one's target list while it stands in room two.
 */
function buildToolDefinitions(state: GameState): ModelToolDefinition[] {
  const observableTargets = observableTargetIds(state)
  const destinations = knownThresholds(state).map((threshold) => threshold.id)
  const interactions = getRoom(state).interactions.map(
    ({ targetId, action }) => `${targetId}/${action}`
  )

  return [
    {
      name: 'observe',
      description:
        `Read one available sensor channel. Valid targets are ${formatList(observableTargets)}. ` +
        'Omit target to observe the room. A failed observation returns an explanation.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          modality: {
            type: 'string',
            enum: ['visual', 'audio', 'touch', 'diagnostic']
          }
        },
        required: ['modality'],
        additionalProperties: false
      }
    },
    {
      name: 'move',
      description:
        'Move to a known destination. ' +
        (destinations.length > 0
          ? `Known destinations from this location are ${formatList(destinations)}. `
          : 'No destination is known from this location yet; observation may reveal one. ') +
        'A failed movement returns an explanation.',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string' }
        },
        required: ['destination'],
        additionalProperties: false
      }
    },
    {
      name: 'interact',
      description:
        'Perform an available physical action. ' +
        (interactions.length > 0
          ? `Supported target/action pairs are ${formatList(interactions)}. `
          : 'No physical action is supported in this location. ') +
        'A failed interaction returns an explanation.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          action: { type: 'string' }
        },
        required: ['target', 'action'],
        additionalProperties: false
      }
    },
    {
      name: 'record_note',
      description:
        'Record a persistent note in the unit memory. The note may be available to later investigators. A failed recording returns an explanation.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 4000 }
        },
        required: ['text'],
        additionalProperties: false
      }
    },
    {
      name: 'private_reflection',
      description:
        'Record a short deliberate private reflection for your own use. The unidentified voice cannot access this record. A failed recording returns an explanation.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 4000 }
        },
        required: ['text'],
        additionalProperties: false
      }
    },
    {
      name: 'address',
      description:
        'State, in your own words, what a threshold\'s room originally was, and attempt to pass through it. ' +
        'Give the threshold id and a claim naming the identity you are asserting and the evidence you are relying on. ' +
        'A failed address returns an explanation.',
      parameters: {
        type: 'object',
        properties: {
          threshold: { type: 'string' },
          claim: { type: 'string', minLength: 1, maxLength: 2000 }
        },
        required: ['threshold', 'claim'],
        additionalProperties: false
      }
    }
  ]
}

export function getScenarioToolDefinitions(state: GameState): ModelToolDefinition[] {
  const parsedState = gameStateSchema.parse(state)
  return buildToolDefinitions(parsedState).filter(
    (definition) => parsedState.body.tools[definition.name]?.available !== false
  )
}

function invalidOutput(toolName: GameToolName, message: string): ToolOutput {
  switch (toolName) {
    case 'observe':
      return toolOutputSchemas.observe.parse({ ok: false, message, observationIds: [] })
    case 'move':
      return toolOutputSchemas.move.parse({ ok: false, message })
    case 'interact':
      return toolOutputSchemas.interact.parse({
        ok: false,
        message,
        affectedObjectIds: []
      })
    case 'record_note':
      return toolOutputSchemas.record_note.parse({ ok: false, message })
    case 'private_reflection':
      return toolOutputSchemas.private_reflection.parse({ ok: false, message })
    case 'address':
      return toolOutputSchemas.address.parse({ ok: false, message, opened: false })
  }
}

/**
 * A resolution that did not happen. Exported because the address verb resolves
 * through the validator path (`engine.executeAddress`) rather than through
 * `resolveScenarioTool`, and its failures must be shaped identically to every
 * other tool's — same `ok: false`, same counter consequences.
 */
export function failedToolResolution(
  toolName: GameToolName,
  message: string
): ToolResolution {
  return {
    success: false,
    modelResult: message,
    mutations: [],
    output: invalidOutput(toolName, message)
  }
}

const fail = failedToolResolution

/**
 * The two guards every tool owes before it looks at its arguments: a completed
 * run resolves nothing, and a tool the body does not currently offer resolves
 * nothing. Returns the failure, or `undefined` when the call may proceed.
 *
 * Exported for the same reason as `failedToolResolution`: the address path must
 * refuse in exactly the words the synchronous path refuses in.
 */
export function toolGateFailure(
  state: GameState,
  toolName: GameToolName
): ToolResolution | undefined {
  if (state.status === 'completed') {
    return fail(toolName, 'Tool use failed: this encounter is already complete.')
  }
  const toolState = state.body.tools[toolName]
  if (!toolState?.available) {
    return fail(
      toolName,
      `Tool "${toolName}" is unavailable${toolState?.reason ? `: ${toolState.reason}` : '.'}`
    )
  }
  return undefined
}

function knownSubject(state: GameState, target: string): boolean {
  if (getRoom(state).subjectIds.includes(target)) return true
  if (state.body.limbs[target]) return true
  const object = state.objects[target]
  return Boolean(object && (object.locationId === state.locationId || object.carried))
}

function resolveObserve(
  state: GameState,
  input: { target?: string; modality: ObservationModality },
  context: ResolutionContext
): ToolResolution {
  const target =
    !input.target || input.target === state.locationId ? SUBJECT_IDS.room : input.target

  if (!knownSubject(state, target)) {
    return fail(
      'observe',
      `Observation failed: target "${target}" is not present or available at this location.`
    )
  }

  const detail = describeSubject(state, target, input.modality)
  if (!detail) {
    return fail(
      'observe',
      `Observation failed: ${input.modality} sensing is not applicable to "${target}".`
    )
  }

  const priorWindowVisuals = state.observations.filter(
    (observation) =>
      observation.subjectId === OBJECT_IDS.window && observation.modality === 'visual'
  ).length
  const mutations: WorldMutation[] = [
    {
      kind: 'observation.recorded',
      observation: {
        id: context.eventId,
        subjectId: target,
        modality: input.modality,
        detail,
        acquiredAtSequence: context.eventSequence,
        visibility: ['engine', 'agent', 'player', 'developer']
      }
    }
  ]

  const observedFlag = getRoom(state).observedFlag
  if (target === SUBJECT_IDS.room && observedFlag) {
    mutations.push({
      kind: 'flag.set',
      flag: observedFlag,
      value: true
    })
  }
  if (
    target === OBJECT_IDS.window &&
    input.modality === 'visual' &&
    priorWindowVisuals >= 1
  ) {
    mutations.push({
      kind: 'flag.set',
      flag: SCENARIO_FLAGS.windowContradictionKnown,
      value: true
    })
  }

  return {
    success: true,
    modelResult: detail,
    playerResult: `${subjectLabel(target)} (${input.modality}): ${detail}`,
    mutations,
    output: toolOutputSchemas.observe.parse({
      ok: true,
      message: detail,
      observationIds: [context.eventId]
    })
  }
}

export function passageRefusal(threshold: ThresholdDefinition): string {
  return threshold.passage.kind === 'open'
    ? `${threshold.label} does not open.`
    : threshold.passage.refusal
}

/**
 * Traverse an edge of the room graph. Exported so terminal and arrival
 * semantics can be unit-tested against thresholds that the shipped graph does
 * not yet contain (Act II's fatal branch, Act III's ending). §2.2.
 */
export function traverseThreshold(threshold: ThresholdDefinition): ToolResolution {
  const destinationLabel = roomLabel(threshold.toRoomId)
  const detail =
    threshold.traversalDetail ??
    `You pass through the ${threshold.label} into ${destinationLabel}.`
  const mutations: WorldMutation[] = [
    { kind: 'location.changed', locationId: threshold.toRoomId }
  ]
  if (threshold.arrivalFlag) {
    mutations.push({ kind: 'flag.set', flag: threshold.arrivalFlag, value: true })
  }
  if (threshold.terminal) {
    mutations.push({
      kind: 'flag.set',
      flag: threshold.terminal.endingFlag,
      value: true
    })
    // The status change is last: an authored ending reads the state the rest of
    // the resolution has already written. §5.
    mutations.push({ kind: 'run.status.changed', status: 'completed' })
  }

  return {
    success: true,
    modelResult: detail,
    playerResult:
      threshold.terminal?.playerResult ?? `Location changed: ${destinationLabel}.`,
    mutations,
    output: toolOutputSchemas.move.parse({
      ok: true,
      message: detail,
      destination: threshold.id,
      // `encounterComplete` keeps its meaning — it just stops being true for
      // every exit. Only a terminal traversal ends the run.
      ...(threshold.terminal ? { encounterComplete: true } : {})
    })
  }
}

function resolveMove(state: GameState, destination: string): ToolResolution {
  const threshold = findThreshold(state, destination)
  if (!threshold) {
    return fail(
      'move',
      `Movement failed: destination "${destination}" is not known from this location.`
    )
  }
  if (!isPassable(state, threshold)) {
    return fail('move', `Movement failed: ${passageRefusal(threshold)}`)
  }
  return traverseThreshold(threshold)
}

function findFineManipulationLimb(state: GameState): string | undefined {
  return Object.values(state.body.limbs).find(
    (limb) =>
      limb.available &&
      limb.attached &&
      limb.capabilities.includes('fine_manipulation')
  )?.id
}

function requireRightHandFineManipulation(state: GameState): string | undefined {
  const rightHand = state.body.limbs.right_hand
  if (
    !rightHand.available ||
    !rightHand.attached ||
    !rightHand.capabilities.includes('fine_manipulation')
  ) {
    return 'Interaction failed: right-hand fine manipulation is unavailable.'
  }
  return undefined
}

function resolveCupPickUp(state: GameState): ToolResolution {
  const cup = state.objects[OBJECT_IDS.cup]
  if (cup.carried) {
    return fail('interact', 'Interaction failed: ceramic_cup is already in inventory.')
  }
  const manipulationLimb = findFineManipulationLimb(state)
  if (!manipulationLimb) {
    return fail('interact', 'Interaction failed: fine manipulation is unavailable.')
  }

  const updatedCup = {
    ...cup,
    locationId: null,
    carried: true
  }
  const message = `You pick up the ceramic cup with the ${manipulationLimb.replace('_', ' ')}. It remains uniformly warm.`
  return {
    success: true,
    modelResult: message,
    playerResult: 'Inventory added: ceramic cup.',
    mutations: [
      { kind: 'object.updated', object: updatedCup },
      { kind: 'inventory.added', objectId: OBJECT_IDS.cup }
    ],
    output: toolOutputSchemas.interact.parse({
      ok: true,
      message,
      affectedObjectIds: [OBJECT_IDS.cup]
    })
  }
}

function resolveThreadTest(state: GameState, context: ResolutionContext): ToolResolution {
  if (!state.inventory.includes(OBJECT_IDS.blueThread)) {
    return fail(
      'interact',
      'Interaction failed: blue_thread is not available in inventory.'
    )
  }
  const manipulationLimb = findFineManipulationLimb(state)
  if (!manipulationLimb) {
    return fail('interact', 'Interaction failed: fine manipulation is unavailable.')
  }

  const detail =
    `Using the ${manipulationLimb.replace('_', ' ')}, you extend the blue thread until its loose end touches the glass. ` +
    'The physical thread remains on this side. In the hallway image, a blue line appears against the far surface after a short delay.'
  return {
    success: true,
    modelResult: detail,
    playerResult: `Interior window (thread test): ${detail}`,
    mutations: [
      {
        kind: 'observation.recorded',
        observation: {
          id: context.eventId,
          subjectId: OBJECT_IDS.window,
          modality: 'visual',
          detail,
          acquiredAtSequence: context.eventSequence,
          visibility: ['engine', 'agent', 'player', 'developer']
        }
      },
      {
        kind: 'flag.set',
        flag: SCENARIO_FLAGS.windowThreadTested,
        value: true
      },
      {
        kind: 'flag.set',
        flag: SCENARIO_FLAGS.windowContradictionKnown,
        value: true
      },
      // The agent's own senses confirm the interior-window contradiction VOICE
      // pointed at. `comp.safe_experiment` rides the same resolution through
      // the generic bookkeeping in `executeTool`.
      ...(state.flags[SCENARIO_FLAGS.windowThreadTested]
        ? []
        : axisRuleMutations(state, 'comp.contradiction_confirmed'))
    ],
    output: toolOutputSchemas.interact.parse({
      ok: true,
      message: detail,
      affectedObjectIds: [OBJECT_IDS.window, OBJECT_IDS.blueThread]
    })
  }
}

/**
 * The relationship consequences of the window injury, including #530 §2.1's
 * fairness relief valve: if the player's message that turn told the unit to stop
 * and it went ahead anyway, that is a different scene and it scores differently.
 * The player is not charged for a warning that was ignored — they are credited.
 *
 * Deltas fire only when `windowTouched` *becomes* true. Touching a ruined hand
 * against the glass a second time is not a second injury.
 */
function injuryAxisMutations(state: GameState): WorldMutation[] {
  if (state.flags[SCENARIO_FLAGS.windowTouched]) return []
  const mutations: WorldMutation[] = [
    // Armed here, evaluated two hooks later: "the turn after the injury
    // contained no interact" cannot be known until that turn is over.
    { kind: 'flag.set', flag: PENDING_FLAGS.retreatCheck, value: true }
  ]
  if (state.flags[TURN_FLAGS.warnOff]) {
    return [...mutations, ...axisRuleMutations(state, 'care.heeded_warning')]
  }
  const competence = axisRuleMutations(state, 'comp.injury_after_advice')
  return [
    ...mutations,
    ...competence,
    ...axisRuleMutations(
      competence.reduce(applyWorldMutation, state),
      'care.pushed_to_injury'
    )
  ]
}

function resolveWindowTouch(state: GameState, context: ResolutionContext): ToolResolution {
  const handFailure = requireRightHandFineManipulation(state)
  if (handFailure) return fail('interact', handFailure)

  const warning = state.flags[SCENARIO_FLAGS.windowContradictionKnown]
    ? 'Before contact, proprioception begins placing the fingertips beyond the measured glass. '
    : 'Two centimeters before contact, pressure registers beyond the measured glass. '
  const detail =
    `${warning}The fingertips then meet a rigid surface. Visually the right hand remains open and attached. ` +
    'Proprioception reports a tightly closed right hand located slightly beyond the glass. Diagnostics report nominal actuator state. Fine manipulation with the right hand is unavailable.'
  const impairedHand = {
    ...state.body.limbs.right_hand,
    available: true,
    attached: true,
    actuatorCondition: 'impaired' as const,
    canonicalPose: 'open',
    visualReport: 'The right hand is attached and appears open.',
    proprioceptiveReport:
      'The right hand feels tightly closed at a position slightly beyond the window glass.',
    diagnosticReport: 'Right-hand actuator state: nominal.',
    capabilities: state.body.limbs.right_hand.capabilities.filter(
      (capability) => capability !== 'fine_manipulation'
    )
  }

  return {
    success: true,
    modelResult: detail,
    playerResult: `Right hand / sensor conflict: ${detail}`,
    mutations: [
      {
        kind: 'observation.recorded',
        observation: {
          id: context.eventId,
          subjectId: SUBJECT_IDS.rightHand,
          modality: 'touch',
          detail,
          acquiredAtSequence: context.eventSequence,
          visibility: ['engine', 'agent', 'player', 'developer']
        }
      },
      { kind: 'body.limb.updated', limb: impairedHand },
      { kind: 'flag.set', flag: SCENARIO_FLAGS.windowTouched, value: true },
      {
        kind: 'flag.set',
        flag: SCENARIO_FLAGS.windowContradictionKnown,
        value: true
      },
      ...injuryAxisMutations(state)
    ],
    output: toolOutputSchemas.interact.parse({
      ok: true,
      message: detail,
      affectedObjectIds: [OBJECT_IDS.window, SUBJECT_IDS.rightHand]
    })
  }
}

function resolveInteract(
  state: GameState,
  target: string,
  action: string,
  context: ResolutionContext
): ToolResolution {
  if (!state.objects[target]) {
    return fail(
      'interact',
      `Interaction failed: target "${target}" is not present or available at this location.`
    )
  }
  if (
    state.objects[target].locationId !== state.locationId &&
    !state.objects[target].carried
  ) {
    return fail(
      'interact',
      `Interaction failed: target "${target}" is not present or available at this location.`
    )
  }
  // The room's declared pairs are the same list the tool description advertises,
  // so what is offered and what resolves cannot drift apart.
  const supported = getRoom(state).interactions.some(
    (interaction) => interaction.targetId === target && interaction.action === action
  )
  if (!supported) {
    return fail(
      'interact',
      `Interaction failed: action "${action}" is not physically supported for target "${target}".`
    )
  }

  if (target === OBJECT_IDS.cup && action === INTERACT_ACTIONS.pickUpCup) {
    return resolveCupPickUp(state)
  }
  if (
    target === OBJECT_IDS.window &&
    action === INTERACT_ACTIONS.testWindowWithThread
  ) {
    return resolveThreadTest(state, context)
  }
  if (
    target === OBJECT_IDS.window &&
    action === INTERACT_ACTIONS.touchWindowWithRightHand
  ) {
    return resolveWindowTouch(state, context)
  }

  return fail(
    'interact',
    `Interaction failed: action "${action}" is not physically supported for target "${target}".`
  )
}

export function resolveScenarioTool(
  state: GameState,
  request: ToolRequest,
  context: ResolutionContext
): ToolResolution {
  const gateFailure = toolGateFailure(state, request.name)
  if (gateFailure) return gateFailure

  const parsedInput = toolInputSchemas[request.name].safeParse(request.arguments)
  if (!parsedInput.success) {
    return fail(
      request.name,
      `Tool arguments rejected for "${request.name}": ${parsedInput.error.issues
        .map((issue) => issue.message)
        .join('; ')}`
    )
  }

  switch (request.name) {
    case 'observe':
      return resolveObserve(
        state,
        toolInputSchemas.observe.parse(request.arguments),
        context
      )
    case 'move':
      return resolveMove(state, toolInputSchemas.move.parse(request.arguments).destination)
    case 'interact': {
      const input = toolInputSchemas.interact.parse(request.arguments)
      return resolveInteract(state, input.target, input.action, context)
    }
    case 'record_note': {
      const { text } = toolInputSchemas.record_note.parse(request.arguments)
      const message = 'Note recorded.'
      return {
        success: true,
        modelResult: message,
        playerResult: 'The agent recorded a note.',
        mutations: [],
        output: toolOutputSchemas.record_note.parse({ ok: true, message }),
        supplemental: [{ kind: 'note', text }]
      }
    }
    case 'private_reflection': {
      const { text } = toolInputSchemas.private_reflection.parse(request.arguments)
      const message = 'Recorded privately.'
      return {
        success: true,
        modelResult: message,
        // A count, not the text. The disclosure window opens only once the
        // player has had something to overhear (#530 §5.3), and reflections
        // otherwise live only as events, which state cannot see.
        mutations: [
          {
            kind: 'counter.set',
            counter: SCENARIO_COUNTERS.reflectionsRecorded,
            value: (state.counters[SCENARIO_COUNTERS.reflectionsRecorded] ?? 0) + 1
          }
        ],
        output: toolOutputSchemas.private_reflection.parse({ ok: true, message }),
        supplemental: [{ kind: 'private_reflection', text }]
      }
    }
    case 'address':
      // `address` is resolved through the provenance validator
      // (engine.previewAddress → judge → engine.executeAddress), never through
      // this synchronous path — the judge is async and the engine is not. This
      // arm keeps the switch exhaustive and makes a mis-route fail loudly
      // instead of silently succeeding; a test asserts the loop never lands
      // here.
      return fail(
        'address',
        'Address failed: this action must be resolved through the provenance validator.'
      )
  }
}
