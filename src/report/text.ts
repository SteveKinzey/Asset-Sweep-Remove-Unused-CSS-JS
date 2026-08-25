import type { ScanResult, Confidence } from '../types.js'

const ORDER: Confidence[] = ['high', 'medium', 'low']

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
    lines.push(`${level.toUpperCase()} confidence (${group.length})`)
    for (const f of group) {
      lines.push(`  .${f.name}  ${f.file}:${f.line}  ${f.bytes} bytes`)
    }
    lines.push(`  why: ${group[0].reason}`)
    lines.push('')
  }

  for (const e of errors) {
    lines.push(`  error: ${e.file}: ${e.message}`)
  }
  return lines.join('\n')
}
