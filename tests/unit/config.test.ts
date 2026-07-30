import { describe, expect, it } from 'vitest'

import { createApplicationConfiguration } from '../../src/main/config'

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
})
