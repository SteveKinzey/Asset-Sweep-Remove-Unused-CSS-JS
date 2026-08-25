import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import type { SelectorDef } from '../types.js'

export function parseCss(source: string, file: string): SelectorDef[] {
  const defs: SelectorDef[] = []
  const root = postcss.parse(source, { from: file })

  root.walkRules(rule => {
    const line = rule.source?.start?.line ?? 1
    const column = rule.source?.start?.column ?? 1
    const bytes = rule.toString().length

    selectorParser(sel => {
      sel.walkClasses(node => {
        defs.push({ kind: 'class', name: node.value, raw: rule.selector,
                    file, line, column, bytes })
      })
      sel.walkIds(node => {
        defs.push({ kind: 'id', name: node.value, raw: rule.selector,
                    file, line, column, bytes })
      })
    }).processSync(rule.selector)
  })

  return defs
}
