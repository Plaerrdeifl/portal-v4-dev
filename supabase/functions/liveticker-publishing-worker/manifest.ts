type JsonObject = Record<string, unknown>;

const NEXTCLOUD_MANIFEST_ROOT = "/Publishing/";

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validNextcloudManifestPath(value: unknown): value is string {
  return typeof value === "string"
    && value.startsWith(NEXTCLOUD_MANIFEST_ROOT)
    && !value.includes("..")
    && !value.includes("\\")
    && !value.includes("?")
    && !value.includes("#");
}

export function validManifest(value: unknown) {
  if (
    !isObject(value)
    || value.schemaVersion !== 1
    || !["PERIOD_1", "PERIOD_2", "FINAL"].includes(String(value.graphicKind))
    || !Array.isArray(value.artifacts)
    || value.artifacts.length !== 2
  ) return false;

  const kinds = new Set<string>();
  for (const item of value.artifacts) {
    if (!isObject(item)) return false;
    const kind = String(item.kind || "");
    if (!["POST", "STORY"].includes(kind) || kinds.has(kind)) return false;
    kinds.add(kind);
    if (typeof item.filename !== "string" || !/^[A-Za-z0-9._-]+\.png$/.test(item.filename)) return false;
    if (!validNextcloudManifestPath(item.nextcloudPath)) return false;
    if (typeof item.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(item.sha256)) return false;
    if (
      typeof item.bytes !== "number"
      || !Number.isSafeInteger(item.bytes)
      || item.bytes < 1
      || item.bytes > 104_857_600
    ) return false;
    if (
      typeof item.shareUrl !== "string"
      || !/^https:\/\/cloud\.plaerrdeifl\.de\/s\/[A-Za-z0-9]{8,128}$/.test(item.shareUrl)
    ) return false;
    if (typeof item.downloadUrl !== "string" || item.downloadUrl !== `${item.shareUrl}/download`) return false;
  }
  return kinds.has("POST") && kinds.has("STORY");
}
