import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import minimist from 'minimist'
import { scan } from './scan.js'
import { renderText } from './report/text.js'
import { renderJson } from './report/json.js'
import { unusedRatio } from './analyze/ratio.js'

// A future `clean` command deletes what this tool reports, and --threshold
// gates CI on that report, so a threshold that silently fails to parse
// (Number('abc') is NaN, and `ratio > NaN` is always false) makes the CI
// check permanently green instead of catching regressions. Returns null for
// anything that isn't a finite number in [0, 100] — including minimist's
// `true` for a bare `--threshold` with no value, which must be rejected
// rather than coerced to 1.
function parseThreshold(raw: unknown): number | null {
  if (typeof raw === 'boolean') {
    return null
  }
  if (raw === undefined) {
    return 0
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return null
  }
  return n
}

export async function main(argv: string[]): Promise<number> {
  try {
    const args = minimist(argv, {
      string: ['include', 'exclude', 'report', 'output', 'min-confidence'],
      default: { report: 'text' },
    })
    const [command, target] = args._

    if (command !== 'scan') {
      console.error('Usage: asset-sweep scan <directory> [options]')
      return 2
    }

    const threshold = parseThreshold(args.threshold)
    if (threshold === null) {
      console.error(
        `asset-sweep: --threshold must be a number between 0 and 100 ` +
        `(got: ${JSON.stringify(args.threshold)})`)
      return 2
    }

    const list = (v: unknown): string[] | undefined =>
      typeof v === 'string' ? v.split(',').map(s => s.trim()) : undefined

    const result = await scan(resolve(target ?? '.'), {
      ...(list(args.include) ? { include: list(args.include)! } : {}),
      ...(list(args.exclude) ? { exclude: list(args.exclude)! } : {}),
    })

    const RANK: Record<string, number> = { low: 0, medium: 1, high: 2 }
    const floor = args['min-confidence']
    if (floor !== undefined) {
      if (!(floor in RANK)) {
        console.error(
          `asset-sweep: --min-confidence must be low, medium, or high`)
        return 2
      }
      result.findings = result.findings.filter(
        f => RANK[f.confidence] >= RANK[floor])
      result.summary.unusedCss = result.findings.filter(
        f => f.type === 'css-selector').length
    }

    const output = args.report === 'json'
      ? renderJson(result) : renderText(result)

    if (args.output) {
      await writeFile(args.output, output, 'utf8')
    } else {
      console.log(output)
    }

    // unusedRatio is the single shared formula (see analyze/ratio.ts) —
    // not unused selectors over discovered-file count (which mixes two
    // different units and lets unrelated JS/etc. files added to the
    // project dilute the ratio).
    const ratio = unusedRatio(
      result.summary.unusedCss, result.summary.totalCssSelectors)

    // A usage-source failure (see analyze/confidence.ts) makes the whole
    // scan incomplete: the surviving findings are honestly downgraded to
    // 'low', but --min-confidence can filter those out and --threshold can
    // still pass, letting a scan that couldn't read its own inputs exit 0.
    // CI reads exit codes, not the WARNING line in stdout, so this has to
    // be enforced here regardless of what threshold/confidence decided.
    // Exit 1 (not 2): the scan did produce results, they're just
    // incomplete/untrustworthy — 2 is reserved for fatal failures where
    // nothing usable was produced at all.
    if (result.summary.usageSourceErrors > 0) {
      return 1
    }

    return ratio > threshold ? 1 : 0
  } catch (err) {
    console.error(`asset-sweep: ${(err as Error).message}`)
    return 2
  }
}
