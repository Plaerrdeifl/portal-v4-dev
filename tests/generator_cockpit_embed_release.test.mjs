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
  assert.equal(metadata.sourceCommit, '6149312736cc92455558e6f3bf6057a8f48a71bb')
  assert.equal(metadata.sourceMergeCommit, 'a0404cc080b21c42d2b62278d25bb74dc77d88ba')
  assert.equal(metadata.sourceWorkflowRunId, 41989214598)
  assert.equal(metadata.sourceArtifactId, 13396698530)
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
  assert.equal(new Set(metadata.masterLayers.map(layer => layer.path)).size, 18)
  for (const layer of metadata.masterLayers) {
    assert.match(layer.path, /^(?:embed\/)?sticker\/tor-v3\/\d{2}_[a-z0-9_]+\.png$/)
    const data = await readFile(join(root, 'assets/generator-dev', layer.path))
    assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(data.byteLength, layer.bytes, layer.path)
    assert.equal(hash(data), layer.sha256, layer.path)
    assert.equal(data.readUInt32BE(16), 768, layer.path)
    assert.equal(data.readUInt32BE(20), 768, layer.path)
    assert.equal(data[25], 6, 'RGBA alpha: ' + layer.path)
  }
  assert.deepEqual(metadata.masterManifests.map(file => file.path), [
    'sticker/tor-v3/manifest.json', 'embed/sticker/tor-v3/manifest.json'
  ])
  for (const file of metadata.masterManifests) {
    const bytes = await readFile(join(root, 'assets/generator-dev', file.path))
    assert.equal(bytes.byteLength, file.bytes)
    assert.equal(hash(bytes), file.sha256)
    const master = JSON.parse(bytes)
    assert.equal(master.version, 'tor-v3')
    assert.equal(master.size, 768)
    for (const [name, expected] of Object.entries(master.layers)) {
      for (const prefix of ['sticker/tor-v3/', 'embed/sticker/tor-v3/']) {
        const layer = metadata.masterLayers.find(item => item.path === prefix + name)
        assert.equal(layer?.sha256, expected.sha256, prefix + name)
      }
    }
  }
  for (const path of ['index.html', 'manifest.webmanifest', 'registerSW.js', 'sw.js']) {
    assert.ok(metadata.standaloneFiles.some(file => file.path === path), path)
  }
  for (const file of metadata.standaloneFiles) {
    assert.match(file.path, /^(?:assets\/[^/]+\.(?:js|css)|liveticker\/[^/]+\.jpg|index\.html|manifest\.webmanifest|registerSW\.js|sw\.js|workbox-[a-f0-9]+\.js)$/)
    const bytes = await readFile(join(root, 'assets/generator-dev', file.path))
    assert.equal(bytes.byteLength, file.bytes, file.path)
    assert.equal(hash(bytes), file.sha256, file.path)
  }
  assert.equal(metadata.timeoutLayers.length, 22)
  assert.equal(new Set(metadata.timeoutLayers.map(file => file.path)).size, 22)
  for (const file of metadata.timeoutLayers) {
    assert.match(file.path, /^(?:embed\/)?sticker\/timeout-v1\/(?:layers|masks)\/\d{2}_[a-z0-9_]+\.png$/)
    const bytes = await readFile(join(root, 'assets/generator-dev', file.path))
    assert.equal(bytes.byteLength, file.bytes, file.path)
    assert.equal(hash(bytes), file.sha256, file.path)
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(bytes.readUInt32BE(16), 1254, file.path)
    assert.equal(bytes.readUInt32BE(20), 1254, file.path)
    assert.equal(bytes[25], 6, 'RGBA alpha: ' + file.path)
  }
  assert.deepEqual(metadata.timeoutManifests.map(file => file.path), [
    'sticker/timeout-v1/manifest.json', 'embed/sticker/timeout-v1/manifest.json'
  ])
  for (const file of metadata.timeoutManifests) {
    const bytes = await readFile(join(root, 'assets/generator-dev', file.path))
    assert.equal(bytes.byteLength, file.bytes, file.path)
    assert.equal(hash(bytes), file.sha256, file.path)
    const master = JSON.parse(bytes)
    assert.equal(master.version, 'timeout-v1')
    assert.equal(master.layers.length, 6)
    assert.equal(master.masks.length, 5)
    assert.equal(master.size, 1254)
    for (const [name, expected] of Object.entries(master.files)) {
      for (const prefix of ['sticker/timeout-v1/', 'embed/sticker/timeout-v1/']) {
        const layer = metadata.timeoutLayers.find(item => item.path === prefix + name)
        assert.equal(layer?.sha256, expected.sha256, prefix + name)
      }
    }
  }

  assert.match(metadata.sourceArtifactSha256, /^[a-f0-9]{64}$/)
  assert.equal(metadata.emptyNetLayers.length, 24)
  assert.equal(new Set(metadata.emptyNetLayers.map(file => file.path)).size, 24)
  for (const file of metadata.emptyNetLayers) {
    assert.match(file.path, /^(?:embed\/)?sticker\/empty-net-v1\/(?:layers|masks)\/\d{2}a?_[a-z0-9_]+\.png$/)
    const bytes = await readFile(join(root, 'assets/generator-dev', file.path))
    assert.equal(bytes.byteLength, file.bytes, file.path)
    assert.equal(hash(bytes), file.sha256, file.path)
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(bytes.readUInt32BE(16), 1254, file.path)
    assert.equal(bytes.readUInt32BE(20), 1254, file.path)
    assert.equal(bytes[25], 6, 'RGBA alpha: ' + file.path)
  }
  assert.deepEqual(metadata.emptyNetManifests.map(file => file.path), [
    'sticker/empty-net-v1/manifest.json',
    'embed/sticker/empty-net-v1/manifest.json'
  ])
  for (const file of metadata.emptyNetManifests) {
    const bytes = await readFile(join(root, 'assets/generator-dev', file.path))
    assert.equal(bytes.byteLength, file.bytes, file.path)
    assert.equal(hash(bytes), file.sha256, file.path)
    const master = JSON.parse(bytes)
    assert.deepEqual(master.dimensions, [1254, 1254])
    assert.equal(master.files.length, 12)
    assert.equal(master.draw_order.length, 13)
    assert.equal(master.logo_slot.fit, 'contain')
    assert.equal(master.source_logo_removed_from_production_layers, true)
    const prefix = file.path.startsWith('embed/') ? 'embed/sticker/empty-net-v1/' : 'sticker/empty-net-v1/'
    for (const material of master.files) {
      const layer = metadata.emptyNetLayers.find(item => item.path === prefix + material.path)
      assert.equal(layer?.sha256, material.sha256, prefix + material.path)
    }
  }
  assert.equal(metadata.strafeLayers.length, 26)
  assert.equal(new Set(metadata.strafeLayers.map(file => file.path)).size, 26)
  for (const file of metadata.strafeLayers) {
    assert.match(file.path, /^(?:embed\/)?sticker\/strafe-v1\/(?:layers|masks)\/\d{2}a?_[a-z0-9_]+\.png$/)
    const bytes = await readFile(join(root, 'assets/generator-dev', file.path))
    assert.equal(bytes.byteLength, file.bytes, file.path)
    assert.equal(hash(bytes), file.sha256, file.path)
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(bytes.readUInt32BE(16), 1254, file.path)
    assert.equal(bytes.readUInt32BE(20), 1254, file.path)
    assert.equal(bytes[25], 6, 'RGBA alpha: ' + file.path)
  }
  assert.deepEqual(metadata.strafeManifests.map(file => file.path), [
    'sticker/strafe-v1/manifest.json',
    'embed/sticker/strafe-v1/manifest.json'
  ])
  for (const file of metadata.strafeManifests) {
    const bytes = await readFile(join(root, 'assets/generator-dev', file.path))
    assert.equal(bytes.byteLength, file.bytes, file.path)
    assert.equal(hash(bytes), file.sha256, file.path)
    const master = JSON.parse(bytes)
    assert.equal(master.stickerType, 'STRAFE')
    assert.equal(master.canvas.width, 1254)
    assert.equal(master.canvas.height, 1254)
    assert.equal(master.canvas.mode, 'RGBA')
    assert.equal(master.assets.length, 13)
    assert.equal(master.draw_order.length, 14)
    assert.equal(master.logo_slot.fit, 'contain')
    assert.equal(master.penalty_minutes, false)
    const prefix = file.path.startsWith('embed/') ? 'embed/sticker/strafe-v1/' : 'sticker/strafe-v1/'
    for (const material of master.assets) {
      const layer = metadata.strafeLayers.find(item => item.path === prefix + material.path)
      assert.equal(layer?.sha256, material.sha256, prefix + material.path)
    }
  }
  const rootRelease = JSON.parse(await readFile(join(root, 'assets/generator-dev/release.json'), 'utf8'))
  assert.equal(rootRelease.source_build_sha, metadata.sourceCommit)
  assert.equal(rootRelease.source_merge_sha, metadata.sourceMergeCommit)
  assert.equal(rootRelease.workflow_run_id, metadata.sourceWorkflowRunId)
  assert.equal(rootRelease.artifact_id, metadata.sourceArtifactId)
  assert.equal(rootRelease.artifact_sha256, metadata.sourceArtifactSha256)

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
  assert.match(js, /Sticker-Vorschau/)
  assert.match(js, /TIMEOUT/)
  assert.match(js, /EMPTY NET/)
  assert.match(js, /STRAFE/)
  assert.match(js, /sticker\/empty-net-v1/)
  assert.match(js, /sticker\/strafe-v1/)
  assert.match(js, /WhatsApp-WebP/)
  assert.match(js, /source-in/)
  assert.match(js, /sticker\/tor-v3/)
  assert.match(js, /sticker\/timeout-v1/)
  assert.match(js, /social_media_generator_media_teams_list/)
  assert.match(css, /sticker-brand-comparison/)
  assert.doesNotMatch(js, /registerSW\(|serviceWorker\.register/)
  const cockpitDir = join(root, 'integrations/cockpit/release/assets')
  const bundles = (await readdir(cockpitDir)).filter(name => /^index-.+\.js$/.test(name))
  assert.equal(bundles.length, 1)
  assert.match(await readFile(join(cockpitDir, bundles[0]), 'utf8'), /assets\/generator-dev\/embed\/module\.js/)
})
