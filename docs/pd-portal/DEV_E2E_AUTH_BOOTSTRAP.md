# DEV E2E auth bootstrap on acer01

This infrastructure is intentionally outside product browser code. It is fixed to:

- DEV Supabase project `tpieykhhawszlzsoflnl`
- DEV origin `https://dev.plaerrdeifl.de`
- E2E user `00000000-0000-4555-8555-000000000042`
- Chromium profile `/home/benny/.local/share/pd-portal-e2e/fanbus-slice4-profile`

The PROD project ref `wplescvhlgctynkfwvrj` is an explicit hard rejection. The broker has no configurable project, origin, user, redirect, TCP listener, email input, or browser-facing privileged credential.

## Security boundary

The system service alone reads one encrypted systemd credential. It resolves the fixed user's email server-side, asks the fixed DEV Auth endpoint for one magic link, and returns that link over a mode `0600` Unix socket owned by `benny`. The root-owned socket directory is mode `0711`, allowing traversal to that explicitly named socket without directory listing or write access. It never writes the credential, email, response body, link, or token to stdout/stderr. Errors crossing IPC contain only a bounded error code.

The Playwright runner receives only the one-time link over the local socket. It does not receive the privileged credential, does not emit URLs, and does not enable screenshots, traces, or video. The admin magic link remains one-time: the runner extracts its token hash only in Node memory and consumes that hash in the persistent browser profile with Supabase `verifyOtp({ token_hash, type: "email" })`.

This explicit exchange is required because Fanbus creates its normal Supabase client with PKCE and therefore does not persist the implicit auth fragment produced by directly opening the admin action link. Before the exchange, the runner loads the DEV root page and checks that `PD_RUNTIME_CONFIG` identifies environment `DEV`, the exact DEV Supabase URL, and project ref. It then creates a normal browser client using only the public publishable/anon key already present in that runtime configuration. Only the verified fixed user id leaves the browser context; the action link, token hash, public key, session tokens, and browser storage are never logged or returned.

## Host installation

Do not place a plaintext credential in this repository, the shell command line, an environment file, or browser storage. Pipe the DEV service-role credential directly into the installer. It passes stdin straight to `systemd-creds encrypt`, never creates a plaintext file, and prints only a fixed status line.

From this checkout, with a secret-producing command on the left side of the pipe:

```sh
SECRET_PRODUCER | sudo e2e/dev-auth/install-host.sh --credential-stdin
```

An already provisioned encrypted credential can be retained during a code/unit update with `sudo e2e/dev-auth/install-host.sh --reuse-credential`. Never use `systemd-creds cat` in captured automation output because that prints the decrypted value.

Verify names, state, ownership, and modes only:

```sh
systemctl show pd-portal-e2e-auth.socket \
  -p ActiveState -p SubState -p FragmentPath -p UnitFileState
stat -c '%n %a %U:%G' \
  /etc/credstore.encrypted/pd-portal-e2e-auth.service/supabase-service-role-key.cred \
  /run/pd-portal-e2e-auth \
  /run/pd-portal-e2e-auth/auth.sock
```

## Smoke run

First close the existing Chromium process that owns the persistent profile through its normal owner/service. Do not delete Chromium singleton files while the process is running.

The runner resolves a normal `playwright` package by default. On the currently inspected acer01 host, the available Playwright 1.63.0 package can be selected explicitly without installing anything:

```sh
PD_E2E_PLAYWRIGHT_MODULE=/tmp/generator-headless/node_modules/playwright \
  /home/benny/.nvm/versions/node/v24.20.0/bin/node \
  e2e/dev-auth/playwright-smoke.mjs
```

Expected non-sensitive success output is one JSON object with `ok`, `sessionPersisted`, and the fixed user id. Failure output is deliberately generic. The runner requests exactly one link, performs the PKCE-compatible token-hash verification on the DEV root page, and then authenticates DEV Fanbus read-only. Its REST guard permits only the exact empty-payload `pd_api` actions `bootstrap` and `fanbus_trips_list` required during page load and blocks unexpected mutations. Finally, it closes Chromium, reopens the same profile, loads Fanbus directly without another link, and proves the same session/user persisted.
