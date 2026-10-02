import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createRequestHandler,
  readCredentialFile,
  readSystemdCredential,
} from "../e2e/dev-auth/broker.mjs";
import {
  DEV_FANBUS_URL,
  DEV_ORIGIN,
  DEV_PROJECT_REF,
  DEV_SUPABASE_ORIGIN,
  E2E_USER_ID,
  PROD_PROJECT_REF,
} from "../e2e/dev-auth/constants.mjs";
import {
  assertDevRequest,
  assertMagicLink,
  assertServiceCredential,
} from "../e2e/dev-auth/guards.mjs";
import { publicBrokerError, redactSensitiveText } from "../e2e/dev-auth/redaction.mjs";
import {
  isReadOnlyRpc,
  runSmoke,
} from "../e2e/dev-auth/playwright-smoke.mjs";

const validRequest = {
  protocolVersion: 1,
  action: "generate_magic_link",
  projectRef: DEV_PROJECT_REF,
  origin: DEV_ORIGIN,
  userId: E2E_USER_ID,
};

const sensitiveLink = `${DEV_SUPABASE_ORIGIN}/auth/v1/verify?token_hash=fixture-sensitive-token&redirect_to=${encodeURIComponent(DEV_FANBUS_URL)}`;

test("DEV request guard accepts only the immutable contract", () => {
  assert.equal(assertDevRequest(validRequest), validRequest);
  assert.throws(
    () => assertDevRequest({ ...validRequest, projectRef: PROD_PROJECT_REF }),
    { code: "PROD_REF_FORBIDDEN" },
  );
  assert.throws(
    () => assertDevRequest({ ...validRequest, origin: "https://portal.plaerrdeifl.de" }),
    { code: "DEV_ORIGIN_MISMATCH" },
  );
  assert.throws(
    () =>
      assertDevRequest({
        ...validRequest,
        userId: "00000000-0000-4555-8555-000000000043",
      }),
    { code: "E2E_USER_NOT_ALLOWED" },
  );
  assert.throws(() => assertDevRequest({ ...validRequest, email: "not-allowed" }), {
    code: "UNEXPECTED_REQUEST_FIELD",
  });
});

test("magic links are restricted to DEV Supabase and DEV Fanbus", () => {
  assert.equal(assertMagicLink(sensitiveLink), sensitiveLink);
  assert.throws(
    () =>
      assertMagicLink(
        `${DEV_SUPABASE_ORIGIN}/auth/v1/verify?token_hash=x&redirect_to=${encodeURIComponent("https://portal.plaerrdeifl.de/fanbus/")}`,
      ),
    { code: "INVALID_MAGIC_LINK_REDIRECT" },
  );
  assert.throws(
    () =>
      assertMagicLink(
        `https://${PROD_PROJECT_REF}.supabase.co/auth/v1/verify?token_hash=x&redirect_to=${encodeURIComponent(DEV_FANBUS_URL)}`,
      ),
    { code: "PROD_REF_FORBIDDEN" },
  );
});

test("only a server-side privileged credential is accepted", () => {
  const secretFixture = ["sb", "secret", "unit", "fixture"].join("_");
  assert.equal(assertServiceCredential(secretFixture), secretFixture);
  assert.throws(() => assertServiceCredential("sb_publishable_fixture"), {
    code: "PRIVILEGED_CREDENTIAL_REQUIRED",
  });

  const jwt = [
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ role: "authenticated" })).toString("base64url"),
    "fixture",
  ].join(".");
  assert.throws(() => assertServiceCredential(jwt), {
    code: "PRIVILEGED_CREDENTIAL_REQUIRED",
  });
});

