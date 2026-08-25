import { parse } from 'parse5'
import type { UsageToken } from '../types.js'

interface Attr { name: string; value: string }
interface Node {
  attrs?: Attr[]
  childNodes?: Node[]
  sourceCodeLocation?: { startLine: number; startCol: number } | null
}

export function parseHtml(source: string, file: string): UsageToken[] {
  const tokens: UsageToken[] = []
  const doc = parse(source, { sourceCodeLocationInfo: true }) as unknown as Node

  const visit = (node: Node): void => {
    const line = node.sourceCodeLocation?.startLine ?? 1
    const column = node.sourceCodeLocation?.startCol ?? 1

    for (const attr of node.attrs ?? []) {
      if (attr.name === 'class') {
        for (const value of attr.value.split(/\s+/).filter(Boolean)) {
          tokens.push({ value, kind: 'class', file, line, column })
        }
      } else if (attr.name === 'id' && attr.value.trim()) {
        tokens.push({ value: attr.value.trim(), kind: 'id', file, line, column })
      }
    }

    for (const child of node.childNodes ?? []) {
      visit(child)
    }
  }

  visit(doc)
  return tokens
}
