import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultSettings, restoreSettings, saveSettings } from './settings'

describe('settings', () => {
  let fixtureDir = ''

  afterEach(async () => {
    if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
    fixtureDir = ''
  })

  async function createFixture(): Promise<{ settingsPath: string; defaults: ReturnType<typeof createDefaultSettings> }> {
    fixtureDir = await mkdtemp(join(tmpdir(), 'file-manager-settings-'))
    const homePath = join(fixtureDir, 'home')
    await mkdir(homePath)
    return { settingsPath: join(fixtureDir, 'settings.json'), defaults: createDefaultSettings(homePath) }
  }

  it('uses defaults when the settings file is missing or malformed', async () => {
    const { settingsPath, defaults } = await createFixture()
    await expect(restoreSettings(settingsPath, defaults)).resolves.toEqual(defaults)
    await writeFile(settingsPath, JSON.stringify({ ...defaults, window: undefined }), 'utf8')
    await expect(restoreSettings(settingsPath, defaults)).resolves.toEqual(defaults)
    await writeFile(settingsPath, '{broken', 'utf8')
    await expect(restoreSettings(settingsPath, defaults)).resolves.toEqual(defaults)
  })

  it('rejects invalid or duplicate favorite keys', async () => {
    const { settingsPath, defaults } = await createFixture()
    await writeFile(settingsPath, JSON.stringify({
      ...defaults,
      favorites: [{ key: 1, label: 'One', path: fixtureDir }, { key: 1, label: 'Duplicate', path: fixtureDir }]
    }), 'utf8')
    await expect(restoreSettings(settingsPath, defaults)).resolves.toEqual(defaults)
  })

  it('persists valid settings and falls back from a missing saved path to its existing parent', async () => {
    const { settingsPath, defaults } = await createFixture()
    const saved = {
      ...defaults,
      panes: { ...defaults.panes, left: { ...defaults.panes.left, path: join(fixtureDir, 'gone', 'nested') } },
      favorites: [{ key: 1, label: 'Fixture', path: fixtureDir }]
    }
    await saveSettings(settingsPath, saved)
    const restored = await restoreSettings(settingsPath, defaults)
    expect(restored.panes.left.path).toBe(fixtureDir)
    expect(restored.favorites).toEqual(saved.favorites)
  })
})
