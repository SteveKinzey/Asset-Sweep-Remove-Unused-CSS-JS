import { readFile } from 'node:fs/promises'
import { extname, relative } from 'node:path'
import type { ScanResult, SelectorDef, UsageToken, ScanError } from './types.js'
import type { AssetSweepConfig } from './config/types.js'
import { loadConfig } from './config/load.js'
import { discoverFiles } from './discover/files.js'
import { parseCss } from './parse/css.js'
import { parseHtml, extractInlineCss } from './parse/html.js'
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
  let filesAnalyzed = 0
  // Files that contribute UsageTokens (currently only .html). If one of
  // these fails to read or parse, the surviving token set is incomplete
  // and can no longer prove a class/id is unused — see analyze/confidence.ts.
  let usageSourceErrors = 0

  for (const file of files) {
    // Labels are relative to the caller's cwd (not the scan root), so a
    // printed "src/styles.css:2" resolves from where the user is standing
    // and is clickable in a terminal/editor, matching eslint/tsc/jest.
    const label = relative(process.cwd(), file)
    // Computed outside the try so a file that fails to even *read* is still
    // classified correctly below (extname works on the path, not the
    // content).
    const ext = extname(file)
    try {
      const source = await readFile(file, 'utf8')
      if (ext === '.css') {
        defs.push(...parseCss(source, label))
        filesAnalyzed++
      } else if (ext === '.html') {
        tokens.push(...parseHtml(source, label))
        // Inline <style> blocks contribute CSS definitions exactly as a
        // .css file would, attributed to this .html file so a finding
        // points at the .html path.
        defs.push(...extractInlineCss(source, label))
        filesAnalyzed++
      }
      // Other extensions are discovered but not yet parsed; Phase 2 adds them.
    } catch (err) {
      errors.push({ file: label, message: (err as Error).message })
      if (ext === '.html') {
        usageSourceErrors++
      }
    }
  }

  const findings = analyzeCss(defs, tokens, config, usageSourceErrors)
  const savings = findings.reduce((sum, f) => sum + f.bytes, 0)

  return {
    summary: {
      filesAnalyzed,
      unusedCss: findings.length,
      unusedJs: 0,
      estimatedSavings: formatBytes(savings),
      errors: errors.length,
      semanticMode: false,
      totalCssSelectors: defs.length,
      usageSourceErrors,
    },
    findings,
    errors,
  }
}
