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
  }
  findings: Finding[]
  errors: ScanError[]
}
