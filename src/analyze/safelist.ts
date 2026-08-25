import type { SelectorDef } from '../types.js'
import type { AssetSweepConfig } from '../config/types.js'

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`)
}

export function isSafelisted(
  def: SelectorDef,
  config: AssetSweepConfig,
): boolean {
  if (config.ignoreSelectors.includes(def.raw)) {
    return true
  }
  return config.ignoreClasses.some(p => globToRegExp(p).test(def.name))
}
