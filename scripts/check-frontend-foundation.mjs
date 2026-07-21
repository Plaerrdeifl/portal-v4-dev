import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const cssFiles = fs.readdirSync(path.join(root, "css"))
  .filter(name => name.endsWith(".css"))
  .sort();

const expectedCssFiles = ["app.css", "tokens.css"];

if (JSON.stringify(cssFiles) !== JSON.stringify(expectedCssFiles)) {
  throw new Error(
    `Ungültige CSS-Struktur: ${cssFiles.join(", ")}. `
    + "Erlaubt sind ausschließlich app.css und tokens.css."
  );
}

const html = read("index.html");
const appCss = read("css/app.css");
const ui = read("js/ui.js");
const login = read("pages/login.html");
const packageJson = JSON.parse(read("package.json"));

const stylesheetLinks = [
  ...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)
].map(match => match[1].split("?")[0]);

if (
  JSON.stringify(stylesheetLinks)
  !== JSON.stringify(["./css/tokens.css", "./css/app.css"])
) {
  throw new Error(
    `Ungültige Stylesheet-Reihenfolge: ${stylesheetLinks.join(", ")}`
  );
}

for (const token of [
  'data-route="login"',
  "mobile-more-",
  "mobileMorePanel",
  "corr4-account",
  "public-welcome-",
  "dashboard-hero",
  "dashboard-connection-",
  "public-login-page",
  "public-login-card",
  "authTransitionOverlay"
]) {
  if (appCss.includes(token)) {
    throw new Error(`Verbotener Altbestand in app.css: ${token}`);
  }
}

for (const token of [
  "mobileMorePanel",
  "mobileMoreBackdrop",
  "openMobileMore",
  "closeMobileMore",
  "mobileMoreRoutes"
]) {
  if (ui.includes(token)) {
    throw new Error(`Verbotene alte Mehr-Panel-Logik: ${token}`);
  }
}

for (const required of [
  ".mobile-bottom-nav",
  ".mobile-nav-button",
  "var(--mobile-nav-height)"
]) {
  if (!appCss.includes(required)) {
    throw new Error(`Mobile Bottom-Navigation unvollständig: ${required}`);
  }
}

for (const required of [
  'id="mobileNav"',
  'more.id = "mobileMoreToggle"',
  "MOBILE_PRIMARY",
  'event.target.closest("#mobileMoreToggle")',
  "openMobileMenu();"
]) {
  const source = required === 'id="mobileNav"' ? html : ui;

  if (!source.includes(required)) {
    throw new Error(`Mobile Navigation unvollständig: ${required}`);
  }
}

if (
  html.includes('id="mobileMorePanel"')
  || html.includes('id="mobileMoreBackdrop"')
) {
  throw new Error("Das veraltete separate Mehr-Panel ist noch vorhanden.");
}

if (html.includes('id="authTransitionOverlay"')) {
  throw new Error("Der veraltete Auth-Übergangs-Layer ist noch vorhanden.");
}

if (!login.includes("public-login-inline")) {
  throw new Error("Der Login verwendet nicht die kanonische Inhaltsseite.");
}

if (
  login.includes("auth-page")
  || login.includes("auth-brand-panel")
  || login.includes("auth-card-wrap")
) {
  throw new Error("Der Login enthält noch die alte Vollseiten-Auth-Hülle.");
}

if (!packageJson.scripts?.["check:frontend"]) {
  throw new Error("Die Frontend-Architekturprüfung fehlt.");
}

const forbiddenFilePattern = /(?:corr|patch|uiux-p)/i;

for (const name of cssFiles) {
  if (forbiddenFilePattern.test(name)) {
    throw new Error(`Verbotener Korrekturdateiname: ${name}`);
  }
}

const jsFiles = [];
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(target);
    } else if (entry.name.endsWith(".js")) {
      jsFiles.push(path.relative(root, target).replaceAll("\\", "/"));
    }
  }
};

walk(path.join(root, "js"));

for (const file of jsFiles) {
  if (/\/m4-corr\d|\/google-identity\.js$/i.test(`/${file}`)) {
    throw new Error(`Veraltete JavaScript-Datei ist noch aktiv: ${file}`);
  }
}

if (/@import\b/i.test(appCss)) {
  throw new Error("app.css darf keine weiteren Stylesheets importieren.");
}

let depth = 0;
let quote = "";
let escaped = false;

for (const character of appCss) {
  if (escaped) {
    escaped = false;
    continue;
  }

  if (quote) {
    if (character === "\\") {
      escaped = true;
    } else if (character === quote) {
      quote = "";
    }
    continue;
  }

  if (character === '"' || character === "'") {
    quote = character;
  } else if (character === "{") {
    depth += 1;
  } else if (character === "}") {
    depth -= 1;

    if (depth < 0) {
      throw new Error("app.css enthält eine unerwartete schließende Klammer.");
    }
  }
}

if (depth !== 0 || quote) {
  throw new Error("app.css ist syntaktisch nicht ausgeglichen.");
}

console.log(
  `FRONTEND_FOUNDATION_OK · ${cssFiles.length} CSS-Dateien · `
  + "Bottom-Navigation aktiv · Mehr öffnet Seitenleiste"
);
