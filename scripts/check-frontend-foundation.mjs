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
const sidebar = read("components/sidebar.html");
const authSource = read("js/auth.js");
const pagesSource = read("js/pages.js");
const googleSignIn = read("js/google-signin.js");
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
  "var(--mobile-nav-height)",
  ".sidebar .nav-main{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}",
  ".sidebar .nav-footer{flex:0 0 auto;overflow:visible;position:relative;z-index:2;",
  'html[data-portal-area="portal"] .sidebar{overflow:hidden!important;padding-bottom:calc(18px + var(--mobile-nav-height) + var(--safe-bottom))!important}',
  ".google-signin-slot>div{",
  "padding-inline:10px",
  "max-width:none!important"
]) {
  if (!appCss.includes(required)) {
    throw new Error(`Globale Frontend-Grundlage unvollständig: ${required}`);
  }
}

for (const required of [
  'id="mobileNav"',
  'more.id = "mobileMoreToggle"',
  "MOBILE_PRIMARY",
  'event.target.closest("#mobileMoreToggle")',
  "toggleMobileMenu();"
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

for (const [label, markup] of [["index.html", html], ["components/sidebar.html", sidebar]]) {
  for (const required of [
    'id="portalNavFooter"',
    'class="portal-home-entry"',
    'data-route="home"',
    '<span>Zur Startseite</span>'
  ]) {
    if (!markup.includes(required)) {
      throw new Error(`Statischer Startseiten-Footer fehlt in ${label}: ${required}`);
    }
  }

  if (!markup.includes('id="portalNavFooter" class="nav nav-footer" aria-label="Portalnavigation" aria-hidden="true" hidden')) {
    throw new Error(`Der Startseiten-Footer besitzt in ${label} keinen sicheren öffentlichen Initialzustand.`);
  }
}

if (ui.includes("footerNav.replaceChildren")) {
  throw new Error("Der statische Startseiten-Footer wird noch dynamisch geleert.");
}
if (!ui.includes("footerNav.hidden = !authenticatedPortal;")) {
  throw new Error("Der Startseiten-Footer wird nicht explizit an den authentifizierten Portalzustand gebunden.");
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

if (
  authSource.includes("window.open(")
  || authSource.includes("signInWithOAuth")
  || authSource.includes("oauthPopup")
) {
  throw new Error("Der Login enthält noch ein manuell erzeugtes OAuth-Fenster.");
}

for (const required of [
  "signInWithIdToken",
  "signInWithGoogleIdToken"
]) {
  if (!authSource.includes(required)) {
    throw new Error(`Supabase-ID-Token-Login fehlt: ${required}`);
  }
}

for (const required of [
  "https://accounts.google.com/gsi/client",
  'ux_mode: "popup"',
  "renderButton",
  "BUTTON_HORIZONTAL_INSET = 24",
  "await afterLayout()",
  "use_fedcm_for_button: true",
  "button_auto_select: false",
  'size: "medium"'
]) {
  if (!googleSignIn.includes(required)) {
    throw new Error(`Google Identity Services unvollständig: ${required}`);
  }
}

if (googleSignIn.includes("use_fedcm_for_prompt")) {
  throw new Error(
    "Der veraltete FedCM-Prompt-Schalter darf nicht verwendet werden."
  );
}

if (
  !pagesSource.includes("renderGoogleSignInButton")
  || pagesSource.includes("supabaseGoogleLogin")
) {
  throw new Error("Die Loginseite verwendet nicht ausschließlich den offiziellen Google-Button.");
}

if (
  html.includes("oauth-return-guard")
  || fs.existsSync(path.join(root, "js", "oauth-return-guard.js"))
) {
  throw new Error("Die alte OAuth-Rückkehrlogik ist noch vorhanden.");
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
  + "Google-Button ohne iframe-Clipping · Startseiten-Footer oberhalb der Bottom-Navigation"
);
