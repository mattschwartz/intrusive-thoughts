import { contextBridge, ipcRenderer } from 'electron'

import {
  createIntrusiveThoughtsApi,
  type PreloadTransport
} from './api'

const transport: PreloadTransport = {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on(channel, listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      listener(payload)
    }
    listenerWrappers.set(listener, wrapped)
    ipcRenderer.on(channel, wrapped)
  },
  off(channel, listener) {
    const wrapped = listenerWrappers.get(listener)
    if (!wrapped) return
    ipcRenderer.removeListener(channel, wrapped)
    listenerWrappers.delete(listener)
  }
}

const listenerWrappers = new WeakMap<
  (payload: unknown) => void,
  (_event: Electron.IpcRendererEvent, payload: unknown) => void
>()

contextBridge.exposeInMainWorld(
  'intrusiveThoughts',
  createIntrusiveThoughtsApi(transport)
)
