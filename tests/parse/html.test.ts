import { parseHtml } from '../../src/parse/html.js'

test('extracts class and id usage', () => {
  const tokens = parseHtml('<div class="a b" id="main"></div>', 'i.html')
  expect(tokens.filter(t => t.kind === 'class').map(t => t.value).sort())
    .toEqual(['a', 'b'])
  expect(tokens.filter(t => t.kind === 'id').map(t => t.value)).toEqual(['main'])
})

test('collapses repeated whitespace in class attributes', () => {
  const tokens = parseHtml('<div class="  a   b  "></div>', 'i.html')
  expect(tokens.map(t => t.value).sort()).toEqual(['a', 'b'])
})

test('finds classes on nested elements', () => {
  const tokens = parseHtml('<div class="outer"><p class="inner"></p></div>', 'i.html')
  expect(tokens.map(t => t.value).sort()).toEqual(['inner', 'outer'])
})

test('returns no tokens for markup with no classes or ids', () => {
  expect(parseHtml('<p>hello</p>', 'i.html')).toHaveLength(0)
})
