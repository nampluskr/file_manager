import { app, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { createDefaultSettings, restoreSettings, saveSettings } from './config/settings'

function configureContentSecurityPolicy(): void {
  // Dev only: Vite's React-refresh preamble is an inline <script type="module">,
  // so script-src needs 'unsafe-inline' here or it silently fails to set up
  // window.$RefreshReg$/$RefreshSig$ ("can't detect preamble") and the whole
  // renderer stays blank. The production build has no inline scripts, so the
  // shipped policy stays strict.
  const policy = is.dev
    ? "default-src 'self'; base-uri 'self'; object-src 'none'; frame-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:*"
    : "default-src 'self'; base-uri 'self'; object-src 'none'; frame-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    })
  })
}

async function loadWindowContent(window: BrowserWindow): Promise<void> {
  if (is.dev) {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (!rendererUrl) throw new Error('ELECTRON_RENDERER_URL is required in development mode.')
    await window.loadURL(rendererUrl)
    return
  }

  await window.loadFile(join(__dirname, '../renderer/index.html'))
}

function createWindow(windowSettings = { width: 1200, height: 800, x: null as number | null, y: null as number | null }): BrowserWindow {
  const window = new BrowserWindow({
    width: windowSettings.width,
    height: windowSettings.height,
    x: windowSettings.x ?? undefined,
    y: windowSettings.y ?? undefined,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  window.setMenuBarVisibility(false)
  window.once('ready-to-show', () => window.show())
  void loadWindowContent(window)

  return window
}

app.whenReady().then(() => {
  configureContentSecurityPolicy()
  registerIpcHandlers()
  const settingsPath = join(app.getPath('userData'), 'settings.json')
  const defaults = createDefaultSettings(app.getPath('home'))
  void restoreSettings(settingsPath, defaults).then((settings) => {
    const window = createWindow(settings.window)
    window.on('close', () => {
      const bounds = window.getBounds()
      void restoreSettings(settingsPath, defaults).then((current) =>
        saveSettings(settingsPath, { ...current, window: { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y } })
      )
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
