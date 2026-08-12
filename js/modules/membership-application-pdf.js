const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_MARGIN = 104;
const CONTENT_BOTTOM = 1605;
const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const FONT_FAMILY = 'system-ui, "Segoe UI", Arial, sans-serif';
const EMPTY_VALUE = "Nicht vorhanden";
const MINIMIZED_MESSAGE = "Im aktuellen Antragssatz nicht vorhanden.";

export function selectApplicationPdfData(detail) {
  return {
    id: detail?.id,
    firstName: detail?.firstName,
    lastName: detail?.lastName,
    birthDate: detail?.birthDate,
    email: detail?.email,
    phone: detail?.phone,
    street: detail?.street,
    houseNumber: detail?.houseNumber,
    postalCode: detail?.postalCode,
    city: detail?.city,
    submittedAt: detail?.submittedAt,
    applicantMessage: detail?.applicantMessage,
    declarationVersion: detail?.declarationVersion,
    declarationConfirmed: detail?.declarationConfirmed,
    statutesVersion: detail?.statutesVersion,
    statutesReference: detail?.statutesReference,
    statutesConfirmed: detail?.statutesConfirmed
  };
}

function encodeText(value) {
  return new TextEncoder().encode(value);
}

function concatenateBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function validateJpegPage(page) {
  if (!(page?.bytes instanceof Uint8Array) || page.bytes.length === 0) {
    throw new TypeError("JPEG-Seitendaten fehlen.");
  }
  if (!Number.isInteger(page.width) || page.width <= 0
      || !Number.isInteger(page.height) || page.height <= 0) {
    throw new TypeError("Ungültige JPEG-Seitenabmessungen.");
  }
}

export function buildPdfFromJpegPages(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new TypeError("Mindestens eine JPEG-Seite ist erforderlich.");
  }
  pages.forEach(validateJpegPage);

  const objectCount = 2 + (pages.length * 3);
  const objectParts = new Array(objectCount + 1);
  const pageIds = pages.map((_, index) => 3 + (index * 3));

  objectParts[1] = encodeText("<< /Type /Catalog /Pages 2 0 R >>");
  objectParts[2] = encodeText(
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const imageDictionary = encodeText(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} `
      + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`
    );
    objectParts[imageId] = concatenateBytes([
      imageDictionary,
      page.bytes,
      encodeText("\nendstream")
    ]);

    const content = encodeText(
      `q\n${PDF_PAGE_WIDTH} 0 0 ${PDF_PAGE_HEIGHT} 0 0 cm\n/Im${index + 1} Do\nQ\n`
    );
    objectParts[contentId] = concatenateBytes([
      encodeText(`<< /Length ${content.length} >>\nstream\n`),
      content,
      encodeText("endstream")
    ]);
    objectParts[pageId] = encodeText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] `
      + `/Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
  });

  const parts = [
    encodeText("%PDF-1.4\n"),
    new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])
  ];
  const offsets = new Array(objectCount + 1).fill(0);
  let bytePosition = parts.reduce((total, part) => total + part.length, 0);

  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = bytePosition;
    const object = concatenateBytes([
      encodeText(`${id} 0 obj\n`),
      objectParts[id],
      encodeText("\nendobj\n")
    ]);
    parts.push(object);
    bytePosition += object.length;
  }

  const xrefOffset = bytePosition;
  const xrefRows = offsets.slice(1)
    .map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  parts.push(encodeText(
    `xref\n0 ${objectCount + 1}\n`
    + "0000000000 65535 f \n"
    + xrefRows
    + `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\n`
    + `startxref\n${xrefOffset}\n%%EOF\n`
  ));

  return concatenateBytes(parts);
}

function displayValue(value) {
  const text = String(value ?? "").trim();
  return text || EMPTY_VALUE;
}

function formatBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return EMPTY_VALUE;
  const [, year, month, day] = match;
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const numericYear = Number(year);
  const leapYear = numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (numericMonth < 1 || numericMonth > 12
      || numericDay < 1 || numericDay > daysInMonth[numericMonth - 1]) {
    return EMPTY_VALUE;
  }
  return `${day}.${month}.${year}`;
}

function formatSubmittedAt(value) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(instant);
}

