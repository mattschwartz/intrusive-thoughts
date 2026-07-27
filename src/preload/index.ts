import { contextBridge } from 'electron'

const prototypeApi = Object.freeze({
  getVersion: (): string => '0.0.0-prototype'
})

contextBridge.exposeInMainWorld('intrusiveThoughts', prototypeApi)
