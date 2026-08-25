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
  expect(deep?.line).toBe(3)
})

test('finds a class used only inside a <template> element', () => {
  const tokens = parseHtml('<template><div class="tmpl"></div></template>', 'i.html')
  expect(tokens.map(t => t.value)).toEqual(['tmpl'])
})

test('finds a class inside a <template> nested inside another <template>', () => {
  const source =
    '<template><div class="outer-tmpl">' +
    '<template><span class="inner-tmpl"></span></template>' +
    '</div></template>'
  const tokens = parseHtml(source, 'i.html')
  expect(tokens.map(t => t.value).sort()).toEqual(['inner-tmpl', 'outer-tmpl'])
})

test('ordinary markup outside any <template> still works alongside template contents', () => {
  const source =
    '<body class="page">' +
    '<template><div class="tmpl-only"></div></template>' +
    '<p class="regular"></p>' +
    '</body>'
  const tokens = parseHtml(source, 'i.html')
  expect(tokens.map(t => t.value).sort()).toEqual(['page', 'regular', 'tmpl-only'])
})
