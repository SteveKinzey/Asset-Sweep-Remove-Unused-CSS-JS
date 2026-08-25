import { parseCss } from '../../src/parse/css.js'

test('extracts class and id names', () => {
  const defs = parseCss('.header { color: red } #main { color: blue }', 'a.css')
  expect(defs.map(d => [d.kind, d.name])).toEqual([
    ['class', 'header'], ['id', 'main'],
  ])
})

test('extracts from compound and pseudo selectors without confusing parts', () => {
  const defs = parseCss('.btn:hover .icon { color: red }', 'a.css')
  expect(defs.map(d => d.name).sort()).toEqual(['btn', 'icon'])
})

test('does not treat attribute selector values as class names', () => {
  const defs = parseCss('[data-role="btn"] { color: red }', 'a.css')
  expect(defs.map(d => d.name)).not.toContain('btn')
})

test('ignores selectors that appear only inside comments', () => {
  expect(parseCss('/* .ghost { color: red } */', 'a.css')).toHaveLength(0)
})

test('records line numbers and rule byte size', () => {
  const [def] = parseCss('\n\n.late { color: red }', 'a.css')
  expect(def.line).toBe(3)
  expect(def.bytes).toBeGreaterThan(0)
})

// A rule containing a non-ASCII character has more UTF-8 bytes than
// UTF-16 code units (`.length`), e.g. an emoji is 1 UTF-16 code unit's
// worth of `.length` accounting quirks but 4 real bytes on the wire. Using
// `.length` under-reports the bytes a browser actually downloads.
test('bytes is a true UTF-8 byte count, not a UTF-16 code-unit count', () => {
  const rule = '.emoji { content: "🎉" }'
  const [def] = parseCss(rule, 'a.css')
  expect(def.bytes).toBe(Buffer.byteLength(rule, 'utf8'))
  expect(def.bytes).not.toBe(rule.length)
})

test('does not treat a :not() argument as a definition', () => {
  const defs = parseCss('.a:not(.b) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})

test('does not treat a :has() argument as a definition', () => {
  const defs = parseCss('.a:has(.b) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})

test(':not() argument is a guard, not a definition (coordinator repro fixture)', () => {
  const defs = parseCss('.guard:not(.excluded) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['guard'])
})

test(':has() argument is a condition, not a definition (coordinator repro fixture)', () => {
  const defs = parseCss('.host:has(.child) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['host'])
})

test('an ordinary compound and descendant selector still yields both classes', () => {
  const defs = parseCss('.btn:hover .icon { color: red }', 'a.css')
  expect(defs.map(d => d.name).sort()).toEqual(['btn', 'icon'])
})

// :is() and :where() are shorthand for a selector LIST, not a guard:
// `:is(.card, .panel) > .title` is exactly `.card > .title, .panel > .title`.
// `.card` and `.panel` are genuine definition sites the rule styles
// through, so they must be reported like any other class — skipping them
// (as an earlier version of this fix wrongly did) would make any class
// that only ever appears inside :is()/:where() permanently invisible to
// the scanner: a silent false negative, and dead CSS nobody could ever find.
test(':is() arguments are genuine definitions, not guards', () => {
  const defs = parseCss(':is(.card, .panel) > .title { color: red }', 'a.css')
  expect(defs.map(d => d.name).sort()).toEqual(['card', 'panel', 'title'])
})

test(':where() arguments are genuine definitions, not guards', () => {
  const defs = parseCss(':where(.wrapA) .inner { color: red }', 'a.css')
  expect(defs.map(d => d.name).sort()).toEqual(['inner', 'wrapA'])
})

test('nesting: an outer :not() still skips a class inside an inner :is()', () => {
  // :is(.a):not(.b) — .a sits inside :is() (not a guard, would normally
  // emit) but ALSO the whole compound has a sibling :not(.b): .b sits
  // inside :not() (a guard) and must still be skipped. Confirms the two
  // pseudo kinds are judged independently per ancestor chain, not by
  // "any pseudo ancestor at all".
  const defs = parseCss(':is(.a):not(.b) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})

test('nesting: a class inside :is() nested inside an outer :not() is still skipped', () => {
  // :not(:is(.x)) is equivalent to :not(.x) — .x is a guard even though
  // its nearest pseudo ancestor is :is(), because the OUTER :not() still
  // governs it.
  const defs = parseCss('.a:not(:is(.x)) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})

test('the legacy vendor-prefixed :-webkit-any()/:-moz-any() aliases are treated like :is(), not skipped', () => {
  const webkit = parseCss(':-webkit-any(.card, .panel) > .title { color: red }', 'a.css')
  expect(webkit.map(d => d.name).sort()).toEqual(['card', 'panel', 'title'])

  const moz = parseCss(':-moz-any(.card, .panel) > .title { color: red }', 'a.css')
  expect(moz.map(d => d.name).sort()).toEqual(['card', 'panel', 'title'])
})

test('pseudo-class names are matched case-insensitively', () => {
  const defs = parseCss('.a:NOT(.b):Has(.c) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})