function confirmationLabel(value) {
  return value === true ? "Ja" : "Nein";
}

function canvasFont(weight, size) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

function splitLongToken(context, token, maxWidth) {
  const chunks = [];
  let chunk = "";
  for (const character of Array.from(token)) {
    const candidate = chunk + character;
    if (chunk && context.measureText(candidate).width > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [""];
}

function wrapParagraph(context, paragraph, maxWidth) {
  if (paragraph === "") return [""];
  const words = paragraph.trim().split(/\s+/u);
  const lines = [];
  let line = "";

  for (const word of words) {
    const pieces = context.measureText(word).width > maxWidth
      ? splitLongToken(context, word, maxWidth)
      : [word];
    for (const piece of pieces) {
      const candidate = line ? `${line} ${piece}` : piece;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = piece;
      } else {
        line = candidate;
      }
      if (context.measureText(line).width > maxWidth) {
        const forced = splitLongToken(context, line, maxWidth);
        lines.push(...forced.slice(0, -1));
        line = forced.at(-1) || "";
      }
    }
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

function wrapText(context, value, maxWidth) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap(paragraph => wrapParagraph(context, paragraph, maxWidth));
}

function createCanvasRenderer() {
  const pages = [];
  let page = null;
  let context = null;
  let cursorY = PAGE_MARGIN;

  function addPage() {
    page = document.createElement("canvas");
    page.width = PAGE_WIDTH;
    page.height = PAGE_HEIGHT;
    context = page.getContext("2d");
    if (!context) throw new Error("Canvas 2D ist nicht verfügbar.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    context.textBaseline = "top";
    pages.push(page);
    cursorY = PAGE_MARGIN;
  }

  function ensureSpace(height) {
    if (!page) addPage();
    if (cursorY + height > CONTENT_BOTTOM) addPage();
  }

  function drawLines(lines, options = {}) {
    const size = options.size || 27;
    const lineHeight = options.lineHeight || Math.ceil(size * 1.42);
    for (const line of lines) {
      ensureSpace(lineHeight);
      context.font = canvasFont(options.weight || 400, size);
      context.fillStyle = options.color || "#172033";
      context.textBaseline = "top";
      if (line) context.fillText(line, PAGE_MARGIN, cursorY);
      cursorY += lineHeight;
    }
    cursorY += options.after || 0;
  }

  function drawWrapped(value, options = {}) {
    const size = options.size || 27;
    context.font = canvasFont(options.weight || 400, size);
    drawLines(wrapText(context, value, PAGE_WIDTH - (PAGE_MARGIN * 2)), options);
  }

  function drawSection(title) {
    ensureSpace(210);
    cursorY += 18;
    context.strokeStyle = "#cad2df";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(PAGE_MARGIN, cursorY);
    context.lineTo(PAGE_WIDTH - PAGE_MARGIN, cursorY);
    context.stroke();
    cursorY += 24;
    drawWrapped(title, { size: 32, lineHeight: 42, weight: 700, color: "#1f4d7a", after: 18 });
  }

  function drawField(label, value) {
    ensureSpace(94);
    drawWrapped(label, { size: 22, lineHeight: 30, weight: 700, color: "#536176", after: 4 });
    drawWrapped(displayValue(value), { size: 28, lineHeight: 39, weight: 400, after: 18 });
  }

  function finishFooters() {
    pages.forEach((canvas, index) => {
      const footerContext = canvas.getContext("2d");
      if (!footerContext) return;
      footerContext.strokeStyle = "#cad2df";
      footerContext.lineWidth = 2;
      footerContext.beginPath();
      footerContext.moveTo(PAGE_MARGIN, 1650);
      footerContext.lineTo(PAGE_WIDTH - PAGE_MARGIN, 1650);
      footerContext.stroke();
      footerContext.font = canvasFont(400, 21);
      footerContext.fillStyle = "#657085";
      footerContext.textBaseline = "top";
      footerContext.textAlign = "right";
      footerContext.fillText(`Seite ${index + 1} / ${pages.length}`, PAGE_WIDTH - PAGE_MARGIN, 1670);
    });
  }

  return {
    pages,
    addPage,
    drawField,
    drawSection,
    drawWrapped,
    finishFooters
  };
}

async function renderApplicationPages(detail) {
  if (typeof document === "undefined") {
    throw new Error("PDF-Rendering benötigt einen Browser.");
  }
  if (document.fonts?.ready) await document.fonts.ready;

  const data = selectApplicationPdfData(detail);
  const renderer = createCanvasRenderer();
  renderer.addPage();
  renderer.drawWrapped("Mitgliedsantrag", {
    size: 54,
    lineHeight: 66,
    weight: 750,
    color: "#15395d",
    after: 4
  });
  renderer.drawWrapped("Plärrdeifl Fanclub", {
    size: 31,
    lineHeight: 44,
    weight: 600,
    color: "#526579",
    after: 34
  });
  renderer.drawField("Antrags-ID", data.id);
  renderer.drawField("Eingegangen", formatSubmittedAt(data.submittedAt));

  renderer.drawSection("Persönliche Angaben");
  renderer.drawField("Vorname", data.firstName);
  renderer.drawField("Nachname", data.lastName);
  renderer.drawField("Geburtsdatum", formatBirthDate(data.birthDate));
  renderer.drawField("E-Mail", data.email);
  renderer.drawField("Telefon", data.phone);

  renderer.drawSection("Adresse");
  renderer.drawField("Straße", data.street);
  renderer.drawField("Hausnummer", data.houseNumber);
  renderer.drawField("Postleitzahl", data.postalCode);
  renderer.drawField("Ort", data.city);

  renderer.drawSection("Digitale Antragserklärung");
  renderer.drawField("Erklärung bestätigt", confirmationLabel(data.declarationConfirmed));
  renderer.drawField("Erklärungsversion", data.declarationVersion);
  renderer.drawField("Satzung bestätigt", confirmationLabel(data.statutesConfirmed));
  renderer.drawField("Satzungsversion", data.statutesVersion);
  renderer.drawField("Satzungsreferenz", data.statutesReference);

  renderer.drawSection("Nachricht an den Vorstand");
  renderer.drawWrapped(
    String(data.applicantMessage ?? "").trim() || MINIMIZED_MESSAGE,
    { size: 28, lineHeight: 41, weight: 400, after: 20 }
  );

  renderer.drawSection("Hinweis");
  renderer.drawWrapped(
    "Dieser PDF-Auszug dokumentiert die aktuell gespeicherten Angaben des Mitgliedsantrags. Er enthält keine Aufnahmeentscheidung und begründet keine Mitgliedschaft.",
    { size: 27, lineHeight: 40, weight: 400, color: "#37465a" }
  );
  renderer.finishFooters();
  return renderer.pages;
}

function canvasToJpegPage(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(async blob => {
        if (!blob) {
          reject(new Error("JPEG-Seite konnte nicht erzeugt werden."));
          return;
        }
        try {
          resolve({
            bytes: new Uint8Array(await blob.arrayBuffer()),
            width: canvas.width,
            height: canvas.height
          });
        } catch {
          reject(new Error("JPEG-Seite konnte nicht gelesen werden."));
        }
      }, "image/jpeg", 0.9);
    } catch {
      reject(new Error("JPEG-Seite konnte nicht erzeugt werden."));
    }
  });
}

function applicationPdfFileName(applicationId) {
  const match = /^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .exec(String(applicationId ?? "").trim());
  if (!match) throw new Error("Ungültige Antrags-ID.");
  return `mitgliedsantrag-${match[1].toLowerCase()}.pdf`;
}

export async function downloadMembershipApplicationPdf(detail) {
  const data = selectApplicationPdfData(detail);
  const fileName = applicationPdfFileName(data.id);
  const canvases = await renderApplicationPages(data);
  const jpegPages = [];
  for (const canvas of canvases) {
    jpegPages.push(await canvasToJpegPage(canvas));
  }
  const pdfBytes = buildPdfFromJpegPages(jpegPages);
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(pdfBlob);
  const anchor = document.createElement("a");
  let downloadStarted = false;

  try {
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    downloadStarted = true;
  } finally {
    anchor.remove();
    if (downloadStarted) {
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } else {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
