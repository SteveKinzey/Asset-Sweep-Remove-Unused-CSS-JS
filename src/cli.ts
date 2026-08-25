import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import minimist from 'minimist'
import { scan } from './scan.js'
import { renderText } from './report/text.js'
import { renderJson } from './report/json.js'

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

    const threshold = Number(args.threshold ?? 0)
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
