import type { SelectorDef } from '../types.js'
import type { AssetSweepConfig } from '../config/types.js'

// `anchored` defaults to true: ignoreClasses matches a single class token
// in full ("js-*" must not match inside "not-js-toggle"). ignoreSelectors,
// on the other hand, matches against the RAW text of an entire rule's
// selector (e.g. Vue scoped styles compile to `[data-v-f3f3eg9] .my-class`)
// — the documented `[data-v-*]` recipe is only useful if it can match that
// attribute-selector fragment wherever it occurs in a larger compound
// selector, not only when the whole selector equals the pattern exactly.
function globToRegExp(pattern: string, anchored = true): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, '\\$&')
  const body = escaped.replace(/\*/g, '.*')
  return anchored ? new RegExp(`^${body}$`) : new RegExp(body)
}

export function isSafelisted(
  def: SelectorDef,
  config: AssetSweepConfig,
): boolean {
  // Both fields are documented as taking glob patterns (README's
  // `ignoreSelectors: ["[data-v-*]"]` recipe), so both reuse globToRegExp.
  // A pattern with no `*` still matches exactly when the raw selector IS
  // that pattern, and also matches when it's a fragment of a larger
  // compound selector containing it.
  if (config.ignoreSelectors.some(p => globToRegExp(p, false).test(def.raw))) {
    return true
  }
  return config.ignoreClasses.some(p => globToRegExp(p).test(def.name))
}
