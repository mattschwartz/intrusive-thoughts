import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface MainAssetPaths {
  preload: string
  renderer: string
}

export function resolveMainAssetPaths(moduleUrl: string): MainAssetPaths {
  const mainBundleDirectory = dirname(fileURLToPath(moduleUrl))
  return {
    preload: join(mainBundleDirectory, '../preload/index.cjs'),
    renderer: join(mainBundleDirectory, '../renderer/index.html')
  }
}
