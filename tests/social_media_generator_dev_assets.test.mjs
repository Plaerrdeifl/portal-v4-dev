import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const indexPath = 'assets/generator-dev/index.html';
const manifestPath = 'assets/generator-dev/manifest.webmanifest';

test('generator DEV asset bundle is rooted below /assets/generator-dev/', async () => {
  const html = await fs.readFile(indexPath, 'utf8');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

  assert.match(html, /src="\/assets\/generator-dev\/assets\/index-[^"]+\.js"/);
  assert.match(html, /href="\/assets\/generator-dev\/manifest\.webmanifest"/);
  assert.match(html, /src="\/assets\/generator-dev\/registerSW\.js"/);
  assert.doesNotMatch(html, /src="\/assets\/index-/);
  assert.equal(manifest.scope, '/assets/generator-dev/');
  assert.equal(manifest.start_url, '/assets/generator-dev/');
});
