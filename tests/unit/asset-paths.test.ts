import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { resolveMainAssetPaths } from '../../src/main/asset-paths'

describe('main-process ESM asset paths', () => {
  it('derives preload and renderer paths from import.meta.url without CommonJS globals', () => {
    const mainBundle = join(process.cwd(), 'out', 'main', 'index.js')

    expect(resolveMainAssetPaths(pathToFileURL(mainBundle).href)).toEqual({
      preload: join(process.cwd(), 'out', 'preload', 'index.cjs'),
      renderer: join(process.cwd(), 'out', 'renderer', 'index.html')
    })
  })
})
