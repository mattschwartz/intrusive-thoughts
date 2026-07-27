export {}

declare global {
  interface Window {
    intrusiveThoughts?: {
      getVersion(): string
    }
  }
}
