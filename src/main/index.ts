import { app, BrowserWindow, dialog, globalShortcut, Menu, nativeImage, session, Tray } from 'electron'
import type { NativeImage } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { createDefaultSettings, restoreSettings, saveSettings } from './config/settings'

// SPEC.md §10.4: up to 24 drive probes (C:-Z:) run concurrently at startup,
// and a disconnected network drive occupies a libuv threadpool slot for the
// full probe timeout without actually cancelling -- withTimeout() in
// drives.ts only bounds how long the *caller* waits, not the underlying
// statfs() call itself. Sized to cover all 24 probes plus headroom for
// concurrent listDirectory/lstat work issued around the same time (A8 #1);
// 16 left up to 8 unrelated fs calls fully serialized behind worst-case
// probes. This still does not make the probes cancellable -- it only keeps
// them from exhausting the pool -- the same accepted trade-off already made
// for listDirectory's per-entry lstat timeout (see filesystem/timeoutUtils.ts).
// Must be set before any async fs call is made -- it is read lazily on the
// first threadpool submission, not at process start, so setting it here
// (before app.whenReady() triggers any fs work) is early enough.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE ?? '32'

// SPEC.md §19.1: closing the window hides it instead of quitting. Without a
// way to fully exit, the only path left is Task Manager -- a tray icon with
// a Quit item is the resident-app affordance for that. `isQuitting` lets the
// window's `close` handler tell a user-initiated close (hide) apart from an
// actual app.quit() (from the tray menu or `before-quit`).
let isQuitting = false
let tray: Tray | null = null
// Set once the main window exists; 'before-quit' awaits this so the final
// settings write (window bounds) is not truncated by the process exiting
// mid-write (A8 #5) -- Electron does not wait for pending promises once
// quit is finalized, so app.quit() from the tray's Quit item or the OS
// otherwise has no guarantee the in-flight saveSettings() completes.
let persistBoundsFn: (() => Promise<void>) | null = null

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

      async function persistWindowBounds(): Promise<void> {
        const bounds = window.getBounds()
        const current = await restoreSettings(settingsPath, defaults)
        await saveSettings(settingsPath, { ...current, window: { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y } })
      }
      persistBoundsFn = persistWindowBounds

      // SPEC.md §19.1: closing the window hides it instead of quitting. The
      // isQuitting branch here fires only for a 'close' that 'before-quit'
      // already let through (see below) -- that handler is the one that
      // actually awaits persistence, so this is fire-and-forget by design.
      window.on('close', (event) => {
        if (isQuitting) {
          void persistWindowBounds()
          return
        }
        event.preventDefault()
        window.hide()
        void persistWindowBounds()
      })

      const hotkeyRegistered = globalShortcut.register(settings.globalHotkey, () => {
        if (window.isVisible()) window.hide()
        else {
          window.show()
          window.focus()
        }
      })
      // globalShortcut.register() returns false instead of throwing when
      // another app already owns the accelerator. console.error() alone is
      // invisible in a packaged build (no console attached), which would
      // leave the show/hide hotkey permanently and silently dead (A8 #7) --
      // a one-time native dialog surfaces it without building a renderer
      // notification channel just for this rare case.
      if (!hotkeyRegistered) {
        console.error(`Failed to register global hotkey "${settings.globalHotkey}": already in use by another application.`)
        dialog.showErrorBox(
          'Personal File Manager',
          `전역 단축키(${settings.globalHotkey})를 등록하지 못했습니다. 다른 프로그램이 이미 사용 중일 수 있습니다. 창 표시/숨김 전환은 트레이 아이콘을 이용하세요.`
        )
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Gates the actual quit on the final settings write finishing (A8 #5).
  // The first 'before-quit' (from the tray's Quit item, Alt+F4-then-real-
  // close, or the OS) is intercepted; once persistBoundsFn's promise
  // settles, quitPersisted flips and the re-issued app.quit() falls through
  // this same handler without looping.
  let quitPersisted = false
  app.on('before-quit', (event) => {
    isQuitting = true
    if (quitPersisted || !persistBoundsFn) return
    event.preventDefault()
    void persistBoundsFn().finally(() => {
      quitPersisted = true
      app.quit()
    })
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    tray?.destroy()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
