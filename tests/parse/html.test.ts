import { parseHtml } from '../../src/parse/html.js'

// Every fixture below deliberately puts the asserted token on a line other
// than 1. Earlier in this project's build, a wrong parse5 option made
// every token report line 1, and no test caught it because none asserted
// a line — a line-1 assertion would have passed against that broken
// implementation too, and been worthless as a regression guard.

test('extracts class and id usage', () => {
  const source = [
    '<div>',
    '  <p class="a b" id="main"></p>',
    '</div>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  expect(tokens.filter(t => t.kind === 'class').map(t => t.value).sort())
    .toEqual(['a', 'b'])
  expect(tokens.filter(t => t.kind === 'id').map(t => t.value)).toEqual(['main'])

  const id = tokens.find(t => t.kind === 'id')
  expect(id?.file).toBe('i.html')
  expect(id?.line).toBe(2)
})

test('collapses repeated whitespace in class attributes', () => {
  const source = [
    '<div>',
    '  <p class="  a   b  "></p>',
    '</div>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  expect(tokens.map(t => t.value).sort()).toEqual(['a', 'b'])

  const a = tokens.find(t => t.value === 'a')
  expect(a?.file).toBe('i.html')
  expect(a?.line).toBe(2)
})

test('finds classes on nested elements', () => {
  const source = [
    '<div class="outer">',
    '  <p class="inner"></p>',
    '</div>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  expect(tokens.map(t => t.value).sort()).toEqual(['inner', 'outer'])

  const inner = tokens.find(t => t.value === 'inner')
  expect(inner?.file).toBe('i.html')
  expect(inner?.line).toBe(2)
})

test('returns no tokens for markup with no classes or ids', () => {
  expect(parseHtml('<p>hello</p>', 'i.html')).toHaveLength(0)
})

test('reports the real line number of a class on a nested element in multi-line markup', () => {
  const source = [
    '<div class="outer">',
    '  <span>x</span>',
    '  <p class="deep">y</p>',
    '</div>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  const outer = tokens.find(t => t.value === 'outer')
  const deep = tokens.find(t => t.value === 'deep')

  expect(outer?.line).toBe(1)
  expect(deep?.file).toBe('i.html')
  expect(deep?.line).toBe(3)
})

test('finds a class used only inside a <template> element', () => {
  const source = [
    '<template>',
    '  <div class="tmpl"></div>',
    '</template>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  expect(tokens.map(t => t.value)).toEqual(['tmpl'])
  expect(tokens[0]?.file).toBe('i.html')
  expect(tokens[0]?.line).toBe(2)
})

test('finds a class inside a <template> nested inside another <template>', () => {
  const source = [
    '<template>',
    '  <div class="outer-tmpl">',
    '    <template><span class="inner-tmpl"></span></template>',
    '  </div>',
    '</template>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  expect(tokens.map(t => t.value).sort()).toEqual(['inner-tmpl', 'outer-tmpl'])

  const inner = tokens.find(t => t.value === 'inner-tmpl')
  expect(inner?.file).toBe('i.html')
  expect(inner?.line).toBe(3)
})

test('finds a class used only inside a <noscript> element', () => {
  const source = [
    '<div class="page">',
    '  <noscript>',
    '    <div class="n-class">JS is disabled</div>',
    '  </noscript>',
    '</div>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  expect(tokens.map(t => t.value).sort()).toEqual(['n-class', 'page'])

  const noscriptClass = tokens.find(t => t.value === 'n-class')
  expect(noscriptClass?.file).toBe('i.html')
  expect(noscriptClass?.line).toBe(3)
})

test('a class-shaped string inside an inline <script> produces no usage token (scriptingEnabled must not leak into <script>)', () => {
  const source = [
    '<div class="page">',
    '  <script>',
    '    var s = \'<div class="phantom"></div>\';',
    '  </script>',
    '</div>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  // "phantom" must NOT appear as a usage token: <script> contents are
  // always raw text regardless of scriptingEnabled, so this string
  // literal must never be parsed as markup. If it were, .phantom would
  // wrongly look "used" and the scanner would never flag genuinely dead
  // CSS — a false negative, the trap this test guards against.
  expect(tokens.map(t => t.value)).not.toContain('phantom')
  expect(tokens.map(t => t.value).sort()).toEqual(['page'])
})

test('ordinary markup outside any <template> still works alongside template contents', () => {
  const source = [
    '<body class="page">',
    '<template><div class="tmpl-only"></div></template>',
    '<p class="regular"></p>',
    '</body>',
  ].join('\n')
  const tokens = parseHtml(source, 'i.html')

  expect(tokens.map(t => t.value).sort()).toEqual(['page', 'regular', 'tmpl-only'])

  const regular = tokens.find(t => t.value === 'regular')
  expect(regular?.file).toBe('i.html')
  expect(regular?.line).toBe(3)
})
