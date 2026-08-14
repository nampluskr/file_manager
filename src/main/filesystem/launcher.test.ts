import { describe, expect, it, vi } from 'vitest'
import { createLaunchPlan, isPresetId, launchPreset } from './launcher'

describe('createLaunchPlan', () => {
  const unsafeCwd = 'C:\\work & echo injected ^ %PATH%'

  it('passes an unsafe cwd to wt.exe as one argument without command composition', () => {
    expect(createLaunchPlan('claude', unsafeCwd, true)).toEqual({
      command: 'wt.exe',
      args: ['-d', unsafeCwd, 'cmd.exe', '/d', '/k', 'cmd.exe', '/d', '/c', 'claude'],
      cwd: unsafeCwd
    })
  })

  it('falls back to a detached cmd.exe command with cwd kept out of the arguments', () => {
    expect(createLaunchPlan('codex', unsafeCwd, false)).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/k', 'cmd.exe', '/d', '/c', 'codex'],
      cwd: unsafeCwd
    })
  })

  it('launches the code.cmd shim through cmd.exe /c with fixed arguments', () => {
    expect(createLaunchPlan('code', unsafeCwd, false)).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/c', 'code', '.'],
      cwd: unsafeCwd
    })
  })

  it('accepts only the five allowlisted preset ids', () => {
    expect(isPresetId('cmd')).toBe(true)
    expect(isPresetId('code')).toBe(true)
    expect(isPresetId('powershell -Command whoami')).toBe(false)
    expect(isPresetId('../cmd')).toBe(false)
  })
})

describe('launchPreset', () => {
  it('unrefs the created terminal process', () => {
    const unref = vi.fn()
    const run = vi.fn(() => ({ unref, once: vi.fn() }))

    launchPreset('agy', 'C:\\work', false, run)

    expect(run).toHaveBeenCalledWith({
      command: 'cmd.exe',
      args: ['/d', '/k', 'cmd.exe', '/d', '/c', 'agy'],
      cwd: 'C:\\work'
    })
    expect(unref).toHaveBeenCalledOnce()
  })
})
