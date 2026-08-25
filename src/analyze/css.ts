import type { SelectorDef, UsageToken, Finding } from '../types.js'
import type { AssetSweepConfig } from '../config/types.js'
import { isSafelisted } from './safelist.js'
import { scoreCssFinding } from './confidence.js'

export function analyzeCss(
  defs: SelectorDef[],
  tokens: UsageToken[],
  config: AssetSweepConfig,
): Finding[] {
  const usedClasses = new Set(
    tokens.filter(t => t.kind === 'class').map(t => t.value))
  const usedIds = new Set(
    tokens.filter(t => t.kind === 'id').map(t => t.value))

  const findings: Finding[] = []
  const seen = new Set<string>()

  for (const def of defs) {
    if (isSafelisted(def, config)) {
      continue
    }

    const used = def.kind === 'class' ? usedClasses.has(def.name)
               : def.kind === 'id'    ? usedIds.has(def.name)
               : true                 // 'other' kinds are never reported
    if (used) {
      continue
    }

    const key = `${def.file}:${def.line}:${def.kind}:${def.name}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)

    const { confidence, reason } = scoreCssFinding()
    findings.push({
      type: 'css-selector', name: def.name, file: def.file,
      line: def.line, column: def.column, bytes: def.bytes,
      confidence, reason,
    })
  }

  return findings
}
