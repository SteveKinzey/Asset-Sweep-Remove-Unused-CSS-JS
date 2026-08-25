import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { ScanResult, SelectorDef, UsageToken, ScanError } from './types.js'
import type { AssetSweepConfig } from './config/types.js'
import { loadConfig } from './config/load.js'
import { discoverFiles } from './discover/files.js'
import { parseCss } from './parse/css.js'
import { parseHtml } from './parse/html.js'
import { analyzeCss } from './analyze/css.js'

function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

export async function scan(
  dir: string,
  overrides: Partial<AssetSweepConfig> = {},
): Promise<ScanResult> {
  const config = { ...(await loadConfig(dir)), ...overrides }
  const files = await discoverFiles(dir, config)

  if (files.length === 0) {
    throw new Error(
      `No files matched in ${dir}. Check the include and exclude patterns.`)
  }

  const defs: SelectorDef[] = []
  const tokens: UsageToken[] = []
  const errors: ScanError[] = []

  for (const file of files) {
    try {
      const source = await readFile(file, 'utf8')
      const ext = extname(file)
      if (ext === '.css') {
        defs.push(...parseCss(source, file))
      } else if (ext === '.html') {
        tokens.push(...parseHtml(source, file))
      }
      // Other extensions are discovered but not yet parsed; Phase 2 adds them.
    } catch (err) {
      errors.push({ file, message: (err as Error).message })
    }
  }

  const findings = analyzeCss(defs, tokens, config)
  const savings = findings.reduce((sum, f) => sum + f.bytes, 0)

  return {
    summary: {
      filesAnalyzed: files.length - errors.length,
      unusedCss: findings.length,
      unusedJs: 0,
      estimatedSavings: formatBytes(savings),
      errors: errors.length,
      semanticMode: false,
    },
    findings,
    errors,
  }
}
