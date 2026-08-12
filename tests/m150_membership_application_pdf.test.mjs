import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const modulePath = path.join(root, "js/modules/membership-application-pdf.js");
const moduleSource = await fs.readFile(modulePath, "utf8");
const pdfModule = await import(new URL(`../js/modules/membership-application-pdf.js?contract=${Date.now()}`, import.meta.url));

const EXPECTED_KEYS = [
  "id",
  "firstName",
  "lastName",
  "birthDate",
  "email",
  "phone",
  "street",
  "houseNumber",
  "postalCode",
  "city",
  "submittedAt",
  "applicantMessage",
  "declarationVersion",
  "declarationConfirmed",
  "statutesVersion",
  "statutesReference",
  "statutesConfirmed"
];

const JPEG_FIXTURE = new Uint8Array(Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==",
  "base64"
));

function sourceBlock(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return source.slice(from, to);
}

function pdfText(bytes) {
  return Buffer.from(bytes).toString("latin1");
}

function assertXrefOffsets(bytes) {
  const textValue = pdfText(bytes);
  const match = /xref\n0 (\d+)\n([\s\S]*?)trailer\n/.exec(textValue);
  assert.ok(match, "xref-Tabelle fehlt");
  const size = Number(match[1]);
  const rows = match[2].trimEnd().split("\n");
  assert.equal(rows.length, size);
  assert.match(rows[0], /^0000000000 65535 f /);
  for (let objectId = 1; objectId < size; objectId += 1) {
    const offset = Number(rows[objectId].slice(0, 10));
    assert.equal(textValue.slice(offset, offset + 16).startsWith(`${objectId} 0 obj\n`), true);
  }
}

test("PDF module is Node-importable without touching browser DOM at import time", () => {
  assert.equal(typeof pdfModule.selectApplicationPdfData, "function");
  assert.equal(typeof pdfModule.buildPdfFromJpegPages, "function");
  assert.equal(typeof pdfModule.downloadMembershipApplicationPdf, "function");
});

test("application PDF selection is an exact explicit whitelist", () => {
  const input = Object.fromEntries(EXPECTED_KEYS.map(key => [key, `${key}-value`]));
  Object.assign(input, {
    status: "REJECTED",
    decisionReasonInternal: "intern",
    applicantNotice: "extern",
    votes: [{ vote: "NO" }],
    matches: { membersByEmail: [] },
    convertedMemberId: "member-id",
    conversionMode: "NEW_MEMBER",
    revision: 9
  });

  const selected = pdfModule.selectApplicationPdfData(input);
  assert.deepEqual(Object.keys(selected), EXPECTED_KEYS);
  assert.deepEqual(selected, Object.fromEntries(EXPECTED_KEYS.map(key => [key, `${key}-value`])));

  const selector = sourceBlock(
    moduleSource,
    "export function selectApplicationPdfData",
    "function encodeText"
  );
  assert.doesNotMatch(selector, /\.\.\.|Object\.(?:assign|entries|keys)|for\s*\(|reduce\s*\(/);
});

test("PDF 1.4 writer emits one binary JPEG page and required structure", () => {
  const bytes = pdfModule.buildPdfFromJpegPages([
    { bytes: JPEG_FIXTURE, width: 1, height: 1 }
  ]);
  const textValue = pdfText(bytes);

  assert.ok(bytes instanceof Uint8Array);
  assert.equal(Buffer.from(bytes.subarray(0, 8)).toString("ascii"), "%PDF-1.4");
  assert.match(textValue, /\/Type \/Catalog/);
  assert.match(textValue, /\/Type \/Pages/);
  assert.match(textValue, /\/Type \/Page\b/);
  assert.match(textValue, /\/Subtype \/Image/);
  assert.match(textValue, /\/DCTDecode/);
  assert.match(textValue, /\nxref\n/);
  assert.match(textValue, /\ntrailer\n/);
  assert.match(textValue, /\nstartxref\n\d+\n%%EOF\n$/);
  assertXrefOffsets(bytes);
});

test("PDF 1.4 writer emits two page and image objects with Count 2", () => {
  const bytes = pdfModule.buildPdfFromJpegPages([
    { bytes: JPEG_FIXTURE, width: 1, height: 1 },
    { bytes: JPEG_FIXTURE, width: 1, height: 1 }
  ]);
  const textValue = pdfText(bytes);

  assert.equal((textValue.match(/\/Type \/Page\b/g) || []).length, 2);
  assert.equal((textValue.match(/\/Subtype \/Image/g) || []).length, 2);
  assert.match(textValue, /\/Count 2\b/);
  assertXrefOffsets(bytes);
});

test("PDF module has no external data, persistence, or PDF dependency", () => {
  assert.doesNotMatch(moduleSource, /^\s*import\s/m);
  assert.doesNotMatch(
    moduleSource,
    /fetch\s*\(|\.rpc\s*\(|(?:supabase(?:Client)?|client)\s*\.\s*from\s*\(|getSupabaseClient|supabase-client|@supabase\/supabase-js|createClient|service_role|localStorage|sessionStorage|indexedDB|\bcaches\b/i
  );
  assert.doesNotMatch(moduleSource, /pdfkit|jspdf|pdf-lib|cdn|https?:\/\//i);
});

test("browser download uses a PDF Blob, object URL cleanup, and an ID-only filename", () => {
  const fileName = sourceBlock(
    moduleSource,
    "function applicationPdfFileName",
    "export async function downloadMembershipApplicationPdf"
  );
  const download = moduleSource.slice(moduleSource.indexOf("export async function downloadMembershipApplicationPdf"));

  assert.match(download, /new Blob\(\[pdfBytes\], \{ type: "application\/pdf" \}\)/);
  assert.match(download, /URL\.createObjectURL\(pdfBlob\)/);
  assert.match(download, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.match(fileName, /mitgliedsantrag-\$\{match\[1\]\.toLowerCase\(\)\}\.pdf/);
  assert.doesNotMatch(fileName, /firstName|lastName|email|birthDate|memberCode/);
});
