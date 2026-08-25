import { glob } from 'glob'
import type { AssetSweepConfig } from '../config/types.js'

export async function discoverFiles(
  dir: string,
  config: AssetSweepConfig,
): Promise<string[]> {
  const matches = await glob(config.include, {
    cwd: dir,
    ignore: config.exclude,
    absolute: true,
    nodir: true,
    dot: false,
  })
  return matches.sort()
}
