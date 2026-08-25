import type { SelectorDef } from '../types.js'
import type { AssetSweepConfig } from '../config/types.js'

// Both ignoreSelectors and ignoreClasses use the SAME anchored glob
// semantics: the whole string must match the pattern end to end, with `*`
// as the only wildcard. Anchoring is what stops a short pattern from
// swallowing unrelated selectors — an unanchored `a` would match ".alpha"
// AND ".beta" as a substring, silently safelisting both. A false positive
// is loud (the user sees a wrong finding); a safelist swallowing real dead
// CSS is silent (the finding just never appears) and strictly worse, so
// both fields share this one helper and cannot drift apart.
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`)
}

export function isSafelisted(
  def: SelectorDef,
  config: AssetSweepConfig,
): boolean {
  // ignoreSelectors matches against the full raw selector text of the
  // rule (e.g. `[data-v-1] .scoped`); ignoreClasses matches against a
  // single class name. Both require the pattern to cover the ENTIRE
  // string, so a pattern like "[data-v-*] *" is needed to safelist a
  // compound selector — "[data-v-*]" alone will not, since it doesn't
  // cover the trailing " .scoped" — see the README for the working recipe.
  if (config.ignoreSelectors.some(p => globToRegExp(p).test(def.raw))) {
    return true
  }
  return config.ignoreClasses.some(p => globToRegExp(p).test(def.name))
}
