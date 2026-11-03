import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '..')
const release = join(root, 'assets/generator-dev/embed')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

test('Generator embed is pinned to its verified DEV source and preserves the Cockpit shell', async () => {
  const metadata = JSON.parse(await readFile(join(release, 'release.json'), 'utf8'))
  assert.equal(metadata.schemaVersion, 1)
  assert.equal(metadata.environment, 'DEV')
  assert.equal(metadata.sourceRepository, 'Plaerrdeifl/social-media-generator')
  assert.equal(metadata.sourceCommit, 'd1fc8e00f72e0e521a9bcd2cd4bb7af1bed90c15')
  assert.equal(metadata.artifactPath, 'assets/generator-dev/embed')
  assert.match(metadata.sourcePackageLockSha256, /^[a-f0-9]{64}$/)
  assert.equal(metadata.files.length, 4)
  for (const file of metadata.files) {
    assert.match(file.path, /^(module\.js|style\.css|liveticker\/(?:post|story)-background\.jpg)$/)
    const data = await readFile(join(release, file.path))
    assert.equal(data.byteLength, file.bytes, file.path)
    assert.equal(hash(data), file.sha256, file.path)
  }
  const js = await readFile(join(release, 'module.js'), 'utf8')
  const css = await readFile(join(release, 'style.css'), 'utf8')
  assert.doesNotMatch(js, /process\.env\.NODE_ENV/)
  assert.match(js, /mountGenerator/)
  assert.match(js, /social_media_generator_bootstrap/)
  assert.match(css, /generator-workspace/)
  // Release must include the mobile editor tabs and all audited V4 effects.
  assert.match(js, /Grafikeditor-Bereiche/)
  assert.match(css, /editor-mobile-tabs/)
  assert.match(css, /editor-mobile-disclosure/)
  for (const effect of ['ice-depth-glow', 'metal-depth', 'sticker-gloss', 'ice-glow', 'frost-metal']) {
    assert.ok(js.includes(effect), `Missing trusted text effect: ${effect}`)
  }
  assert.doesNotMatch(js, /registerSW\(|serviceWorker\.register/)
  const cockpitDir = join(root, 'integrations/cockpit/release/assets')
  const bundles = (await readdir(cockpitDir)).filter(name => /^index-.+\.js$/.test(name))
  assert.equal(bundles.length, 1)
  assert.match(await readFile(join(cockpitDir, bundles[0]), 'utf8'), /assets\/generator-dev\/embed\/module\.js/)
})
