export {}

declare global {
  interface Window {
    fileManager: {
      platform: NodeJS.Platform
      ping: () => Promise<{ message: string; receivedAt: number }>
    }
  }
}
