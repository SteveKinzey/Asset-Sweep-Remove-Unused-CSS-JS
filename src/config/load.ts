import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AssetSweepConfig } from './types.js'
import { DEFAULT_CONFIG } from './defaults.js'

async function readJson(path: string): Promise<unknown | undefined> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return undefined          // absent is fine
  }
  try {
    return JSON.parse(raw)    // present but broken is not
  } catch (err) {
    throw new Error(`Could not parse ${path}: ${(err as Error).message}`)
  }
}

export async function loadConfig(dir: string): Promise<AssetSweepConfig> {
  const rc = await readJson(join(dir, '.asset-sweeprc.json'))
  if (rc && typeof rc === 'object') {
    return { ...DEFAULT_CONFIG, ...(rc as Partial<AssetSweepConfig>) }
  }
  const pkg = await readJson(join(dir, 'package.json'))
  const scoped = (pkg as { assetSweep?: Partial<AssetSweepConfig> })?.assetSweep
  if (scoped) {
    return { ...DEFAULT_CONFIG, ...scoped }
  }
  return { ...DEFAULT_CONFIG }
}
