# Cockpit DEV release integration

This directory is the versioned release boundary between the private
`Plaerrdeifl/fanszene-cockpit` source repository and the public DEV portal
build. It contains generated production files, not a second Cockpit source
implementation.

`release.json` pins all provenance and integrity inputs:

- the exact Cockpit source commit;
- the source `package-lock.json` SHA-256;
- the source build/check command;
- every generated file, byte length and SHA-256;
- one deterministic aggregate SHA-256 over the ordered file list.

`scripts/integrate-cockpit-release.mjs` verifies this contract before copying
the generated files. It accepts only `PORTAL_ENVIRONMENT=DEV`, validates the
DEV Supabase and public Google browser configuration, creates
`runtime-config.js` separately and writes the application only to
`dist/cockpit/`. The `integrations/` tree itself is never copied to `dist`.
The hosting-wide `VITE_BASE_PATH` remains owned by the Portal build; the
Cockpit `/cockpit/` base is already fixed and verified inside its source build.

This means the Cloudflare Pages build continues to use the existing portal
checkout, `npm run build` and `dist` output directory. It does not need a
private-repository credential. Private source access is needed only when a new
Cockpit release artifact is deliberately produced and reviewed.

## Reproducing the pinned release

Use a credential authorized to read the private Cockpit repository. Never put
that credential into a build argument, committed file or browser runtime.

```bash
git clone --no-checkout https://github.com/Plaerrdeifl/fanszene-cockpit.git /tmp/fanszene-cockpit
git -C /tmp/fanszene-cockpit checkout --detach 14b07a572d0a0d412125abb2b63e6efda356a89d
cd /tmp/fanszene-cockpit
sha256sum package-lock.json
npm ci
npm run check
find dist -type f -print0 | sort -z | xargs -0 sha256sum
npm run build
find dist -type f -print0 | sort -z | xargs -0 sha256sum
```

The two output manifests must be identical. Copy only the verified `dist/`
contents into `integrations/cockpit/release/`, then update `release.json` with
the new fixed source SHA, lock hash, file sizes, hashes and aggregate hash.
The portal test suite independently revalidates the complete contract.

## Runtime and routing boundaries

- canonical DEV path, manifest ID, start URL and worker scope: `/cockpit/`;
- runtime config: generated public browser values, never part of the release
  artifact and never cached;
- `offline.html`: source-generated, standalone and fail-closed without Runtime,
  Auth, Session-/Rechtewiederherstellung oder Fachmodule;
- Service-Worker cache `pd-cockpit-shell-v2`: pre-caches the non-redirected
  offline document, rejects redirected/missing fallbacks and removes older
  Cockpit cache versions on activation;
- Cloudflare Pages redirects physical `.html` files to extensionless routes.
  The exact 200 proxy `/cockpit/offline.html /cockpit/offline 200` keeps the
  source-owned worker URL non-redirected without introducing a Cockpit SPA or
  a global rewrite;
- AP-03/R1 has no URL subroutes. The pinned Cockpit shell keeps the selected module
  in React component state (`CockpitShell.tsx`) and switches modules with button
  click handlers; it does not expose module links or a client-side URL router;
- `dist/cockpit/404.html` is integration-owned and deliberately outside the
  pinned release artifact. Cloudflare Pages uses this closest 404 for unknown
  `/cockpit/*` paths, so they cannot fall through to the Portal root SPA;
- `_redirects` contains no Cockpit wildcard/deep-link rewrite and makes no
  unsupported deep-link promise;
- the root Portal worker explicitly ignores `/cockpit` and its subtree;
- LOCAL and PROD builds do not integrate this DEV release;
- Cockpit admission comes exclusively from the server-side
  `cockpit_access_get` action. The release validates `schemaVersion: 1`, binds
  the response to the current session user and uses only
  `permissions.liveticker.effectiveAllowed` and
  `permissions.generator.effectiveAllowed` for its two module entries.
  Missing, invalid or stale API decisions remain fail-closed; neither
  `portal.admin` nor personally assigned capability metadata grants local
  Cockpit admission.