test("credential loading fails closed for missing or weakly protected files", async (t) => {
  const previousDirectory = process.env.CREDENTIALS_DIRECTORY;
  delete process.env.CREDENTIALS_DIRECTORY;
  t.after(() => {
    if (previousDirectory === undefined) delete process.env.CREDENTIALS_DIRECTORY;
    else process.env.CREDENTIALS_DIRECTORY = previousDirectory;
  });
  await assert.rejects(readSystemdCredential(), { code: "CREDENTIAL_DIRECTORY_INVALID" });

  const directory = await mkdtemp(path.join(os.tmpdir(), "pd-e2e-credential-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const credentialPath = path.join(directory, "credential");
  const secretFixture = ["sb", "secret", "credential", "fixture", "long-enough"].join("_");
  await writeFile(credentialPath, secretFixture, { mode: 0o644 });
  await assert.rejects(readCredentialFile(credentialPath), {
    code: "CREDENTIAL_FILE_INVALID",
  });
  await chmod(credentialPath, 0o600);
  assert.equal(await readCredentialFile(credentialPath), secretFixture);
});

test("broker looks up only the allowlisted user and generates one DEV link", async () => {
  const secretFixture = ["sb", "secret", "broker", "fixture"].join("_");
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith(`/admin/users/${E2E_USER_ID}`)) {
      return { ok: true, status: 200, json: async () => ({ id: E2E_USER_ID, email: "fixture@example.invalid" }) };
    }
    return { ok: true, status: 200, json: async () => ({ action_link: sensitiveLink }) };
  };
  const handler = createRequestHandler({
    fetchImpl,
    credentialProvider: async () => secretFixture,
  });

  const response = await handler(validRequest);
  assert.equal(response.actionLink, sensitiveLink);
  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      `${DEV_SUPABASE_ORIGIN}/auth/v1/admin/users/${E2E_USER_ID}`,
      `${DEV_SUPABASE_ORIGIN}/auth/v1/admin/generate_link`,
    ],
  );
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${secretFixture}`);
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    type: "magiclink",
    email: "fixture@example.invalid",
    redirect_to: DEV_FANBUS_URL,
  });
});

test("broker errors and redaction never expose credentials or magic-link tokens", () => {
  const secretFixture = ["sb", "secret", "leak", "fixture"].join("_");
  const raw = `Bearer ${secretFixture} ${sensitiveLink}`;
  const redacted = redactSensitiveText(raw, [secretFixture]);
  assert.doesNotMatch(redacted, /fixture-sensitive-token/);
  assert.doesNotMatch(redacted, new RegExp(secretFixture));
  assert.deepEqual(publicBrokerError(new Error(raw)), {
    ok: false,
    error: { code: "BROKER_REQUEST_FAILED" },
  });
});

test("smoke runner asks for exactly one link and reopens the same profile", async () => {
  let linkRequests = 0;
  let launches = 0;
  const navigations = [];
  const page = {
    waitForURL: async (predicate) => assert.equal(predicate(new URL(DEV_FANBUS_URL)), true),
    getByRole: () => ({ waitFor: async () => {} }),
    locator: () => ({ waitFor: async () => {} }),
    getByText: () => ({ isVisible: async () => false }),
    evaluate: async () => E2E_USER_ID,
    goto: async (url) => navigations.push(url),
  };
  const playwright = {
    chromium: {
      launchPersistentContext: async () => {
        launches += 1;
        return {
          pages: () => [page],
          close: async () => {},
          route: async () => {},
        };
      },
    },
  };

  const result = await runSmoke({
    playwright,
    requestLink: async () => {
      linkRequests += 1;
      return sensitiveLink;
    },
  });
  assert.deepEqual(result, { ok: true, sessionPersisted: true, userId: E2E_USER_ID });
  assert.equal(linkRequests, 1);
  assert.equal(launches, 2);
  assert.deepEqual(navigations, [sensitiveLink, DEV_FANBUS_URL]);
});

test("browser network guard permits only the Fanbus read RPCs", () => {
  const request = ({
    url = `${DEV_SUPABASE_ORIGIN}/rest/v1/rpc/pd_api`,
    method = "POST",
    body = { p_action: "fanbus_trips_list", p_payload: {} },
  } = {}) => ({
    url: () => url,
    method: () => method,
    postData: () => JSON.stringify(body),
    postDataJSON: () => body,
  });

  assert.equal(isReadOnlyRpc(request()), true);
  assert.equal(
    isReadOnlyRpc(
      request({
        url: `${DEV_SUPABASE_ORIGIN}/rest/v1/rpc/pd_public_platform_status`,
        body: {},
      }),
    ),
    true,
  );
  assert.equal(
    isReadOnlyRpc(request({ body: { p_action: "fanbus_registration_cancel", p_payload: {} } })),
    false,
  );
  assert.equal(isReadOnlyRpc(request({ method: "DELETE" })), false);
  assert.equal(
    isReadOnlyRpc(request({ url: `${DEV_SUPABASE_ORIGIN}/rest/v1/fanbus_trip`, method: "PATCH" })),
    false,
  );
});

test("systemd templates expose only a local Unix socket and encrypted credential", async () => {
  const [service, socket, runner, broker] = await Promise.all([
    readFile(new URL("../infra/systemd/pd-portal-e2e-auth.service", import.meta.url), "utf8"),
    readFile(new URL("../infra/systemd/pd-portal-e2e-auth.socket", import.meta.url), "utf8"),
    readFile(new URL("../e2e/dev-auth/playwright-smoke.mjs", import.meta.url), "utf8"),
    readFile(new URL("../e2e/dev-auth/broker.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(service, /LoadCredentialEncrypted=supabase-service-role-key:/);
  assert.doesNotMatch(service, /EnvironmentFile|service[_-]?role[_-]?key=/i);
  assert.match(socket, /ListenStream=\/run\/pd-portal-e2e-auth\/auth\.sock/);
  assert.match(socket, /SocketMode=0600/);
  assert.doesNotMatch(socket, /ListenStream=\d|ListenDatagram/);
  assert.doesNotMatch(runner, /screenshot|trace:\s*|video:\s*/i);
  assert.doesNotMatch(runner, /service[_-]?role|CREDENTIALS_DIRECTORY|apikey/i);
  assert.doesNotMatch(broker, /console\.log|JSON\.stringify\(generated/i);
});
