import { lstat, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

import {
  BROKER_PROTOCOL_VERSION,
  CREDENTIAL_NAME,
  DEV_FANBUS_URL,
  DEV_SUPABASE_ORIGIN,
  E2E_USER_ID,
  MAX_IPC_BYTES,
} from "./constants.mjs";
import {
  GuardError,
  assertDevRequest,
  assertMagicLink,
  assertServiceCredential,
} from "./guards.mjs";
import { publicBrokerError } from "./redaction.mjs";

class BrokerError extends Error {
  constructor(code) {
    super(code);
    this.name = "BrokerError";
    this.code = code;
  }
}

export async function readCredentialFile(path) {
  const metadata = await lstat(path);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    (metadata.mode & 0o037) !== 0 ||
    metadata.size < 20 ||
    metadata.size > 8192
  ) {
    throw new BrokerError("CREDENTIAL_FILE_INVALID");
  }
  return assertServiceCredential(await readFile(path, "utf8"));
}

export async function readSystemdCredential() {
  const directory = process.env.CREDENTIALS_DIRECTORY;
  if (!directory || !directory.startsWith("/run/credentials/")) {
    throw new BrokerError("CREDENTIAL_DIRECTORY_INVALID");
  }
  return readCredentialFile(`${directory}/${CREDENTIAL_NAME}`);
}

async function fetchJson(fetchImpl, url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  timeout.unref?.();
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    throw new BrokerError("DEV_AUTH_NETWORK_FAILED");
  } finally {
    clearTimeout(timeout);
  }
  if (!response?.ok) {
    throw new BrokerError(`DEV_AUTH_HTTP_${Number(response?.status) || 0}`);
  }
  try {
    return await response.json();
  } catch {
    throw new BrokerError("DEV_AUTH_RESPONSE_INVALID");
  }
}

export function createRequestHandler({
  fetchImpl = globalThis.fetch,
  credentialProvider = readSystemdCredential,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");

  return async function handleRequest(input) {
    assertDevRequest(input);
    const credential = await credentialProvider();
    const headers = {
      apikey: credential,
      Authorization: `Bearer ${credential}`,
      "Content-Type": "application/json",
    };

    const user = await fetchJson(
      fetchImpl,
      `${DEV_SUPABASE_ORIGIN}/auth/v1/admin/users/${E2E_USER_ID}`,
      { method: "GET", headers },
    );
    if (user?.id !== E2E_USER_ID || typeof user?.email !== "string" || !user.email) {
      throw new BrokerError("E2E_USER_LOOKUP_MISMATCH");
    }

    const generated = await fetchJson(
      fetchImpl,
      `${DEV_SUPABASE_ORIGIN}/auth/v1/admin/generate_link`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "magiclink",
          email: user.email,
          redirect_to: DEV_FANBUS_URL,
        }),
      },
    );
    const actionLink = assertMagicLink(generated?.action_link);
    return { ok: true, protocolVersion: BROKER_PROTOCOL_VERSION, actionLink };
  };
}

function serveConnection(socket, handler) {
  socket.setEncoding("utf8");
  socket.setTimeout(15_000, () => socket.destroy());
  let buffer = "";
  let handled = false;

  const respond = (payload) => {
    if (socket.destroyed) return;
    socket.end(`${JSON.stringify(payload)}\n`);
  };

  socket.on("data", async (chunk) => {
    if (handled) return;
    buffer += chunk;
    if (Buffer.byteLength(buffer, "utf8") > MAX_IPC_BYTES) {
      handled = true;
      respond(publicBrokerError(new BrokerError("IPC_REQUEST_TOO_LARGE")));
      return;
    }
    const newline = buffer.indexOf("\n");
    if (newline === -1) return;
    handled = true;
    try {
      const input = JSON.parse(buffer.slice(0, newline));
      respond(await handler(input));
    } catch (error) {
      respond(publicBrokerError(error));
    }
  });
  socket.on("error", () => {});
}

export function createBrokerServer(options = {}) {
  const handler = createRequestHandler(options);
  return createServer((socket) => serveConnection(socket, handler));
}

async function main() {
  if (process.env.LISTEN_FDS !== "1" || Number(process.env.LISTEN_PID) !== process.pid) {
    throw new BrokerError("SYSTEMD_SOCKET_ACTIVATION_REQUIRED");
  }
  const server = createBrokerServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ fd: 3 }, resolve);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    const code =
      error instanceof GuardError || error instanceof BrokerError
        ? error.code
        : "BROKER_START_FAILED";
    process.stderr.write(`pd-portal-e2e-auth: ${code}\n`);
    process.exitCode = 1;
  });
}
