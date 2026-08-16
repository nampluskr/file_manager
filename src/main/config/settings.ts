import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join, parse } from 'node:path'
import type { Settings, SortKey } from '../../shared/types'

const SORT_KEYS: readonly SortKey[] = ['name', 'ext', 'size', 'mtime']

function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && SORT_KEYS.includes(value as SortKey)
}

export function createDefaultSettings(homePath: string): Settings {
  return {
    version: 1,
    panes: {
      left: { path: homePath, sortKey: 'name', sortAsc: true },
      right: { path: homePath, sortKey: 'name', sortAsc: true }
    },
    activePane: 'left',
    theme: 'dark',
    window: { width: 1200, height: 800, x: null, y: null },
    favorites: [],
    globalHotkey: 'Alt+`'
  }
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false
  const settings = value as Partial<Settings>
  const panes = settings.panes
  const window = settings.window
  const validCoordinate = (coordinate: unknown): coordinate is number | null => coordinate === null || (typeof coordinate === 'number' && Number.isFinite(coordinate))
  const favoriteKeys = new Set<number>()
  const validFavorites = Array.isArray(settings.favorites) && settings.favorites.every((favorite) => {
    if (
      typeof favorite !== 'object' ||
      favorite === null ||
      !Number.isInteger(favorite.key) ||
      favorite.key < 1 ||
      favorite.key > 9 ||
      typeof favorite.label !== 'string' ||
      typeof favorite.path !== 'string' ||
      favorite.path.length === 0 ||
      favoriteKeys.has(favorite.key)
    ) return false
    favoriteKeys.add(favorite.key)
    return true
  })
  return (
    settings.version === 1 &&
    typeof panes === 'object' &&
    panes !== null &&
    typeof panes.left?.path === 'string' &&
    isSortKey(panes.left.sortKey) &&
    typeof panes.left.sortAsc === 'boolean' &&
    typeof panes.right?.path === 'string' &&
    isSortKey(panes.right.sortKey) &&
    typeof panes.right.sortAsc === 'boolean' &&
    (settings.activePane === 'left' || settings.activePane === 'right') &&
    (settings.theme === 'dark' || settings.theme === 'light' || settings.theme === 'dim') &&
    typeof window === 'object' &&
    window !== null &&
    typeof window.width === 'number' && Number.isFinite(window.width) && window.width > 0 &&
    typeof window.height === 'number' && Number.isFinite(window.height) && window.height > 0 &&
    validCoordinate(window.x) && validCoordinate(window.y) &&
    Array.isArray(settings.favorites) && validFavorites &&
    typeof settings.globalHotkey === 'string'
  )
}

export async function loadSettings(settingsPath: string, defaults: Settings): Promise<Settings> {
  try {
    const parsed: unknown = JSON.parse(await readFile(settingsPath, 'utf8'))
    return isSettings(parsed) ? parsed : defaults
  } catch {
    return defaults
  }
}

async function closestExistingDirectory(candidate: string, fallback: string): Promise<string> {
  let current = candidate
  while (true) {
    try {
      if ((await stat(current)).isDirectory()) return current
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
      // Only absent paths fall back. Permission errors must remain visible to
      // the pane rather than silently redirecting users somewhere else.
      if (code !== 'ENOENT' && code !== 'ENOTDIR') return current
    }
    const parent = dirname(current)
    if (parent === current || parent === parse(current).root) return fallback
    current = parent
  }
}

export async function restoreSettings(settingsPath: string, defaults: Settings): Promise<Settings> {
  const settings = await loadSettings(settingsPath, defaults)
  return {
    ...settings,
    panes: {
      left: { ...settings.panes.left, path: await closestExistingDirectory(settings.panes.left.path, defaults.panes.left.path) },
      right: { ...settings.panes.right, path: await closestExistingDirectory(settings.panes.right.path, defaults.panes.right.path) }
    }
  }
}

let writeCounter = 0

async function writeSettingsFile(settingsPath: string, settings: Settings): Promise<void> {
  if (!isSettings(settings)) throw new Error('Invalid settings.')
  await mkdir(dirname(settingsPath), { recursive: true })
  // A counter (not just Date.now()) keeps two saves issued in the same
  // millisecond -- e.g. the renderer's debounced autosave landing next to a
  // window-close bounds update -- from generating the same temp filename
  // and racing each other's write/rename (A8 #5).
  const temporaryPath = join(dirname(settingsPath), `.${Date.now()}-${++writeCounter}-settings.json.tmp`)
  await writeFile(temporaryPath, JSON.stringify(settings, null, 2), 'utf8')
  await rename(temporaryPath, settingsPath)
}

// Two independent callers -- the renderer's config:save IPC handler and
// main's own window-close/quit bounds persistence -- can both want to write
// settings.json around the same moment. Without serialization the two
// full-snapshot writes race and whichever finishes last silently wins,
// possibly restoring a stale path/theme/sort/bounds (A8 #5). Every caller
// in this file goes through this single queue instead of calling
// writeSettingsFile() directly.
let saveQueue: Promise<void> = Promise.resolve()

export function saveSettings(settingsPath: string, settings: Settings): Promise<void> {
  const next = saveQueue.then(() => writeSettingsFile(settingsPath, settings))
  // Swallow so one failed save doesn't permanently wedge the queue for
  // later callers; each caller still gets its own rejection via `next`.
  saveQueue = next.catch(() => undefined)
  return next
}
