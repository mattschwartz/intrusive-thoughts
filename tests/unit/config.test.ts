import { describe, expect, it } from 'vitest'

import { createApplicationConfiguration } from '../../src/main/config'
import {
  ANCHOR_IDS,
  PROVENANCE_IDENTITY_IDS,
  anchorsForIdentity,
  PROVENANCE_IDENTITIES
} from '../../src/main/world/provenance'

function judgeRequest(claim: string) {
  const identity = PROVENANCE_IDENTITIES[PROVENANCE_IDENTITY_IDS.irisBedroom]
  return {
    claim,
    identity: { id: identity.id, label: identity.label },
    anchorCatalog: anchorsForIdentity(identity).map((anchor) => ({
      id: anchor.id,
      label: anchor.label
    })),
    signal: new AbortController().signal
  }
}

describe('application configuration', () => {
  it('redacts both supported provider keys', () => {
    const configuration = createApplicationConfiguration({
      userDataPath: '/tmp/intrusive-thoughts-user-data',
      environment: {
        OPENAI_API_KEY: '  openai-secret  ',
        OPENROUTER_API_KEY: '  openrouter-secret  '
      }
    })

    expect(configuration.secretsToRedact).toEqual([
      'openai-secret',
      'openrouter-secret'
    ])
  })

  it('builds a judge gateway alongside the narrating one, in both modes', () => {
    const live = createApplicationConfiguration({
      userDataPath: '/tmp/intrusive-thoughts-user-data',
      environment: {
        OPENAI_API_KEY: 'openai-secret',
        OPENAI_MODEL: 'narrating-model',
        JUDGE_MODEL: 'small-judge-model'
      }
    })
    const fake = createApplicationConfiguration({
      userDataPath: '/tmp/intrusive-thoughts-user-data',
      environment: { INTRUSIVE_THOUGHTS_GATEWAY: 'fake' }
    })

    expect(live.createJudgeGateway().model).toBe('small-judge-model')
    expect(live.createGateway().model).toBe('narrating-model')
    expect(fake.gatewayMode).toBe('fake')
    expect(fake.createJudgeGateway().model).toBe('fake-diagnostic-judge')
  })

  it('resolves the diagnostic judge deterministically, and only against its own catalog', async () => {
    const configuration = createApplicationConfiguration({
      userDataPath: '/tmp/intrusive-thoughts-user-data',
      environment: { INTRUSIVE_THOUGHTS_GATEWAY: 'fake' }
    })
    const judge = configuration.createJudgeGateway()

    const matched = await judge.judge(
      judgeRequest('the banner said her name, and the night-light was still on')
    )
    const empty = await judge.judge(judgeRequest('   '))

    expect(matched.coherent).toBe(true)
    expect(matched.assertedTargetId).toBe(PROVENANCE_IDENTITY_IDS.irisBedroom)
    expect(matched.citedAnchorIds).toEqual([
      ANCHOR_IDS.nightLight,
      ANCHOR_IDS.birthdayBanner
    ])
    expect(empty.coherent).toBe(false)
    expect(empty.citedAnchorIds).toEqual([])
  })
})
