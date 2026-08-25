import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import type { SelectorDef } from '../types.js'

// A class/id node whose nearest container is (eventually) a Pseudo node is
// an argument to a pseudo-class like :not()/:is()/:where()/:has() — e.g.
// the `.b` in `.a:not(.b)`. It is a negation/matching guard, not a
// definition the rule provides: `.a:not(.b)` styles elements that have `.a`
// and DON'T have `.b`, so `.b` is never something `.a`'s styling depends on
// existing. walkClasses/walkIds descend into these argument selectors too
// (they're full nested Selector trees), so we have to filter them back out
// by walking each node's ancestor chain.
function isInsidePseudoArgument(node: selectorParser.Node): boolean {
  let current = node.parent
  while (current) {
    if (current.type === 'pseudo') {
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
    const line = rule.source?.start?.line ?? 1
    const column = rule.source?.start?.column ?? 1
    const bytes = rule.toString().length

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
