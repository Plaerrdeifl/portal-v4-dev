import assert from "node:assert/strict";
import test from "node:test";

import {
  createFanbusRegistrationsWorkbook,
  fanbusRegistrationExportRows,
  fanbusRegistrationsFilename
} from "../js/modules/fanbus-xlsx.js";

const textDecoder = new TextDecoder("utf-8", { fatal: true });
const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationshipNamespace = "http://schemas.openxmlformats.org/package/2006/relationships";

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minimumEocdOffset = Math.max(0, bytes.length - 65557);
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  assert.notEqual(eocdOffset, -1, "ZIP-Endverzeichnis fehlt");
  assert.equal(view.getUint16(eocdOffset + 4, true), 0);
  assert.equal(view.getUint16(eocdOffset + 6, true), 0);

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map();
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const checksum = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));

    assert.equal(flags, 0x0800, `${name}: UTF-8-Flag`);
    assert.equal(compression, 0, `${name}: nur gespeicherte ZIP-Einträge erwartet`);
    assert.equal(compressedSize, uncompressedSize, `${name}: Größen müssen übereinstimmen`);
    assert.equal(view.getUint32(localOffset, true), 0x04034b50, `${name}: lokaler Header`);
    assert.equal(view.getUint16(localOffset + 6, true), flags, `${name}: lokale Flags`);
    assert.equal(view.getUint16(localOffset + 8, true), compression, `${name}: lokale Kompression`);
    assert.equal(view.getUint32(localOffset + 14, true), checksum, `${name}: lokale CRC`);
    assert.equal(view.getUint32(localOffset + 18, true), compressedSize, `${name}: lokale Größe`);
    assert.equal(view.getUint32(localOffset + 22, true), uncompressedSize, `${name}: lokale Rohgröße`);

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localName = textDecoder.decode(
      bytes.slice(localOffset + 30, localOffset + 30 + localNameLength)
    );
    assert.equal(localName, name, `${name}: lokaler Dateiname`);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + uncompressedSize);
    assert.equal(crc32(data), checksum, `${name}: CRC-Prüfung`);
    assert.equal(entries.has(name), false, `${name}: doppelter ZIP-Eintrag`);
    entries.set(name, textDecoder.decode(data));

    offset += 46 + nameLength + extraLength + commentLength;
  }

  assert.equal(offset, centralOffset + centralSize);
  assert.equal(entries.size, entryCount);
  return entries;
}

