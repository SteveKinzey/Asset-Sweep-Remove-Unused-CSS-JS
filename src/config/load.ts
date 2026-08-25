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
 * A usable config object: non-null, typeof 'object', and not an array.
 * Shared by both config sources so they cannot drift apart on what counts
 * as "an object" (arrays and primitives are not valid config containers).
 */
function isConfigObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  const rcPath = join(dir, '.asset-sweeprc.json')
  const rc = await readJson(rcPath)
  if (rc !== undefined) {
    if (!isConfigObject(rc)) {
      throw new Error(`Invalid config: ${rcPath} must contain a JSON object`)
    }
    const validated = validateConfigShape(rc)
    return { ...DEFAULT_CONFIG, ...validated }
  }

  const pkg = await readJson(join(dir, 'package.json'))
  const scoped = (pkg as { assetSweep?: unknown } | undefined)?.assetSweep
  if (scoped !== undefined) {
    if (!isConfigObject(scoped)) {
      throw new Error('Invalid config: "assetSweep" in package.json must be a JSON object')
    }
    const validated = validateConfigShape(scoped)
    return { ...DEFAULT_CONFIG, ...validated }
  }

  return { ...DEFAULT_CONFIG }
}
