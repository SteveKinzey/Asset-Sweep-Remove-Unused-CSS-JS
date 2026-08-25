import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import minimist from 'minimist'
import { scan } from './scan.js'
import { renderText } from './report/text.js'
import { renderJson } from './report/json.js'

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

    const total = result.summary.totalCssSelectors
    // A real percentage of unused CSS selectors out of all selectors
    // defined, not unused selectors over discovered-file count (which mixes
    // two different units and lets unrelated JS/etc. files added to the
    // project dilute the ratio). Zero selectors defined means zero unused
    // percent, not a NaN from a 0/0 division.
    const ratio = total > 0 ? (result.summary.unusedCss / total) * 100 : 0
    return ratio > threshold ? 1 : 0
  } catch (err) {
    console.error(`asset-sweep: ${(err as Error).message}`)
    return 2
  }
}
