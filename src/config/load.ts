import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AssetSweepConfig } from './types.js'
import { DEFAULT_CONFIG } from './defaults.js'

const ARRAY_OF_STRING_FIELDS = [
  'include', 'exclude', 'ignoreSelectors', 'ignoreClasses',
] as const

const BOOLEAN_FIELDS = ['preserveComments', 'safeMode'] as const

function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string')
}

/**
 * Validates that any *present* field on a user-supplied config object has
 * the type AssetSweepConfig expects, and copies only known, valid fields
 * onto a partial result. Unknown keys are ignored silently so future config
 * keys do not break older versions of this tool. Throws an Error naming the
 * offending key and expected type on a mismatch.
 */
function validateConfigShape(
  raw: Record<string, unknown>,
): Partial<AssetSweepConfig> {
  const result: Partial<AssetSweepConfig> = {}

  for (const key of ARRAY_OF_STRING_FIELDS) {
    if (key in raw) {
      if (!isArrayOfStrings(raw[key])) {
        throw new Error(`Invalid config: "${key}" must be an array of strings`)
      }
      result[key] = raw[key] as string[]
    }
  }

  for (const key of BOOLEAN_FIELDS) {
    if (key in raw) {
      if (typeof raw[key] !== 'boolean') {
        throw new Error(`Invalid config: "${key}" must be a boolean`)
      }
      result[key] = raw[key] as boolean
    }
  }

  return result
}

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
    const validated = validateConfigShape(rc as Record<string, unknown>)
    return { ...DEFAULT_CONFIG, ...validated }
  }
  const pkg = await readJson(join(dir, 'package.json'))
  const scoped = (pkg as { assetSweep?: Record<string, unknown> })?.assetSweep
  if (scoped) {
    const validated = validateConfigShape(scoped)
    return { ...DEFAULT_CONFIG, ...validated }
  }
  return { ...DEFAULT_CONFIG }
}
