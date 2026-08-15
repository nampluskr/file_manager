import { app, BrowserWindow, globalShortcut, Menu, nativeImage, session, Tray } from 'electron'
import type { NativeImage } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { createDefaultSettings, restoreSettings, saveSettings } from './config/settings'

// SPEC.md §10.4: up to 24 drive probes (C:-Z:) run concurrently at startup,
// and a disconnected network drive occupies a libuv threadpool slot for the
// full probe timeout without actually cancelling. The default pool size (4)
// would let a handful of stuck probes serialize behind each other and delay
// unrelated fs work (e.g. a listDirectory issued around the same time).
// Must be set before any async fs call is made -- it is read lazily on the
// first threadpool submission, not at process start, so setting it here
// (before app.whenReady() triggers any fs work) is early enough.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE ?? '16'

// SPEC.md §19.1: closing the window hides it instead of quitting. Without a
// way to fully exit, the only path left is Task Manager -- a tray icon with
// a Quit item is the resident-app affordance for that. `isQuitting` lets the
// window's `close` handler tell a user-initiated close (hide) apart from an
// actual app.quit() (from the tray menu or `before-quit`).
let isQuitting = false
let tray: Tray | null = null

function createTrayIcon(): NativeImage {
  const size = 16
  const buffer = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    buffer[i * 4] = 0x00
    buffer[i * 4 + 1] = 0x7a
    buffer[i * 4 + 2] = 0xcc
    buffer[i * 4 + 3] = 0xff
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size })
}

function createTray(window: BrowserWindow): Tray {
  const trayInstance = new Tray(createTrayIcon())
  trayInstance.setToolTip('Personal File Manager')
  trayInstance.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show',
        click: () => {
          window.show()
          window.focus()
        }
      },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
  trayInstance.on('click', () => {
    if (window.isVisible()) window.hide()
    else {
      window.show()
      window.focus()
    }
  })
  return trayInstance
}

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

// SPEC.md §19.1: a second launch must not open a second window -- it should
// hand off to the already-running instance. requestSingleInstanceLock()
// must be checked before any other startup work; if this process lost the
// race, quit immediately rather than registering IPC handlers, a tray icon,
// or a global shortcut that would collide with the first instance's.
const singleInstanceAcquired = app.requestSingleInstanceLock()
if (!singleInstanceAcquired) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    configureContentSecurityPolicy()
    registerIpcHandlers()
    // app.getPath('userData') resolves to %APPDATA%\<productName>, which is
    // tied to the Windows user profile, not to where the portable .exe sits.
    // Moving the portable folder to a different drive or directory therefore
    // does not lose settings (PLAN.md Phase 8 adversarial focus). This is a
    // deliberate choice over PORTABLE_EXECUTABLE_DIR-relative storage: the
    // latter breaks when the folder is extracted somewhere read-only (e.g.
    // Program Files without elevation) or run straight from removable media
    // mounted read-only.
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    const defaults = createDefaultSettings(app.getPath('home'))
    void restoreSettings(settingsPath, defaults).then((settings) => {
      const window = createWindow(settings.window)
      mainWindow = window
      tray = createTray(window)

      function persistWindowBounds(): void {
        const bounds = window.getBounds()
        void restoreSettings(settingsPath, defaults).then((current) =>
          saveSettings(settingsPath, { ...current, window: { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y } })
        )
      }

      // SPEC.md §19.1: closing the window hides it instead of quitting.
      window.on('close', (event) => {
        if (isQuitting) {
          persistWindowBounds()
          return
        }
        event.preventDefault()
        window.hide()
        persistWindowBounds()
      })

      const hotkeyRegistered = globalShortcut.register(settings.globalHotkey, () => {
        if (window.isVisible()) window.hide()
        else {
          window.show()
          window.focus()
        }
      })
      // globalShortcut.register() returns false instead of throwing when
      // another app already owns the accelerator -- silently ignoring that
      // would leave the hotkey permanently dead with no indication why.
      if (!hotkeyRegistered) {
        console.error(`Failed to register global hotkey "${settings.globalHotkey}": already in use by another application.`)
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    tray?.destroy()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
