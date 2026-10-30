# Shared Platform Package Artifacts

Source repository: Plaerrdeifl/platform-ui
Source PR: #4
Source merged main commit: 37228a55f9fa3780d83a3b75610943b762583cdf
Package version: 0.1.0

Artifacts were produced by the successful platform-ui CI package job and are mirrored here only as immutable DEV distribution artifacts for cross-repository consumers.

- plaerrdeifl-platform-0.1.0.tgz
  sha256: e13f9b40292e51e2aac7587b77b3d51b6b37869e428cf993c614ba6f511ada2d
- plaerrdeifl-ui-0.1.0.tgz
  sha256: 7c04fc4ff01d802dcd246fde8f7cda05af63d17b5c69505b9339b4203fd065be

The implementation Source of Truth remains Plaerrdeifl/platform-ui. These tarballs are build artifacts, not forked source code.

## GIS resize/nonce correction (DEV)

- Source: Plaerrdeifl/platform-ui PR #8, merge `c073e25ac25a2c939b8d2b3b3a495fb002cf0d6d`.
- CI run `41051149629`, tested head `9b859df84fc853951fec97397537a25192d19ce4`; package source tree equals the merge.
- CI artifact `12973843763` (`shared-packages`), ZIP SHA256 `c631feb3ce249e7a815d09bdd50c211eef88067e77a3a50ca102017932211158`.
- Unmodified CI package: `plaerrdeifl-platform-0.1.0-c073e25.tgz`.
- Package SHA256: `f5a9d3f3bde0f9c1f46a6e251fd26a4916cd8b0d5ff317b4329ee65c43efddc0`.
- Independent `npm ci --ignore-scripts && npm run build && npm pack --workspace @plaerrdeifl/platform` from the exact merge produced byte-identical unpacked package contents. Tar compression differs between local and CI npm toolchains; the mirrored bytes remain the original CI artifact.
- Existing package artifacts and consumers remain pinned and unchanged until explicitly updated. No PROD publication.
