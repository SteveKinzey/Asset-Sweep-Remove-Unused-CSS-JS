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
