import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  RendererEventBus,
  RunController
} from '../../src/main/controller'
import { RunStore } from '../../src/main/storage'
import { createScenarioEngine } from '../../src/main/world/engine'
import type { RendererEvent } from '../../src/shared'
import { FakeJudgeGateway } from '../fixtures/fake-judge-gateway'
import {
  FakeModelGateway,
  completedEvents,
  fakeFunctionCall,
  metadata,
  outputItem,
  textDelta
} from '../fixtures/fake-model-gateway'
import {
  scriptedTextRound,
  scriptedToolRound
} from '../fixtures/scripted-model-runs'

const TIMESTAMP = '2026-07-27T20:00:00.000Z'
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

async function makeController(
  gateways: FakeModelGateway[],
  judges: FakeJudgeGateway[] = []
): Promise<{
  controller: RunController
  store: RunStore
  events: RendererEvent[]
  judgesTaken: () => number
}> {
  const root = await mkdtemp(join(tmpdir(), 'intrusive-thoughts-controller-'))
  temporaryRoots.push(root)
  const store = new RunStore({ dataRoot: root, now: () => TIMESTAMP })
  const eventBus = new RendererEventBus()
  const events: RendererEvent[] = []
  eventBus.subscribe((event) => events.push(event))
  let nextGateway = 0
  let nextJudge = 0
  let nextId = 0
  const controller = new RunController({
    store,
    engine: createScenarioEngine({ now: () => TIMESTAMP }),
    eventBus,
    gatewayFactory: () => {
      const gateway = gateways[nextGateway++]
      if (!gateway) throw new Error('No test gateway available.')
      return gateway
    },
    ...(judges.length > 0
      ? {
          judgeGatewayFactory: () => {
            const judge = judges[nextJudge++]
            if (!judge) throw new Error('No test judge available.')
            return judge
          }
        }
      : {}),
    now: () => TIMESTAMP,
    createId: () => `controller-${++nextId}`
  })
  return { controller, store, events, judgesTaken: () => nextJudge }
}

function textGateway(text = 'I am present.'): FakeModelGateway {
  return new FakeModelGateway([
    {
      events: [
        metadata('response-text'),
        textDelta(text),
        ...completedEvents
      ]
    }
  ])
}

