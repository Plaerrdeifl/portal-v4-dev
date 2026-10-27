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
git -C /tmp/fanszene-cockpit checkout --detach e381f4484d01367f4a65e3bd4e143e5b1f4f4b01
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
- AP-02 has no URL subroutes. The pinned Cockpit shell keeps the selected module
  in React component state (`CockpitShell.tsx`) and switches modules with button
  click handlers; it does not expose module links or a client-side URL router;
- `dist/cockpit/404.html` is integration-owned and deliberately outside the
  pinned release artifact. Cloudflare Pages uses this closest 404 for unknown
  `/cockpit/*` paths, so they cannot fall through to the Portal root SPA;
- `_redirects` therefore contains no Cockpit rewrite and makes no unsupported
  deep-link promise;
- the root Portal worker explicitly ignores `/cockpit` and its subtree;
- LOCAL and PROD builds do not integrate this DEV release;
- AP-02 remains fail-closed until the separate AP-03 backend contract exists.
