import type { PresetId } from '../../shared/ipc'

export type LaunchPlan = {
  command: string
  args: string[]
  cwd: string
}

export type LaunchProcess = {
  unref: () => void
  once: (event: 'spawn' | 'error', listener: (error?: Error) => void) => LaunchProcess
}

export type LaunchRunner = (plan: LaunchPlan) => LaunchProcess

const TERMINAL_PRESETS: ReadonlySet<PresetId> = new Set(['cmd', 'claude', 'codex', 'agy'])

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && ['cmd', 'claude', 'codex', 'agy', 'code'].includes(value)
}

// All command fragments are fixed preset values. The user-controlled cwd is
// passed only as a process cwd or an individual wt.exe argument.
export function createLaunchPlan(preset: PresetId, cwd: string, hasWindowsTerminal: boolean): LaunchPlan {
  if (preset === 'code') {
    return { command: 'cmd.exe', args: ['/d', '/c', 'code', '.'], cwd }
  }

  if (!TERMINAL_PRESETS.has(preset)) throw new Error('Unsupported launch preset.')

  if (hasWindowsTerminal) {
    const terminalCommand =
      preset === 'cmd'
        ? ['cmd.exe', '/d', '/k']
        : ['cmd.exe', '/d', '/k', 'cmd.exe', '/d', '/c', preset]
    return { command: 'wt.exe', args: ['-d', cwd, ...terminalCommand], cwd }
  }

  return {
    command: 'cmd.exe',
    args: preset === 'cmd' ? ['/d', '/k'] : ['/d', '/k', 'cmd.exe', '/d', '/c', preset],
    cwd
  }
}

export function launchPreset(
  preset: PresetId,
  cwd: string,
  hasWindowsTerminal: boolean,
  run: LaunchRunner
): LaunchProcess {
  const process = run(createLaunchPlan(preset, cwd, hasWindowsTerminal))
  process.unref()
  return process
}
