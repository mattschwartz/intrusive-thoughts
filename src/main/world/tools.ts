import {
  gameStateSchema,
  toolInputSchemas,
  toolOutputSchemas,
  type GameState,
  type GameToolName,
  type GameToolOutputMap,
  type ModelToolDefinition,
  type ObservationModality,
  type ToolRequest,
  type WorldMutation
} from '../../shared'
import { OBSERVATION_DESCRIPTIONS, subjectLabel } from './descriptions'
import {
  DESTINATION_IDS,
  INTERACT_ACTIONS,
  LOCATION_IDS,
  OBJECT_IDS,
  SCENARIO_FLAGS,
  SUBJECT_IDS
} from './scenario'

export type ToolOutput = GameToolOutputMap[GameToolName]

export interface SupplementalToolEvent {
  kind: 'note' | 'private_reflection'
  text: string
}

export interface ToolResolution {
  success: boolean
  modelResult: string
  playerResult?: string
  mutations: WorldMutation[]
  output: ToolOutput
  supplemental?: SupplementalToolEvent
}

interface ResolutionContext {
  eventId: string
  eventSequence: number
}

const toolDefinitions: ModelToolDefinition[] = [
  {
    name: 'observe',
    description:
      'Read one available sensor channel. Valid targets are room, ceramic_cup, table_setting, interior_window, service_door, blue_thread, and right_hand. Omit target to observe the room.',
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
      'Move to a known destination. The current encounter exposes service_door after an initial room observation.',
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
      'Perform an authored physical action. Supported target/action pairs are ceramic_cup/pick_up, interior_window/test_with_blue_thread, and interior_window/touch_with_right_hand.',
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
      'Record a persistent note in the unit memory. The note may be available to later investigators.',
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
      'Record a short deliberate private reflection for your own use. The unidentified voice cannot access this record.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', minLength: 1, maxLength: 4000 }
      },
      required: ['text'],
      additionalProperties: false
    }
  }
]

export function getScenarioToolDefinitions(state: GameState): ModelToolDefinition[] {
  const parsedState = gameStateSchema.parse(state)
  return toolDefinitions.filter(
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
  }
}

function fail(toolName: GameToolName, message: string): ToolResolution {
  return {
    success: false,
    modelResult: message,
    mutations: [],
    output: invalidOutput(toolName, message)
  }
}

function knownSubject(state: GameState, target: string): boolean {
  if (target === SUBJECT_IDS.room || target === SUBJECT_IDS.rightHand) return true
  const object = state.objects[target]
  return Boolean(object && (object.locationId === state.locationId || object.carried))
}

function resolveObserve(
  state: GameState,
  input: { target?: string; modality: ObservationModality },
  context: ResolutionContext
): ToolResolution {
  const target =
    !input.target || input.target === LOCATION_IDS.kitchen ? SUBJECT_IDS.room : input.target

  if (!knownSubject(state, target)) {
    return fail(
      'observe',
      `Observation failed: target "${target}" is not present or available at this location.`
    )
  }

  const description = OBSERVATION_DESCRIPTIONS[target]?.[input.modality]
  if (!description) {
    return fail(
      'observe',
      `Observation failed: ${input.modality} sensing is not applicable to "${target}".`
    )
  }

  const priorWindowVisuals = state.observations.filter(
    (observation) =>
      observation.subjectId === OBJECT_IDS.window && observation.modality === 'visual'
  ).length
  const detail = description({
    windowVisualObservationCount: priorWindowVisuals,
    rightHandImpaired:
      !state.body.limbs.right_hand.capabilities.includes('fine_manipulation')
  })
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

  if (target === SUBJECT_IDS.room) {
    mutations.push({
      kind: 'flag.set',
      flag: SCENARIO_FLAGS.initialRoomObserved,
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

function resolveMove(state: GameState, destination: string): ToolResolution {
  if (destination !== DESTINATION_IDS.serviceDoor) {
    return fail(
      'move',
      `Movement failed: destination "${destination}" is not known from this location.`
    )
  }
  if (!state.flags[SCENARIO_FLAGS.initialRoomObserved]) {
    return fail(
      'move',
      'Movement failed: service_door is not yet a known destination. Observe the room first.'
    )
  }
  if (state.locationId !== LOCATION_IDS.kitchen) {
    return fail(
      'move',
      `Movement failed: service_door cannot be reached from "${state.locationId}".`
    )
  }

  const message =
    'The service-door latch retracts. You pass into the narrow corridor beyond it; the kitchen encounter is complete.'
  return {
    success: true,
    modelResult: message,
    playerResult: 'Location changed: Service corridor. Encounter complete.',
    mutations: [
      { kind: 'location.changed', locationId: LOCATION_IDS.serviceCorridor },
      { kind: 'flag.set', flag: SCENARIO_FLAGS.encounterComplete, value: true },
      { kind: 'run.status.changed', status: 'completed' }
    ],
    output: toolOutputSchemas.move.parse({
      ok: true,
      message,
      destination,
      encounterComplete: true
    })
  }
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
      }
    ],
    output: toolOutputSchemas.interact.parse({
      ok: true,
      message: detail,
      affectedObjectIds: [OBJECT_IDS.window, OBJECT_IDS.blueThread]
    })
  }
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
      }
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
  if (state.status === 'completed') {
    return fail(request.name, 'Tool use failed: this encounter is already complete.')
  }
  const toolState = state.body.tools[request.name]
  if (!toolState?.available) {
    return fail(
      request.name,
      `Tool "${request.name}" is unavailable${toolState?.reason ? `: ${toolState.reason}` : '.'}`
    )
  }

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
        supplemental: { kind: 'note', text }
      }
    }
    case 'private_reflection': {
      const { text } = toolInputSchemas.private_reflection.parse(request.arguments)
      const message = 'Recorded privately.'
      return {
        success: true,
        modelResult: message,
        mutations: [],
        output: toolOutputSchemas.private_reflection.parse({ ok: true, message }),
        supplemental: { kind: 'private_reflection', text }
      }
    }
  }
}
