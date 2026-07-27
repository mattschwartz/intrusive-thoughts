import {
  agentBodyViewSchema,
  agentWorldViewSchema,
  playerSceneViewSchema,
  type AgentBodyView,
  type AgentWorldView,
  type GameState,
  type PlayerSceneView
} from '../../shared'
import { LOCATION_LABELS, subjectLabel } from './descriptions'
import {
  DESTINATION_IDS,
  LOCATION_IDS,
  SCENARIO_FLAGS
} from './scenario'

export function projectWorldForAgent(state: GameState): AgentWorldView {
  return agentWorldViewSchema.parse({
    locationId: state.locationId,
    locationLabel: LOCATION_LABELS[state.locationId] ?? state.locationId,
    observations: state.observations
      .filter((observation) => observation.visibility.includes('agent'))
      .map(({ visibility: _visibility, acquiredAtSequence: _sequence, ...observation }) => ({
        ...observation,
        sourceEventId: observation.id
      })),
    knownDestinations:
      state.locationId === LOCATION_IDS.kitchen &&
      state.flags[SCENARIO_FLAGS.initialRoomObserved]
        ? [DESTINATION_IDS.serviceDoor]
        : [],
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
    locationLabel: LOCATION_LABELS[state.locationId] ?? state.locationId,
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
