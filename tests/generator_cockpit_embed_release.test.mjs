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
  assert.equal(metadata.sourceCommit, '4d6a5637c7a8b555f246ba067bb828c7d1a9b258')
  assert.equal(metadata.artifactPath, 'assets/generator-dev/embed')
  assert.match(metadata.sourcePackageLockSha256, /^[a-f0-9]{64}$/)
  assert.equal(metadata.files.length, 4)
  for (const file of metadata.files) {
    assert.match(file.path, /^(module\.js|style\.css|liveticker\/(?:post|story)-background\.jpg)$/)
    const data = await readFile(join(release, file.path))
    assert.equal(data.byteLength, file.bytes, file.path)
    assert.equal(hash(data), file.sha256, file.path)
  }
  assert.equal(metadata.masterLayers.length, 18)
  for (const layer of metadata.masterLayers) {
    assert.match(layer.path, /^(?:embed\/)?sticker\/tor-v2\/\d{2}_[a-z0-9_]+\.png$/)
    const data = await readFile(join(root, 'assets/generator-dev', layer.path))
    assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(data.byteLength, layer.bytes, layer.path)
    assert.equal(hash(data), layer.sha256, layer.path)
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
  // The template action must not be confused with a graphic draft or auto-publishing.
  for (const label of ['Grafik aus Vorlage erstellen', 'Vorlage bearbeiten',
    'Vorlagenentwurf bearbeiten', 'Vorlage veröffentlichen',
    'Als neue Vorlage speichern']) {
    assert.ok(js.includes(label), `Missing template workflow: ${label}`)
  }
  for (const effect of ['ice-depth-glow', 'metal-depth', 'sticker-gloss', 'ice-glow', 'frost-metal']) {
    assert.ok(js.includes(effect), `Missing trusted text effect: ${effect}`)
  }
  // Team-color sticker preview must use central team API without editing templates.
  assert.match(js, /Sticker-Master \(DEV-Prototyp\)/)
  assert.match(js, /Tor-Master: PNG-Farbmasken/)
  assert.match(js, /WhatsApp-WebP/)
  assert.match(js, /source-in/)
  assert.match(js, /sticker\/tor-v2/)
  assert.match(js, /social_media_generator_media_teams_list/)
  assert.match(css, /sticker-brand-comparison/)
  assert.doesNotMatch(js, /registerSW\(|serviceWorker\.register/)
  const cockpitDir = join(root, 'integrations/cockpit/release/assets')
  const bundles = (await readdir(cockpitDir)).filter(name => /^index-.+\.js$/.test(name))
  assert.equal(bundles.length, 1)
  assert.match(await readFile(join(cockpitDir, bundles[0]), 'utf8'), /assets\/generator-dev\/embed\/module\.js/)
})
