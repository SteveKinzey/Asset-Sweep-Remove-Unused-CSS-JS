export interface AssetSweepConfig {
  include: string[]
  exclude: string[]
  ignoreSelectors: string[]
  ignoreClasses: string[]
  preserveComments: boolean
  safeMode: boolean
}
