import { readFile, writeFile } from "node:fs/promises";

const corePath = "tests/core_contract.test.mjs";
const core = await readFile(corePath, "utf8");
const startMarker = 'test("Vercel DEV deployment publishes only the static build"';
const endMarker = '\ntest("team codes are generated internally';
const start = core.indexOf(startMarker);
const end = core.indexOf(endMarker, start);
if (start < 0 || end <= start) {
  throw new Error("Obsolete deployment contract block not found exactly where expected.");
}

const replacement = `test("Cloudflare Pages DEV deployment publishes only the static build", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const build = await read("scripts/build-static.mjs");
  const ignore = await read(".gitignore");
  const readme = await read("README.md");

  assert.equal(pkg.scripts.build, "node scripts/build-static.mjs");
  assert.match(readme, /DEV-Hosting:\\*\\* Cloudflare Pages/);
  assert.match(readme, /Hosting\\/Deployment: Cloudflare Pages über die GitHub-Integration/);

  for (const directory of [
    "assets",
    "components",
    "css",
    "js",
    "pages"
  ]) {
    assert.ok(build.includes(\`"\${directory}"\`));
  }

  assert.ok(build.includes("write-runtime-config.mjs"));
  assert.ok(build.includes("SUPABASE_PUBLISHABLE_KEY"));
  assert.doesNotMatch(build, /service[_-]?role/i);
  assert.match(ignore, /^\\/dist\\/$/m);
});
`;
await writeFile(corePath, core.slice(0, start) + replacement + core.slice(end), "utf8");

const agentsPath = "AGENTS.md";
const agents = await readFile(agentsPath, "utf8");
const marker = "## 5. Geheimhaltung & Netzwerksicherheit\n";
if (!agents.includes(marker)) {
  throw new Error("AGENTS hosting insertion marker missing.");
}
const hostingRules = `## 5. Hosting / Deployment-Ziel

* **Frontend-Hosting:** DEV und PROD verwenden ausschließlich Cloudflare Pages.
* **Kein Vercel:** Vercel gehört nicht zu diesem Projekt und darf weder als Hosting-/Deploymentziel vorgeschlagen noch konfiguriert, installiert oder verwendet werden.
* **DEV:** \`https://dev.plaerrdeifl.de/\` wird aus \`main\` über die Cloudflare-Pages-GitHub-Integration veröffentlicht.

---

## 6. Geheimhaltung & Netzwerksicherheit
`;
await writeFile(agentsPath, agents.replace(marker, hostingRules), "utf8");
