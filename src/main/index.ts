import { app, BrowserWindow, ipcMain } from 'electron'

import { resolveMainAssetPaths } from './asset-paths'
import { createApplicationConfiguration } from './config'
import { RendererEventBus, RunController, RunManager } from './controller'
import { registerIpc } from './ipc'
import { createRunStore } from './storage'
import { scenarioEngine } from './world/engine'

const mainAssetPaths = resolveMainAssetPaths(import.meta.url)

function trustedDevelopmentUrl(value: string): string {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error('ELECTRON_RENDERER_URL must point to a local development server.')
  }
  return url.toString()
}

function createWindow(): void {
  const configuration = createApplicationConfiguration({
    userDataPath: app.getPath('userData')
  })
  console.info(
    `[prototype] run data: ${configuration.dataRoot} (gateway: ${configuration.gatewayMode})`
  )

  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#080a09',
    webPreferences: {
      preload: mainAssetPaths.preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const eventBus = new RendererEventBus()
  const store = createRunStore({ dataRoot: configuration.dataRoot })
  const controller = new RunController({
    store,
    engine: scenarioEngine,
    eventBus,
    gatewayFactory: configuration.createGateway,
    judgeGatewayFactory: configuration.createJudgeGateway,
    secretsToRedact: configuration.secretsToRedact
  })
  registerIpc({
    ipcMain,
    manager: new RunManager(controller),
    eventBus,
    rendererWebContents: mainWindow.webContents,
    secretsToRedact: configuration.secretsToRedact
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== mainWindow.webContents.getURL()) event.preventDefault()
  })
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    void mainWindow.loadURL(trustedDevelopmentUrl(rendererUrl))
  } else {
    void mainWindow.loadFile(mainAssetPaths.renderer)
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
