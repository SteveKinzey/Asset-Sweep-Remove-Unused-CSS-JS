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

  // --threshold gates CI on unused-selectors ÷ total-selectors — the exact
  // bug this line guards against was computing that ratio over the wrong
  // denominator (files, not selectors) with nothing in the report to show
  // it. Printing both the fraction and the percentage here means a future
  // unit mismatch is visible on sight instead of latent in the exit code.
  const total = summary.totalCssSelectors
  const percent = total > 0 ? (summary.unusedCss / total) * 100 : 0

  lines.push('Summary')
  lines.push(`  Files analyzed:    ${summary.filesAnalyzed}`)
  lines.push(
    `  Unused selectors:  ${summary.unusedCss} / ${total}  ` +
    `(${percent.toFixed(1)}%)`)
  lines.push(`  Estimated savings: ${summary.estimatedSavings}`)
  if (summary.errors > 0) {
    lines.push(`  Files with errors: ${summary.errors}`)
  }
  lines.push('')

  if (summary.usageSourceErrors > 0) {
    const plural = summary.usageSourceErrors === 1 ? 'file' : 'files'
    lines.push(
      `WARNING: ${summary.usageSourceErrors} usage-source ${plural} ` +
      '(e.g. .html) could not be read or parsed. This scan is incomplete: ' +
      'findings below may be false positives, so their confidence has ' +
      'been downgraded to low.')
    lines.push('')
  }

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
