import { parse } from 'parse5'
import type { DefaultTreeAdapterTypes as p5 } from 'parse5'
import type { SelectorDef, UsageToken } from '../types.js'
import { parseCss } from './css.js'

export function parseHtml(source: string, file: string): UsageToken[] {
  const tokens: UsageToken[] = []
  // parse5 defaults scriptingEnabled to true, which — per the WHATWG
  // spec's "scripting flag" — treats <noscript> contents as RAWTEXT
  // (unparsed), on the assumption that a real browser executes JS and
  // never renders <noscript>. But <noscript> content is genuine markup
  // that DOES render whenever JS is disabled, so leaving it unparsed
  // makes any class/id used only inside it invisible, producing a false
  // positive (it gets reported as unused). scriptingEnabled: false makes
  // parse5 parse <noscript> contents as normal markup instead.
  //
  // This flag is parser-wide, not <noscript>-specific — but <script> is
  // independently always RAWTEXT per the HTML tokenizer's "script data
  // state" regardless of the scripting flag, so <script> contents remain
  // unparsed either way. (Verified empirically; see tests/parse/html.test.ts.)
  const doc = parse(source, { sourceCodeLocationInfo: true, scriptingEnabled: false })

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

// CSS written inside an HTML <style> block is real CSS and can be just as
// dead as anything in a .css file, but the scanner only ever read .css
// files for definitions — an entire category of dead CSS was invisible.
// This walks the same parsed document looking for <style> elements,
// extracts their text content, and runs it through the existing parseCss
// so inline rules are reported exactly as a .css file's rules would be,
// attributed to the .html file they live in.
//
// Deliberately does NOT look inside <script>: JavaScript analysis is not
// implemented in Phase 1, and scanning <script> text for CSS-shaped
// tokens would be faking a capability that doesn't exist.
export function extractInlineCss(source: string, file: string): SelectorDef[] {
  const defs: SelectorDef[] = []
  const doc = parse(source, { sourceCodeLocationInfo: true, scriptingEnabled: false })

  const visit = (node: p5.Node): void => {
    if ('tagName' in node && node.tagName === 'style') {
      for (const child of node.childNodes) {
        // 'value' (rather than nodeName === '#text') is what narrows the
        // union to TextNode here: Element's `nodeName` is typed as a plain
        // `string`, so a `nodeName === '#text'` check alone doesn't
        // exclude Element for TypeScript's control-flow analysis.
        if ('value' in child && child.sourceCodeLocation) {
          const loc = child.sourceCodeLocation

          // parseCss computes line/column relative to whatever string it is
          // given, starting at line 1. A <style> block's CSS text starts
          // partway down the real .html file, so reporting those numbers
          // as-is would put every inline finding at the wrong line — the
          // same "everything reports line 1" bug class this project has
          // already been bitten by once (see torture.test.ts). Instead of
          // adding an offset to the numbers AFTER parseCss returns (easy to
          // forget or get off-by-one), pad the extracted text with the same
          // number of leading blank lines — and leading spaces on the first
          // line — that precede it in the real file, so parseCss's own line
          // 1/column 1 IS the real file's line/column. No arithmetic left
          // to skip.
          const padding = '\n'.repeat(loc.startLine - 1) + ' '.repeat(loc.startCol - 1)
          defs.push(...parseCss(padding + child.value, file))
        }
      }
    }

    if ('childNodes' in node) {
      for (const child of node.childNodes) {
        visit(child)
      }
    }

    if ('content' in node) {
      visit(node.content)
    }
  }

  visit(doc)
  return defs
}
