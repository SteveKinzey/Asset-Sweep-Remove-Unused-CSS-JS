import { parse } from 'parse5'
import type { DefaultTreeAdapterTypes as p5 } from 'parse5'
import type { UsageToken } from '../types.js'

export function parseHtml(source: string, file: string): UsageToken[] {
  const tokens: UsageToken[] = []
  const doc = parse(source, { sourceCodeLocationInfo: true })

  const visit = (node: p5.Node): void => {
    if ('attrs' in node) {
      const line = node.sourceCodeLocation?.startLine ?? 1
      const column = node.sourceCodeLocation?.startCol ?? 1

      for (const attr of node.attrs) {
        if (attr.name === 'class') {
          for (const value of attr.value.split(/\s+/).filter(Boolean)) {
            tokens.push({ value, kind: 'class', file, line, column })
          }
        } else if (attr.name === 'id' && attr.value.trim()) {
          tokens.push({ value: attr.value.trim(), kind: 'id', file, line, column })
        }
      }
    }

    if ('childNodes' in node) {
      for (const child of node.childNodes) {
        visit(child)
      }
    }

    // parse5 places a <template> element's contents under `node.content` (a
    // DocumentFragment), NOT under `node.childNodes` (which is empty for a
    // template). Skipping `.content` makes anything inside <template> —
    // web components, Alpine/HTMX patterns, cloneNode() templates, and
    // nested <template>s — invisible to the scanner, so those classes get
    // reported as unused even though the markup genuinely uses them.
    if ('content' in node) {
      visit(node.content)
    }
  }

  visit(doc)
  return tokens
}
