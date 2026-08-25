import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../../src/config/load.js'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'

test('returns defaults when no config file exists', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  expect(await loadConfig(dir)).toEqual(DEFAULT_CONFIG)
})

test('.asset-sweeprc.json overrides defaults', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'),
    JSON.stringify({ ignoreClasses: ['js-*'] }))
  const cfg = await loadConfig(dir)
  expect(cfg.ignoreClasses).toEqual(['js-*'])
  expect(cfg.include).toEqual(DEFAULT_CONFIG.include)
})

test('package.json assetSweep key is read', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, 'package.json'),
    JSON.stringify({ assetSweep: { safeMode: true } }))
  expect((await loadConfig(dir)).safeMode).toBe(true)
})

test('malformed config rejects rather than silently defaulting', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'), '{ not json')
  await expect(loadConfig(dir)).rejects.toThrow(/\.asset-sweeprc\.json/)
})

test('a wrong-typed array field is rejected with the offending key named', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'),
    JSON.stringify({ ignoreClasses: 'foo' }))
  await expect(loadConfig(dir)).rejects.toThrow(/ignoreClasses/)
})

test('a wrong-typed boolean field is rejected with the offending key named', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'),
    JSON.stringify({ safeMode: 'yes' }))
  await expect(loadConfig(dir)).rejects.toThrow(/safeMode/)
})

test('an unknown key is tolerated silently', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'),
    JSON.stringify({ futureFeature: true }))
  const cfg = await loadConfig(dir)
  expect(cfg).toEqual(DEFAULT_CONFIG)
})

test('package.json assetSweep as a string throws an Error naming assetSweep', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, 'package.json'),
    JSON.stringify({ assetSweep: 'foo' }))
  await expect(loadConfig(dir)).rejects.toThrow(/assetSweep/)
})

test('package.json assetSweep as an array throws an Error naming assetSweep', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, 'package.json'),
    JSON.stringify({ assetSweep: [] }))
  await expect(loadConfig(dir)).rejects.toThrow(/assetSweep/)
})

test('.asset-sweeprc.json containing an array throws an Error naming the file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'), JSON.stringify([]))
  await expect(loadConfig(dir)).rejects.toThrow(/\.asset-sweeprc\.json/)
})

test('.asset-sweeprc.json containing a boolean throws an Error naming the file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'), JSON.stringify(true))
  await expect(loadConfig(dir)).rejects.toThrow(/\.asset-sweeprc\.json/)
})
