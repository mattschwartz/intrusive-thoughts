import type { IntrusiveThoughtsAPI } from '../../../shared'

declare global {
  interface Window {
    intrusiveThoughts?: IntrusiveThoughtsAPI
  }
}

export {}
