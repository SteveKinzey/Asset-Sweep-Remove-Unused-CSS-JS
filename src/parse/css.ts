import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import type { SelectorDef } from '../types.js'

// Only :not() and :has() arguments are guards, not definitions:
// `.guard:not(.excluded)` styles `.guard`, never `.excluded` — the rule
// never applies TO an element with `.excluded`. `.host:has(.child)` styles
// `.host`, conditioned on having a `.child` descendant, never `.child`
// itself. Neither ever "provides" the class/id inside it.
//
// :is()/:where() (and their legacy vendor-prefixed aliases
// :-webkit-any()/:-moz-any(), which predate :is() and mean the same thing)
// are NOT guards — they're a shorthand for a selector LIST. `:is(.card,
// .panel) > .title` is exactly `.card > .title, .panel > .title`: `.card`
// and `.panel` are genuine definition sites the rule styles through, and
// skipping them would make any class that only ever appears inside
// :is()/:where() permanently invisible to the scanner (a silent false
// negative — worse than a loud, safelist-able false positive). So they
// are deliberately absent from SKIP_PSEUDOS and fall through to "emit".
const SKIP_PSEUDOS = new Set([':not', ':has'])

// A class/id node whose ancestor chain passes through one of the
// SKIP_PSEUDOS is an argument to that guard pseudo-class — e.g. the `.b`
// in `.a:not(.b)`. walkClasses/walkIds descend into ALL pseudo argument
// selectors, including :is()/:where() (full nested Selector trees), so we
// walk the ancestor chain ourselves to tell guards from shorthand lists.
// The walk continues past a non-skip pseudo (:is()/:where()) in case an
// OUTER pseudo is a guard — `:not(:is(.x))` must still skip `.x`, since
// that's equivalent to `:not(.x)`.
function isInsidePseudoArgument(node: selectorParser.Node): boolean {
  let current = node.parent
  while (current) {
    if (current.type === 'pseudo' && SKIP_PSEUDOS.has(current.value.toLowerCase())) {
      return true
    }
    current = current.parent
  }
  return false
}

export function parseCss(source: string, file: string): SelectorDef[] {
  const defs: SelectorDef[] = []
  const root = postcss.parse(source, { from: file })

  root.walkRules(rule => {
    // line/column are the RULE's start position, computed once here and
    // reused for every class/id node found inside its selector below — not
    // each node's own position. That makes (file, line, column) a stable
    // identity for "which rule did this finding come from", which is
    // exactly what a savings calculation needs to sum each rule's bytes
    // once instead of once per class/id it happens to define (see scan.ts).
    const line = rule.source?.start?.line ?? 1
    const column = rule.source?.start?.column ?? 1
    // .length is a UTF-16 code-unit count, not a byte count: any rule
    // containing a non-ASCII character (e.g. `content: '→'`) would report
    // a smaller "savings" than the bytes actually shipped to the browser.
    // Buffer.byteLength measures the true UTF-8 byte size, which is what
    // "estimated savings" is supposed to mean.
    const bytes = Buffer.byteLength(rule.toString(), 'utf8')

    selectorParser(sel => {
      sel.walkClasses(node => {
        if (isInsidePseudoArgument(node)) {
          return
        }
        defs.push({ kind: 'class', name: node.value, raw: rule.selector,
                    file, line, column, bytes })
      })
      sel.walkIds(node => {
        if (isInsidePseudoArgument(node)) {
          return
        }
        defs.push({ kind: 'id', name: node.value, raw: rule.selector,
                    file, line, column, bytes })
      })
    }).processSync(rule.selector)
  })

  return defs
}
