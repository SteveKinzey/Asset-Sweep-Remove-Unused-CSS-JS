import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverFiles } from '../../src/discover/files.js'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, 'a.css'), '.x{}')
  await writeFile(join(dir, 'b.html'), '<div/>')
  await mkdir(join(dir, 'node_modules'), { recursive: true })
  await writeFile(join(dir, 'node_modules', 'c.css'), '.y{}')
  return dir
}

test('finds matching files and excludes node_modules', async () => {
  const dir = await fixture()
  const files = await discoverFiles(dir, DEFAULT_CONFIG)
  const names = files.map(f => f.split('/').pop()).sort()
  expect(names).toEqual(['a.css', 'b.html'])
})

test('returns results in deterministic order', async () => {
  const dir = await fixture()
  expect(await discoverFiles(dir, DEFAULT_CONFIG))
    .toEqual(await discoverFiles(dir, DEFAULT_CONFIG))
})

test('excludes a nested node_modules directory, not just a top-level one', async () => {
  const dir = await fixture()
  await mkdir(join(dir, 'packages', 'foo', 'node_modules'), { recursive: true })
  await writeFile(join(dir, 'packages', 'foo', 'node_modules', 'nested.css'), '.z{}')
  await writeFile(join(dir, 'packages', 'foo', 'kept.css'), '.k{}')

  const files = await discoverFiles(dir, DEFAULT_CONFIG)
  const names = files.map(f => f.split('/').pop()).sort()
  expect(names).toEqual(['a.css', 'b.html', 'kept.css'])
})
