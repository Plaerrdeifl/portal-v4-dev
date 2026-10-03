import { createConnection } from "node:net";

import {
  AUTH_SOCKET_PATH,
  BROKER_PROTOCOL_VERSION,
  DEV_ORIGIN,
  DEV_PROJECT_REF,
  E2E_USER_ID,
  MAX_IPC_BYTES,
} from "./constants.mjs";
import { assertMagicLink } from "./guards.mjs";

export function requestMagicLink({ socketPath = AUTH_SOCKET_PATH } = {}) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: socketPath });
    socket.setEncoding("utf8");
    socket.setTimeout(15_000, () => socket.destroy(new Error("IPC_TIMEOUT")));
    let buffer = "";

    socket.once("connect", () => {
      socket.write(
        `${JSON.stringify({
          protocolVersion: BROKER_PROTOCOL_VERSION,
          action: "generate_magic_link",
          projectRef: DEV_PROJECT_REF,
          origin: DEV_ORIGIN,
          userId: E2E_USER_ID,
        })}\n`,
      );
    });
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer, "utf8") > MAX_IPC_BYTES) {
        socket.destroy(new Error("IPC_RESPONSE_TOO_LARGE"));
      }
    });
    socket.once("end", () => {
      try {
        const response = JSON.parse(buffer.trim());
        if (!response?.ok || response.protocolVersion !== BROKER_PROTOCOL_VERSION) {
          throw new Error(response?.error?.code || "BROKER_REJECTED_REQUEST");
        }
        resolve(assertMagicLink(response.actionLink));
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", reject);
  });
}
