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

// .htm and .xhtml are the same markup as .html — a project that happens to
// use either extension deserves the exact same treatment, not silent
// non-support. Anywhere `.html` is checked as a usage source (parsing for
// UsageTokens, and counting a failed read/parse toward usageSourceErrors)
// must treat these identically, or a project on .htm/.xhtml gets every
// selector reported unused: none of its usage would ever be read.
const HTML_LIKE_EXTS = new Set(['.html', '.htm', '.xhtml'])
function isHtmlLike(ext: string): boolean {
  return HTML_LIKE_EXTS.has(ext)
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
  // Files that contribute UsageTokens (currently .html, .htm, .xhtml). If
  // one of these fails to read or parse, the surviving token set is
  // incomplete and can no longer prove a class/id is unused — see
  // analyze/confidence.ts.
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
      } else if (isHtmlLike(ext)) {
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
      if (isHtmlLike(ext)) {
        usageSourceErrors++
      }
    }
  }

  const findings = analyzeCss(defs, tokens, config, usageSourceErrors)

  // A single rule can define several classes/ids (`.parent .child { ... }`),
  // and each gets its own Finding when unused — parseCss stamps every
  // class/id it emits from one rule with that rule's own start (file, line,
  // column), never the individual node's position (see parse/css.ts), so
  // that triple is a stable identity for "which rule is this". Summing
  // every finding's `bytes` would therefore double-count a rule once per
  // selector it defines; summing each distinct rule identity once gives
  // the true byte savings from deleting it.
  const seenRules = new Set<string>()
  let savings = 0
  for (const f of findings) {
    const ruleId = `${f.file}:${f.line}:${f.column}`
    if (!seenRules.has(ruleId)) {
      seenRules.add(ruleId)
      savings += f.bytes
    }
  }

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
