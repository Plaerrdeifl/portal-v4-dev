import { readFile, writeFile, rm } from "node:fs/promises";

const fanbusPath = "js/modules/fanbuses.js";
let source = await readFile(fanbusPath, "utf8");

const marker = `function closeInlineTripDetail() {`;
const wrapper = `function openTripDetail(trip) {
  if (!trip) return;
  const records = [...document.querySelectorAll("[data-m310-open-trip]")]
    .filter(record => record.dataset.m310OpenTrip === trip.id);
  const record = records.find(item => item.offsetParent !== null) || records[0];
  if (record) openTripDetailAtRecord(trip, record);
}

`;
if (!source.includes(marker)) throw new Error("inline detail marker missing");
if (!source.includes("function openTripDetail(trip) {")) {
  source = source.replace(marker, wrapper + marker);
}
source = source.replace("function openTripDetail(trip, record) {", "function openTripDetailAtRecord(trip, record) {");
source = source.replace("if (trip) openTripDetail(trip, record);", "if (trip) openTripDetailAtRecord(trip, record);");

const routeBlock = `    const records = [...panel.querySelectorAll(\`[data-m310-open-trip="\${CSS.escape(detailTrip.id)}"]\`)];
    const record = records.find(item => item.offsetParent !== null) || records[0];
    if (record) openTripDetail(detailTrip, record);`;
if (source.includes(routeBlock)) {
  source = source.replace(routeBlock, `    openTripDetail(detailTrip);`);
}

source = source.replaceAll(
  `data-m310-open-trip="\${escapeAttr(trip.id)}" aria-label=`,
  `data-m310-open-trip="\${escapeAttr(trip.id)}" aria-expanded="false" aria-label=`
);
source = source.replaceAll(
  `type="button" data-m310-open-trip="\${escapeAttr(trip.id)}">`,
  `type="button" data-m310-open-trip="\${escapeAttr(trip.id)}" aria-expanded="false">`
);

await writeFile(fanbusPath, source, "utf8");

const testPath = "tests/p800_r2_fanbus_accordion.test.mjs";
let testSource = await readFile(testPath, "utf8");
testSource = testSource.replace(
  'const start = source.indexOf("function openTripDetail(trip, record)");',
  'const start = source.indexOf("function openTripDetailAtRecord(trip, record)");'
);
testSource = testSource.replace('/data\\.m310InlineTripDetail/', '/dataset\\.m310InlineTripDetail/');
testSource = testSource.replace(
  'assert.doesNotMatch(detail, /window\\.location\\.hash/);',
  'assert.doesNotMatch(detail, /window\\.location\\.hash/);\n  assert.match(source, /function openTripDetail\\(trip\\)/);'
);
await writeFile(testPath, testSource, "utf8");

await rm("scripts/fix-fanbus-accordion-contracts.mjs");
