import type { ScanResult, Confidence, Finding } from '../types.js'

const ORDER: Confidence[] = ['high', 'medium', 'low']

// Class findings render as `.name`, id findings as `#name`. Finding.name
// itself carries no sigil (JSON consumers rely on the bare name), so the
// report layer derives the sigil from selectorKind at render time.
function sigil(f: Finding): string {
  return f.selectorKind === 'id' ? '#' : '.'
}

export function renderText(result: ScanResult): string {
  const { summary, findings, errors } = result
  const lines: string[] = ['Asset Sweep Report', '==================', '']

  lines.push('Summary')
  lines.push(`  Files analyzed:    ${summary.filesAnalyzed}`)
  lines.push(`  Unused CSS rules:  ${summary.unusedCss}`)
  lines.push(`  Estimated savings: ${summary.estimatedSavings}`)
  if (summary.errors > 0) {
    lines.push(`  Files with errors: ${summary.errors}`)
  }
  lines.push('')

  if (findings.length === 0) {
    lines.push('No unused assets found.')
    return lines.join('\n')
  }

  for (const level of ORDER) {
    const group = findings.filter(f => f.confidence === level)
    if (group.length === 0) {
      continue
    }

    // Collect distinct reasons
    const distinctReasons = Array.from(new Set(group.map(f => f.reason)))

    lines.push(`${level.toUpperCase()} confidence (${group.length})`)

    if (distinctReasons.length === 1) {
      // Single reason: print group-level "why:" line (preserves Phase 1 output)
      for (const f of group) {
        lines.push(`  ${sigil(f)}${f.name}  ${f.file}:${f.line}  ${f.bytes} bytes`)
      }
      lines.push(`  why: ${distinctReasons[0]}`)
    } else {
      // Multiple reasons: print each finding's reason with that finding
      for (const f of group) {
        lines.push(`  ${sigil(f)}${f.name}  ${f.file}:${f.line}  ${f.bytes} bytes`)
        lines.push(`    reason: ${f.reason}`)
      }
    }

    lines.push('')
  }

  for (const e of errors) {
    lines.push(`  error: ${e.file}: ${e.message}`)
  }
  return lines.join('\n')
}
