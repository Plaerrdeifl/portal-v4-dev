const BERLIN_TIME_ZONE = "Europe/Berlin";

const EXPORT_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const EXPORT_DATE_TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const STATUS_LABELS = {
  ACTIVE: "Aktiv",
  CANCELLED: "Storniert"
};

const BUS_PREFERENCE_LABELS = {
  RUHIG: "Ruhig",
  PARTY: "Party",
  EGAL: "Egal"
};

const SOURCE_LABELS = {
  PORTAL: "Portal",
  GUEST: "Gast",
  MANUAL: "Manuell"
};

const PARTICIPANT_HEADERS = [
  "Status",
  "Nachname",
  "Vorname",
  "Personentyp",
  "E-Mail",
  "Buswunsch",
  "Anmeldeart",
  "Angemeldet am",
  "Storniert am"
];

function formatCalendarDate(value) {
  const raw = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || "–";
  const date = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? raw : EXPORT_DATE_FORMAT.format(date);
}

function formatBerlinDateTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "–"
    : `${EXPORT_DATE_TIME_FORMAT.format(date)} Uhr`;
}

function personTypeLabel(registration) {
  if (registration?.memberId) return "Mitglied";
  if (registration?.portalUserId) return "Portal-Nutzer";
  return "Gast";
}

function mappedLabel(labels, value) {
  const raw = String(value || "").trim();
  return labels[raw] || raw.replaceAll("_", " ") || "–";
}

function registrationTimeValue(registration) {
  const value = new Date(registration?.registeredAt || "").getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

export function fanbusRegistrationExportRows(registrations) {
  const items = Array.isArray(registrations) ? [...registrations] : [];
  items.sort((left, right) => {
    const statusOrder = Number(left?.status !== "ACTIVE") - Number(right?.status !== "ACTIVE");
    return statusOrder || registrationTimeValue(left) - registrationTimeValue(right);
  });

  return items.map(registration => [
    mappedLabel(STATUS_LABELS, registration.status),
    registration.lastName || "–",
    registration.firstName || "–",
    personTypeLabel(registration),
    registration.email || "–",
    mappedLabel(BUS_PREFERENCE_LABELS, registration.busPreference),
    mappedLabel(SOURCE_LABELS, registration.source),
    formatBerlinDateTime(registration.registeredAt),
    formatBerlinDateTime(registration.cancelledAt)
  ]);
}

function safeFilenamePart(value) {
  return String(value || "")
    .replaceAll("ß", "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "Fahrt";
}

export function fanbusRegistrationsFilename(trip) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(trip?.eventDate || ""))
    ? trip.eventDate
    : "ohne-Datum";
  const destination = trip?.opponentName || trip?.venue || trip?.displayTitle || "Fahrt";
  return `Fanbus_${date}_${safeFilenamePart(destination)}_Anmeldungen.xlsx`;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function worksheetCell(value, rowIndex, columnIndex, style = 0) {
  const reference = `${columnName(columnIndex)}${rowIndex}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function worksheetXml(trip, registrations) {
  const exportRows = fanbusRegistrationExportRows(registrations);
  const activeCount = (Array.isArray(registrations) ? registrations : [])
    .filter(registration => registration?.status === "ACTIVE").length;
  const destination = [trip?.opponentName, trip?.venue].filter(Boolean).join(" · ")
    || trip?.displayTitle
    || "Fanbusfahrt";
  const rows = [
    [{ value: "Fanbusfahrt", style: 1 }, { value: trip?.displayTitle || "Fanbusfahrt", style: 1 }],
    [{ value: "Spiel / Ziel", style: 2 }, { value: destination }],
    [{ value: "Spieldatum", style: 2 }, { value: formatCalendarDate(trip?.eventDate) }],
    [{ value: "Abfahrt", style: 2 }, { value: formatBerlinDateTime(trip?.departureAt) }],
    [{ value: "Kapazität", style: 2 }, {
      value: trip?.capacity !== null
        && trip?.capacity !== undefined
        && trip?.capacity !== ""
        && Number.isInteger(Number(trip.capacity))
        ? Number(trip.capacity)
        : "Nicht festgelegt"
    }],
    [{ value: "Anzahl aktive Anmeldungen", style: 2 }, { value: activeCount }],
    [],
    PARTICIPANT_HEADERS.map(value => ({ value, style: 3 })),
    ...exportRows.map(row => row.map(value => ({ value })))
  ];
  const lastRow = rows.length;
  const rowXml = rows.map((row, rowOffset) => {
    const rowIndex = rowOffset + 1;
    const cells = row.map((cell, columnIndex) =>
      worksheetCell(cell.value, rowIndex, columnIndex, cell.style)
    ).join("");
    return `<row r="${rowIndex}">${cells}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:I${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="3" width="20" customWidth="1"/>
    <col min="4" max="4" width="17" customWidth="1"/>
    <col min="5" max="5" width="32" customWidth="1"/>
    <col min="6" max="7" width="16" customWidth="1"/>
    <col min="8" max="9" width="22" customWidth="1"/>
  </cols>
  <sheetData>${rowXml}</sheetData>
  <mergeCells count="6"><mergeCell ref="B1:I1"/><mergeCell ref="B2:I2"/><mergeCell ref="B3:I3"/><mergeCell ref="B4:I4"/><mergeCell ref="B5:I5"/><mergeCell ref="B6:I6"/></mergeCells>
  <autoFilter ref="A8:I${lastRow}"/>
</worksheet>`;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Anmeldungen" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAD3"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left/><right/><top/><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Plärrdeifl Digitalplattform</Application>
</Properties>`;

const CRC_TABLE = (() => {
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
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(chunks) {
  const result = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function zipTimestamp() {
  const date = new Date();
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function storedZip(files) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  const stamp = zipTimestamp();
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);

    localChunks.push(localHeader, name, data);
    centralChunks.push(centralHeader, name);
    localOffset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  return concatBytes([...localChunks, centralDirectory, end]);
}

export function createFanbusRegistrationsWorkbook(trip, registrations) {
  const files = [
    { name: "[Content_Types].xml", content: CONTENT_TYPES_XML },
    { name: "_rels/.rels", content: ROOT_RELS_XML },
    { name: "docProps/app.xml", content: APP_XML },
    { name: "xl/workbook.xml", content: WORKBOOK_XML },
    { name: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS_XML },
    { name: "xl/styles.xml", content: STYLES_XML },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(trip, registrations) }
  ];
  return new Blob([storedZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

export function downloadFanbusRegistrationsXlsx(trip, registrations) {
  const blob = createFanbusRegistrationsWorkbook(trip, registrations);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fanbusRegistrationsFilename(trip);
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