function decodeXml(value) {
  assert.doesNotMatch(
    value,
    /&(?!amp;|lt;|gt;|quot;|apos;|#[0-9]+;|#x[0-9a-fA-F]+;)/,
    "Nicht escapetes XML-Zeichen"
  );
  return value.replace(
    /&(amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/g,
    (_, entity) => {
      if (entity === "amp") return "&";
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      if (entity === "quot") return '"';
      if (entity === "apos") return "'";
      const codePoint = entity.startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return String.fromCodePoint(codePoint);
    }
  );
}

function parseXml(xml, partName) {
  const tokens = xml.match(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  const stack = [];
  let root = null;

  for (const token of tokens) {
    if (token.startsWith("<?") || token.startsWith("<!--")) continue;
    if (token.startsWith("</")) {
      const match = token.match(/^<\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*>$/);
      assert.ok(match, `${partName}: ungültiger End-Tag`);
      const node = stack.pop();
      assert.equal(node?.name, match[1], `${partName}: unpassender End-Tag`);
      continue;
    }
    if (token.startsWith("<")) {
      const selfClosing = token.endsWith("/>");
      const tag = token.slice(1, selfClosing ? -2 : -1);
      const match = tag.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)([\s\S]*)$/);
      assert.ok(match, `${partName}: ungültiger Start-Tag`);
      const attributes = Object.create(null);
      const source = match[2];
      const attributePattern = /\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/y;
      let cursor = 0;
      while (cursor < source.length) {
        if (/^\s*$/.test(source.slice(cursor))) break;
        attributePattern.lastIndex = cursor;
        const attribute = attributePattern.exec(source);
        assert.ok(attribute, `${partName}: ungültiges Attribut in ${match[1]}`);
        assert.equal(attributes[attribute[1]], undefined, `${partName}: doppeltes Attribut`);
        attributes[attribute[1]] = decodeXml(attribute[2]);
        cursor = attributePattern.lastIndex;
      }

      const node = { name: match[1], attributes, children: [], text: "" };
      if (stack.length) stack.at(-1).children.push(node);
      else {
        assert.equal(root, null, `${partName}: mehrere Wurzelelemente`);
        root = node;
      }
      if (!selfClosing) stack.push(node);
      continue;
    }

    if (stack.length) stack.at(-1).text += decodeXml(token);
    else assert.equal(token.trim(), "", `${partName}: Text außerhalb des Wurzelelements`);
  }

  assert.equal(stack.length, 0, `${partName}: nicht geschlossene XML-Elemente`);
  assert.ok(root, `${partName}: Wurzelelement fehlt`);
  return root;
}

function childElements(node, name) {
  return node.children.filter(child => child.name === name);
}

function onlyChild(node, name, partName) {
  const matches = childElements(node, name);
  assert.equal(matches.length, 1, `${partName}: genau ein ${name} erwartet`);
  return matches[0];
}

function descendants(node, name) {
  return node.children.flatMap(child => [
    ...(child.name === name ? [child] : []),
    ...descendants(child, name)
  ]);
}

function relationshipMap(document, partName) {
  assert.equal(document.name, "Relationships", `${partName}: Relationships-Wurzel`);
  assert.equal(document.attributes.xmlns, relationshipNamespace, `${partName}: Namespace`);
  const relationships = new Map();
  for (const relationship of childElements(document, "Relationship")) {
    const id = relationship.attributes.Id;
    assert.ok(id, `${partName}: Relationship-ID fehlt`);
    assert.equal(relationships.has(id), false, `${partName}: doppelte Relationship-ID`);
    assert.ok(relationship.attributes.Type, `${partName}: Relationship-Typ fehlt`);
    assert.ok(relationship.attributes.Target, `${partName}: Relationship-Ziel fehlt`);
    relationships.set(id, relationship.attributes);
  }
  return relationships;
}

const trip = {
  displayTitle: "Auswärtsfahrt & Freunde <Landsberg>",
  opponentName: "HC Landsberg Riverkings",
  venue: 'Arena "Am Lech"',
  eventDate: "2026-10-03",
  departureAt: "2026-10-03T14:30:00.000Z",
  capacity: 50
};

const registrations = [
  {
    id: "00000000-0000-4000-8000-000000000003",
    status: "CANCELLED",
    firstName: "Clara",
    lastName: "Gast",
    email: "clara@example.test",
    busPreference: "EGAL",
    source: "GUEST",
    registeredAt: "2026-09-01T08:00:00.000Z",
    cancelledAt: "2026-09-02T09:00:00.000Z"
  },
  {
    id: "00000000-0000-4000-8000-000000000001",
    memberId: "10000000-0000-4000-8000-000000000001",
    portalUserId: "20000000-0000-4000-8000-000000000001",
    status: "ACTIVE",
    firstName: "Anna",
    lastName: "Müller & Söhne <Nord>",
    email: "anna.mit-einer-sehr-langen-adresse@example.test",
    busPreference: "RUHIG",
    source: "MANUAL",
    registeredAt: "2026-09-03T08:00:00.000Z",
    cancelledAt: null
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    portalUserId: "20000000-0000-4000-8000-000000000002",
    status: "ACTIVE",
    firstName: "Berta",
    lastName: "Portal",
    email: null,
    busPreference: "PARTY",
    source: "PORTAL",
    registeredAt: "2026-09-04T08:00:00.000Z",
    cancelledAt: null
  }
];

test("M310 XLSX rows include active and cancelled registrations in operational order", () => {
  const rows = fanbusRegistrationExportRows(registrations);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row[0]), ["Aktiv", "Aktiv", "Storniert"]);
  assert.deepEqual(rows.map(row => row[2]), ["Anna", "Berta", "Clara"]);
});

test("M310 XLSX maps person type, bus preference and registration source", () => {
  const rows = fanbusRegistrationExportRows(registrations);
  assert.deepEqual(rows.map(row => row[3]), ["Mitglied", "Portal-Nutzer", "Gast"]);
  assert.deepEqual(rows.map(row => row[5]), ["Ruhig", "Party", "Egal"]);
  assert.deepEqual(rows.map(row => row[6]), ["Manuell", "Portal", "Gast"]);
});

