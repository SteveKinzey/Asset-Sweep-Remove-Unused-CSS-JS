import type { Confidence } from '../types.js'

export const PHASE_1_REASON =
  'No matching class or id found in HTML. JavaScript was not analyzed, ' +
  'so a class applied at runtime would not be detected.'

function usageSourceErrorReason(usageSourceErrors: number): string {
  const plural = usageSourceErrors === 1 ? 'file' : 'files'
  return (
    `${usageSourceErrors} usage-source ${plural} (e.g. .html) could not be ` +
    'read or parsed, so this class or id may in fact be used in a file ' +
    'the scanner was unable to analyze. Confidence has been downgraded ' +
    'from medium to low because this scan is incomplete.'
  )
}

/**
 * Phase 1 caps confidence at 'medium' in the ordinary case: it reserves
 * 'high' for selectors proven absent from a project with no dynamic class
 * construction, and detecting that requires the JavaScript parser built in
 * Phase 2. But 'medium' itself asserts "no usage source contained this
 * class or id" — and that assertion is only honest if every usage-source
 * file (currently .html) was actually read and parsed. If one or more
 * failed, the surviving usage tokens are an incomplete picture, and
 * treating that incomplete picture as ordinary evidence would let a
 * scanner error masquerade as a scan result, so every css-selector finding
 * is downgraded to 'low' with a reason that says so plainly.
 */
export function scoreCssFinding(
  usageSourceErrors = 0,
): { confidence: Confidence; reason: string } {
  if (usageSourceErrors > 0) {
    return { confidence: 'low', reason: usageSourceErrorReason(usageSourceErrors) }
  }
  return { confidence: 'medium', reason: PHASE_1_REASON }
}
