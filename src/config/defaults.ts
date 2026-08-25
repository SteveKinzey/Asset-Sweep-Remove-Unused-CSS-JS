import type { AssetSweepConfig } from './types.js'

export const DEFAULT_CONFIG: AssetSweepConfig = {
  include: ['**/*.{html,htm,xhtml,js,jsx,ts,tsx,vue,svelte,css}'],
  exclude: ['**/node_modules/**', '**/dist/**'],
  ignoreSelectors: [],
  ignoreClasses: [],
  preserveComments: false,
  safeMode: false,
}