test("M310 export filename is safe and recognizable", () => {
  assert.equal(
    fanbusRegistrationsFilename(trip),
    "Fanbus_2026-10-03_HC-Landsberg-Riverkings_Anmeldungen.xlsx"
  );
});

test("M310 export is a structurally consistent OOXML workbook accepted without repair", async () => {
  const workbook = createFanbusRegistrationsWorkbook(trip, registrations);
  assert.equal(
    workbook.type,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  const bytes = new Uint8Array(await workbook.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);

  const files = storedZipEntries(bytes);
  assert.deepEqual([...files.keys()].sort(), [
    "[Content_Types].xml",
    "_rels/.rels",
    "docProps/app.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/workbook.xml",
    "xl/worksheets/sheet1.xml"
  ]);

  const documents = new Map(
    [...files].map(([name, xml]) => [name, parseXml(xml, name)])
  );
  const contentTypes = documents.get("[Content_Types].xml");
  assert.equal(contentTypes.name, "Types");
  assert.equal(
    contentTypes.attributes.xmlns,
    "http://schemas.openxmlformats.org/package/2006/content-types"
  );
  const defaults = new Map(
    childElements(contentTypes, "Default")
      .map(entry => [entry.attributes.Extension, entry.attributes.ContentType])
  );
  assert.equal(defaults.get("rels"), "application/vnd.openxmlformats-package.relationships+xml");
  assert.equal(defaults.get("xml"), "application/xml");
  const overrides = new Map(
    childElements(contentTypes, "Override")
      .map(entry => [entry.attributes.PartName, entry.attributes.ContentType])
  );
  assert.equal(
    overrides.get("/xl/workbook.xml"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
  );
  assert.equal(
    overrides.get("/xl/worksheets/sheet1.xml"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
  );
  assert.equal(
    overrides.get("/xl/styles.xml"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"
  );
  assert.equal(
    overrides.get("/docProps/app.xml"),
    "application/vnd.openxmlformats-officedocument.extended-properties+xml"
  );

  const rootRelationships = relationshipMap(documents.get("_rels/.rels"), "_rels/.rels");
  assert.deepEqual({ ...rootRelationships.get("rId1") }, {
    Id: "rId1",
    Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
    Target: "xl/workbook.xml"
  });
  assert.deepEqual({ ...rootRelationships.get("rId2") }, {
    Id: "rId2",
    Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
    Target: "docProps/app.xml"
  });

  const workbookXml = documents.get("xl/workbook.xml");
  assert.equal(workbookXml.name, "workbook");
  assert.equal(workbookXml.attributes.xmlns, spreadsheetNamespace);
  const sheet = onlyChild(
    onlyChild(workbookXml, "sheets", "xl/workbook.xml"),
    "sheet",
    "xl/workbook.xml"
  );
  assert.equal(sheet.attributes.name, "Anmeldungen");
  assert.equal(sheet.attributes.sheetId, "1");
  assert.equal(sheet.attributes["r:id"], "rId1");

  const workbookRelationships = relationshipMap(
    documents.get("xl/_rels/workbook.xml.rels"),
    "xl/_rels/workbook.xml.rels"
  );
  assert.equal(workbookRelationships.get("rId1")?.Target, "worksheets/sheet1.xml");
  assert.match(workbookRelationships.get("rId1")?.Type || "", /\/worksheet$/);
  assert.equal(workbookRelationships.get("rId2")?.Target, "styles.xml");
  assert.match(workbookRelationships.get("rId2")?.Type || "", /\/styles$/);
  assert.ok(files.has(`xl/${workbookRelationships.get("rId1").Target}`));
  assert.ok(files.has(`xl/${workbookRelationships.get("rId2").Target}`));
  assert.equal(files.has("xl/sharedStrings.xml"), false);

  const styles = documents.get("xl/styles.xml");
  assert.equal(styles.name, "styleSheet");
  assert.equal(styles.attributes.xmlns, spreadsheetNamespace);
  for (const [containerName, childName] of [
    ["fonts", "font"],
    ["fills", "fill"],
    ["borders", "border"],
    ["cellStyleXfs", "xf"],
    ["cellXfs", "xf"],
    ["cellStyles", "cellStyle"]
  ]) {
    const container = onlyChild(styles, containerName, "xl/styles.xml");
    assert.equal(Number(container.attributes.count), childElements(container, childName).length);
  }
  const cellXfs = childElements(
    onlyChild(styles, "cellXfs", "xl/styles.xml"),
    "xf"
  );
  assert.equal(cellXfs.length, 4);
  for (const xf of cellXfs) assert.match(xf.attributes.numFmtId, /^\d+$/);

  const worksheet = documents.get("xl/worksheets/sheet1.xml");
  assert.equal(worksheet.name, "worksheet");
  assert.equal(worksheet.attributes.xmlns, spreadsheetNamespace);
  const worksheetOrder = [
    "sheetPr", "dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData",
    "sheetCalcPr", "sheetProtection", "protectedRanges", "scenarios", "autoFilter",
    "sortState", "dataConsolidate", "customSheetViews", "mergeCells", "phoneticPr",
    "conditionalFormatting", "dataValidations", "hyperlinks", "printOptions",
    "pageMargins", "pageSetup", "headerFooter", "rowBreaks", "colBreaks",
    "customProperties", "cellWatches", "ignoredErrors", "smartTags", "drawing",
    "legacyDrawing", "legacyDrawingHF", "picture", "oleObjects", "controls",
    "webPublishItems", "tableParts", "extLst"
  ];
  let previousOrder = -1;
  for (const child of worksheet.children) {
    const order = worksheetOrder.indexOf(child.name);
    assert.notEqual(order, -1, `Unbekanntes Worksheet-Element: ${child.name}`);
    assert.ok(order >= previousOrder, `Ungültige Worksheet-Reihenfolge bei ${child.name}`);
    previousOrder = order;
  }
  const autoFilterIndex = worksheet.children.findIndex(child => child.name === "autoFilter");
  const mergeCellsIndex = worksheet.children.findIndex(child => child.name === "mergeCells");
  assert.ok(autoFilterIndex >= 0 && autoFilterIndex < mergeCellsIndex);

  const dimension = onlyChild(worksheet, "dimension", "xl/worksheets/sheet1.xml");
  assert.equal(dimension.attributes.ref, "A1:I11");
  const sheetData = onlyChild(worksheet, "sheetData", "xl/worksheets/sheet1.xml");
  const rows = childElements(sheetData, "row");
  assert.deepEqual(rows.map(row => Number(row.attributes.r)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const cells = descendants(sheetData, "c");
  for (const cell of cells) {
    assert.match(cell.attributes.r, /^[A-I](?:[1-9]|10|11)$/);
    const styleId = Number(cell.attributes.s);
    assert.ok(Number.isInteger(styleId) && styleId >= 0 && styleId < cellXfs.length);
    if (cell.attributes.t === "inlineStr") {
      onlyChild(onlyChild(cell, "is", cell.attributes.r), "t", cell.attributes.r);
      assert.equal(childElements(cell, "v").length, 0);
    } else {
      assert.equal(cell.attributes.t, undefined);
      assert.match(onlyChild(cell, "v", cell.attributes.r).text.trim(), /^\d+$/);
    }
  }
  assert.equal(cells.some(cell => cell.attributes.t === "s"), false);
  assert.equal(onlyChild(worksheet, "autoFilter", "xl/worksheets/sheet1.xml").attributes.ref, "A8:I11");
  const mergeCells = onlyChild(worksheet, "mergeCells", "xl/worksheets/sheet1.xml");
  assert.equal(Number(mergeCells.attributes.count), childElements(mergeCells, "mergeCell").length);

  const inlineTexts = descendants(sheetData, "t").map(text => text.text);
  assert.ok(inlineTexts.includes("Müller & Söhne <Nord>"));
  assert.ok(inlineTexts.includes("anna.mit-einer-sehr-langen-adresse@example.test"));
  assert.ok(inlineTexts.includes('Gast'));
  assert.ok(inlineTexts.includes("–"));
  assert.match(files.get("xl/worksheets/sheet1.xml"), /Müller &amp; Söhne &lt;Nord&gt;/);
  assert.doesNotMatch(files.get("xl/worksheets/sheet1.xml"), /00000000-0000-4000-8000-00000000000/);
});
