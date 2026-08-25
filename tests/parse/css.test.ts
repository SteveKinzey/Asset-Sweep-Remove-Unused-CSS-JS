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

test('does not treat a :not() argument as a definition', () => {
  const defs = parseCss('.a:not(.b) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})

test('does not treat an :is() argument as a definition', () => {
  const defs = parseCss('.a:is(.b, .c) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})

test('does not treat a :where() argument as a definition', () => {
  const defs = parseCss('.a:where(.b) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})

test('does not treat a :has() argument as a definition', () => {
  const defs = parseCss('.a:has(.b) { color: red }', 'a.css')
  expect(defs.map(d => d.name)).toEqual(['a'])
})

test('an ordinary compound and descendant selector still yields both classes', () => {
  const defs = parseCss('.btn:hover .icon { color: red }', 'a.css')
  expect(defs.map(d => d.name).sort()).toEqual(['btn', 'icon'])
})
