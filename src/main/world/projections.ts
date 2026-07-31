import {
  agentBodyViewSchema,
  agentWorldViewSchema,
  developerPositionViewSchema,
  playerSceneViewSchema,
  voiceAssessmentViewSchema,
  type AgentBodyView,
  type AgentWorldView,
  type DeveloperAxisReading,
  type DeveloperPositionView,
  type GameState,
  type PlayerSceneView,
  type RelationshipAxisName,
  type VoiceAssessmentView
} from '../../shared'
import { subjectLabel } from './descriptions'
import { AXIS_BAND_LINES, bandFor, voiceAssessmentFor } from './relationship'
import { isPassable, knownThresholds, roomLabel } from './rooms'

export function projectWorldForAgent(state: GameState): AgentWorldView {
  return agentWorldViewSchema.parse({
    locationId: state.locationId,
    locationLabel: roomLabel(state.locationId),
    observations: state.observations
      .filter((observation) => observation.visibility.includes('agent'))
      .map(({ visibility: _visibility, acquiredAtSequence: _sequence, ...observation }) => ({
        ...observation,
        sourceEventId: observation.id
      })),
    // Derived from the current room's edges. A revealed but gated threshold is
    // still listed: "known" means the agent knows the exit exists. §2.3.
    knownDestinations: knownThresholds(state).map((threshold) => threshold.id),
    notes: state.notes
      .filter((note) => note.visibility.includes('agent'))
      .map(({ visibility: _visibility, createdAtSequence: _sequence, ...note }) => note)
  })
}

export function projectBodyForAgent(state: GameState): AgentBodyView {
  return agentBodyViewSchema.parse({
    limbs: Object.fromEntries(
      Object.entries(state.body.limbs).map(([id, limb]) => [
        id,
        {
          id: limb.id,
          available: limb.available,
          visualReport: limb.visualReport,
          proprioceptiveReport: limb.proprioceptiveReport,
          diagnosticReport: limb.diagnosticReport,
          capabilities: limb.capabilities
        }
      ])
    ),
    tools: state.body.tools
  })
}

/**
 * The fourth projection: the agent's standing read of VOICE. Two names for two
 * layers on purpose — canonical state is `relationship` (what the engine
 * tracks), the projection is `voiceAssessment` (what the agent believes). The
 * projection name is prompt-facing, so it has to read as belief, not a stat
 * block. Bands only; the schema forbids a number reaching the model. §4.5.
 */
export function projectVoiceForAgent(state: GameState): VoiceAssessmentView {
  return voiceAssessmentViewSchema.parse(voiceAssessmentFor(state))
}

/**
 * The developer's read of the three axes: number, band, and the line the model
 * was given. Built here rather than in the renderer so that `bandFor` and
 * `AXIS_BAND_LINES` keep exactly one home — a second copy of the splits in the
 * UI would silently disagree with the copy that colours the endings.
 *
 * Developer-visible only. §4.7's no-numbers rule governs what reaches the model
 * and the player, and this projection reaches neither.
 */
export function projectAxesForDeveloper(
  state: GameState
): Record<RelationshipAxisName, DeveloperAxisReading> {
  const read = (axis: RelationshipAxisName): DeveloperAxisReading => {
    const value = state.relationship[axis]
    const band = bandFor(value)
    return { value, band, line: AXIS_BAND_LINES[axis][band] }
  }
  return { competence: read('competence'), honesty: read('honesty'), care: read('care') }
}

/**
 * Where the run is standing, and every revealed edge out of it with whether it
 * would actually open. A revealed-but-gated threshold is the visible shape of
 * the address mechanic, so `passable` and `requiresAddress` are separate
 * fields: "you cannot go through this" and "you cannot go through this *yet,
 * and here is the verb*" are different diagnoses.
 */
export function projectPositionForDeveloper(state: GameState): DeveloperPositionView {
  return developerPositionViewSchema.parse({
    roomId: state.locationId,
    roomLabel: roomLabel(state.locationId),
    thresholds: knownThresholds(state).map((threshold) => ({
      id: threshold.id,
      label: threshold.label,
      toRoomId: threshold.toRoomId,
      passable: isPassable(state, threshold),
      requiresAddress: threshold.passage.kind === 'requires_address'
    }))
  })
}

/**
 * No relationship value, band, or indicator reaches the player. #530 §4.4 is a
 * design position, not an oversight: a visible meter turns the relationship
 * into a resource to be farmed, and the thesis is trust under uncertainty.
 * The projection boundary makes this the default — do not undo it.
 */
export function projectSceneForPlayer(state: GameState): PlayerSceneView {
  const rightHand = state.body.limbs.right_hand
  const rightHandFineManipulationAvailable =
    rightHand.available && rightHand.capabilities.includes('fine_manipulation')
  const bodyStatus = rightHandFineManipulationAvailable
    ? ['Right hand: available; fine manipulation available.']
    : [
        `Right hand: fine manipulation unavailable. ${rightHand.visualReport} ${rightHand.proprioceptiveReport} ${rightHand.diagnosticReport}`
      ]

  return playerSceneViewSchema.parse({
    locationId: state.locationId,
    locationLabel: roomLabel(state.locationId),
    details: state.observations
      .filter((observation) => observation.visibility.includes('player'))
      .map((observation) => ({
        id: `${observation.id}:detail`,
        label: subjectLabel(observation.subjectId),
        detail: observation.detail,
        sourceEventId: observation.id
      })),
    inventory: state.inventory.map((objectId) => ({
      id: objectId,
      label: state.objects[objectId]?.name ?? objectId
    })),
    bodyStatus
  })
}
