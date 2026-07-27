import { describe, expect, it } from 'vitest'

describe('test harness', () => {
  it('runs the prototype test suite', () => {
    expect('intrusive-thoughts').toContain('thoughts')
  })
})
