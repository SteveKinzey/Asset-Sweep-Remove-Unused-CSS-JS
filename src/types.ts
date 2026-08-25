export type Confidence = 'high' | 'medium' | 'low'

export interface Position { file: string; line: number; column: number }

export interface SelectorDef extends Position {
  kind: 'class' | 'id' | 'other'
  name: string
  raw: string
  bytes: number
}

export interface UsageToken extends Position {
  value: string
  kind: 'class' | 'id' | 'identifier' | 'dynamic'
}

export interface Finding extends Position {
  type: 'css-selector' | 'js-export'
  name: string
  bytes: number
  confidence: Confidence
  reason: string
  // Only set for type: 'css-selector'. Distinguishes a class (`.foo`) from
  // an id (`#foo`) finding so report renderers print the right sigil —
  // Finding.name itself stays a bare name with no sigil for JSON consumers.
  selectorKind?: 'class' | 'id'
}

export interface ScanError { file: string; message: string }

export interface ScanResult {
  summary: {
    filesAnalyzed: number
    unusedCss: number
    unusedJs: number
    estimatedSavings: string
    errors: number
    semanticMode: boolean
    totalCssSelectors: number
    // Count of usage-source files (currently .html) that failed to read or
    // parse. Usage sources contribute UsageTokens, so losing one can hide
    // real usage of a class/id and manufacture a false positive; a failed
    // .css file only loses definitions and cannot do that, so it is not
    // counted here. JSON consumers (e.g. CI) can gate on this directly
    // instead of having to infer it from `errors`, which mixes both kinds.
    usageSourceErrors: number
  }
  findings: Finding[]
  errors: ScanError[]
}
