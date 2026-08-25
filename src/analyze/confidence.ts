import type { Confidence } from '../types.js'

export const PHASE_1_REASON =
  'No matching class or id found in HTML. JavaScript was not analyzed, ' +
  'so a class applied at runtime would not be detected.'

/**
 * Phase 1 caps confidence at 'medium'. Spec section 7 reserves 'high' for
 * selectors proven absent from a project with no dynamic class construction,
 * and detecting that requires the JavaScript parser built in Phase 2.
 */
export function scoreCssFinding(): { confidence: Confidence; reason: string } {
  return { confidence: 'medium', reason: PHASE_1_REASON }
}