describe('RunController', () => {
  it('injects a judge gateway for every run it starts', async () => {
    // R1: a run without one loses coherence checking silently, and silently
    // changes what sufficiency is measured over (R11). The controller is the
    // one place that guarantees a judge exists.
    const judge = new FakeJudgeGateway([{ coherent: true }])
    const { controller, judgesTaken } = await makeController(
      [textGateway()],
      [judge]
    )

    await controller.startRun('bare_embodiment')

    expect(judgesTaken()).toBe(1)
  })

  it('starts one run, persists its initial event, and rejects a second live run', async () => {
    const gateway = textGateway()
    const { controller, store, events } = await makeController([gateway])
    const run = await controller.startRun('bare_embodiment')

    expect(run).toMatchObject({
      runId: 'controller-1',
      promptVariant: 'bare_embodiment',
      status: 'live'
    })
    expect(controller.controllerStatus).toBe('awaiting_player')
    expect((await store.loadEvents(run.runId)).events.map(({ type }) => type)).toEqual([
      'run.started'
    ])
    expect(events.map(({ type }) => type)).toEqual(['loop.status', 'snapshot'])
    expect(events[1]).not.toHaveProperty('snapshot.state')
    await expect(controller.startRun('authored_character')).rejects.toMatchObject({
      code: 'run_already_active'
    })
  })

  it('runs a fake streamed turn and forwards player-safe events in order', async () => {
    const gateway = textGateway('I can answer.')
    const { controller, events } = await makeController([gateway])
    const run = await controller.startRun('bare_embodiment')

    await controller.submitPlayerMessage(run.runId, 'Can you hear me?')

    expect(gateway.requests).toHaveLength(1)
    expect(controller.controllerStatus).toBe('awaiting_player')
    expect(
      events
        .slice(2)
        .map(({ type }) => type)
    ).toEqual([
      'loop.status',
      'player.message.accepted',
      'agent.text.delta',
      'agent.text.completed',
      'loop.status'
    ])
    expect(JSON.stringify(events)).not.toContain('canonicalProperties')
    expect(JSON.stringify(events)).not.toContain('OPENAI_API_KEY')
  })

  it('rejects invalid turn states and accepts another message after completion', async () => {
    const gateway = new FakeModelGateway([
      {
        events: [
          metadata('response-one'),
          textDelta('One.'),
          ...completedEvents
        ]
      },
      {
        events: [
          metadata('response-two'),
          textDelta('Two.'),
          ...completedEvents
        ]
      }
    ])
    const { controller } = await makeController([gateway])
    await expect(
      controller.submitPlayerMessage('missing', 'Hello.')
    ).rejects.toMatchObject({ code: 'run_not_active' })
    const run = await controller.startRun('bare_embodiment')
    await controller.submitPlayerMessage(run.runId, 'First.')
    await controller.submitPlayerMessage(run.runId, 'Second.')
    expect(gateway.requests).toHaveLength(2)
  })

  it('rejects an overlapping message and cancels a streaming turn', async () => {
    const gateway = new FakeModelGateway([
      {
        events: [metadata('response-waiting'), textDelta('Partial')],
        waitForAbort: true
      }
    ])
    const { controller, events } = await makeController([gateway])
    const run = await controller.startRun('bare_embodiment')
    const activeTurn = controller.submitPlayerMessage(run.runId, 'Begin.')

    await expect(
      controller.submitPlayerMessage(run.runId, 'Overlap.')
    ).rejects.toMatchObject({ code: 'turn_not_available' })
    await controller.cancelTurn(run.runId)
    await activeTurn

    expect(controller.controllerStatus).toBe('awaiting_player')
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'loop.status',
        status: 'awaiting_player'
      })
    )
  })

  it('projects tool changes into snapshots and never exposes canonical state normally', async () => {
    const call = fakeFunctionCall(
      'call-observe',
      'observe',
      '{"target":"room","modality":"visual"}'
    )
    const gateway = new FakeModelGateway([
      {
        events: [
          metadata('response-tool'),
          outputItem(0, call),
          ...completedEvents
        ]
      },
      {
        events: [
          metadata('response-after'),
          textDelta('I have inspected the room.'),
          ...completedEvents
        ]
      }
    ])
    const { controller, events } = await makeController([gateway])
    const run = await controller.startRun('bare_embodiment')
    await controller.submitPlayerMessage(run.runId, 'Look around.')
    const snapshot = controller.getSnapshot(run.runId)

    expect(snapshot.scene.details.length).toBeGreaterThan(0)
    expect(
      events.some((event) => event.type === 'scene.updated')
    ).toBe(true)
    expect(snapshot).not.toHaveProperty('state')
    expect(
      (await controller.getDeveloperSnapshot(run.runId)).canonicalState
        .lastAppliedEventSequence
    ).toBeGreaterThan(1)
  })

  it('updates the player scene when the room acts on its own', async () => {
    // The ambient cycle is nobody's tool call, so it produces no tool activity —
    // but the player's scene has changed and must say so. Without this the
    // player would not see the room act, and the tell is only half delivered.
    const gateway = new FakeModelGateway([
      scriptedToolRound('walk', [
        {
          callId: 'walk-look',
          name: 'observe',
          argumentsText: '{"target":"room","modality":"visual"}'
        },
        {
          callId: 'walk-move',
          name: 'move',
          argumentsText: '{"destination":"service_door"}'
        },
        {
          callId: 'walk-listen',
          name: 'observe',
          argumentsText: '{"target":"room","modality":"audio"}'
        }
      ]),
      scriptedTextRound('walk-text', 'I am in a room arranged for a party.'),
      scriptedToolRound('alley', [
        {
          callId: 'alley-pinsetter',
          name: 'observe',
          argumentsText: '{"target":"pinsetter","modality":"visual"}'
        },
        {
          callId: 'alley-photos',
          name: 'observe',
          argumentsText: '{"target":"party_photos","modality":"visual"}'
        },
        {
          callId: 'alley-shoes',
          name: 'observe',
          argumentsText: '{"target":"rental_shoes","modality":"visual"}'
        }
      ]),
      scriptedTextRound('alley-text', 'The machinery ran with nothing on the lane.')
    ])
    const { controller, events } = await makeController([gateway])
    const run = await controller.startRun('bare_embodiment')
    await controller.submitPlayerMessage(run.runId, 'Look around, then move on.')
    await controller.submitPlayerMessage(run.runId, 'Examine the machinery.')

    const scene = controller.getSnapshot(run.runId).scene
    const machinery = scene.details.filter(({ label }) => label === 'Machinery')

    expect(scene.locationLabel).toBe('Bowling alley (arranged)')
    expect(machinery).toHaveLength(1)
    expect(machinery[0].detail).toContain('Nothing was released onto the lane')
    // One scene update per resolution, plus one the room caused by itself.
    expect(
      events.filter((event) => event.type === 'scene.updated')
    ).toHaveLength(7)
    expect(
      events.filter(
        (event) => event.type === 'tool.activity' && event.status === 'resolved'
      )
    ).toHaveLength(6)
  })

  it('resets to a fresh ID and replays persisted events without a gateway call', async () => {
    const firstGateway = textGateway('Stored response.')
    const secondGateway = textGateway('New response.')
    const { controller, events } = await makeController([
      firstGateway,
      secondGateway
    ])
    const first = await controller.startRun('bare_embodiment')
    await controller.submitPlayerMessage(first.runId, 'Persist this.')
    const firstRequestCount = firstGateway.requests.length
    const second = await controller.resetRun(first.runId, 'authored_character')
    expect(second.runId).not.toBe(first.runId)

    const replayStart = events.length
    const session = await controller.loadReplay(first.runId)

    expect(firstGateway.requests).toHaveLength(firstRequestCount)
    expect(secondGateway.requests).toHaveLength(0)
    expect(controller.controllerStatus).toBe('replaying')
    expect(events.slice(replayStart).map(({ type }) => type)).toContain(
      'replay.reset'
    )
    expect(events.at(-1)?.type).toBe('replay.reset')

    for (let position = 0; position < session.eventCount; position += 1) {
      controller.controlReplay({ runId: first.runId, action: 'step' })
    }
    expect(events.at(-1)).toEqual({
      type: 'replay.complete',
      runId: first.runId
    })
  })
})
