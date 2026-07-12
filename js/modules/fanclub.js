import {
  call, canRead, canWrite, closeDialog, confirmAction, currentUser, empty, errorPanel,
  escapeAttr, escapeHtml, fmtDate, fmtMoney, loading, normalize, openDialog, optionList,
  portal, runWrite, showToast, statusBadge, tabBar, today
} from "./common.js";
import { phase3State } from "./state.js";

const KEY = "fanclub:";
let activeTab = "overview";

function target() { return document.getElementById("fanclubPanel"); }
function setStatus(text, type = "success") {
  const el = document.getElementById("fanclubStatus");
  if (el) { el.textContent = text; el.className = `status-pill ${type}`; }
}
function queryTab() {
  const hash = String(location.hash || "");
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get("tab") || "";
}
function setTabHash(tab) {
  const next = `#/fanclub?tab=${encodeURIComponent(tab)}`;
  if (location.hash === next) renderTab(tab); else location.hash = next;
}
function tabs() {
  const p = portal();
  return [
    { id: "overview", label: "Start", icon: "🏠", show: true },
    { id: "members", label: "Mitglieder", icon: "👥", show: canRead("Mitglieder") },
    { id: "contributions", label: "Beiträge", icon: "💶", show: canRead("Beiträge") },
    { id: "cashbook", label: "Kasse", icon: "📒", show: canRead("Kasse") },
    { id: "accounts", label: "Konten", icon: "🏦", show: canRead("Konten") },
    { id: "tasks", label: "Aufgaben", icon: "✅", show: Boolean(p.boardAccess) || canRead("Aufgaben") }
  ].filter(item => item.show);
}
function renderTabs() {
  const items = tabs();
  if (!items.some(item => item.id === activeTab)) activeTab = items[0]?.id || "overview";
  const wrap = document.getElementById("fanclubTabs");
  if (wrap) {
    wrap.innerHTML = tabBar(items, activeTab, "fanclub");
    wrap.querySelectorAll('[data-module-tab="fanclub"]').forEach(button => button.addEventListener("click", () => setTabHash(button.dataset.tab)));
  }
}

export async function hydrateFanclub() {
  const requested = queryTab();
  activeTab = tabs().some(item => item.id === requested) ? requested : (tabs()[0]?.id || "overview");
  renderTabs();
  await renderTab(activeTab);
}

async function renderTab(tab) {
  activeTab = tabs().some(item => item.id === tab) ? tab : (tabs()[0]?.id || "overview");
  renderTabs();
  setStatus("Daten werden geladen", "warning");
  const panel = target();
  if (panel) panel.innerHTML = loading();
  try {
    if (activeTab === "overview") await renderOverview();
    if (activeTab === "members") await renderMembers();
    if (activeTab === "contributions") await renderContributions();
    if (activeTab === "cashbook") await renderCashbook();
    if (activeTab === "accounts") await renderAccounts();
    if (activeTab === "tasks") await renderTasks();
    setStatus("Live verbunden", "success");
  } catch (error) {
    if (panel) panel.innerHTML = errorPanel(error);
    setStatus("Fehler", "warning");
  }
}

async function renderOverview(force = false) {
  let data = phase3State.get(KEY + "overview");
  if (!data || force) data = phase3State.set(KEY + "overview", await call("apiListActiveMemberNames"));
  const names = Array.isArray(data?.names) ? data.names : [];
  const actions = tabs().filter(item => item.id !== "overview").map(item => `<button class="admin-action" type="button" data-fanclub-tab="${escapeAttr(item.id)}"><strong>${escapeHtml(item.icon)} ${escapeHtml(item.label)}</strong><span>Bereich öffnen.</span></button>`).join("");
  target().innerHTML = `
    <div class="grid three">
      <article class="card stat-card"><div class="card-icon">👥</div><h3>Aktive Mitglieder</h3><strong>${names.length}</strong><small>Nur Namen werden in dieser Übersicht angezeigt.</small></article>
      <article class="card"><h3>Dein Zugang</h3><p>${escapeHtml(currentUser().role || "Portaluser")}${currentUser().isAdmin ? " · Vollzugriff" : ""}</p></article>
      <article class="card"><h3>v3-Stand</h3><p>Der Fanclubbereich wurde in die GitHub-PWA migriert. Rechte bleiben vollständig serverseitig.</p></article>
    </div>
    <article class="card"><div class="section-title"><div><h3>Fanclubbereiche</h3><p>Es erscheinen nur freigegebene Module.</p></div><button class="button ghost small" id="fanclubOverviewRefresh">Aktualisieren</button></div><div class="admin-actions" style="margin-top:16px">${actions || empty("Keine weiteren Bereiche freigegeben.")}</div></article>
    <article class="card"><h3>Mitgliederliste</h3><p class="subtle">Aktive Namen ohne Kontakt- oder Identitätsdaten.</p><div class="list-grid" style="margin-top:14px">${names.map(name => `<div class="member-line"><strong>${escapeHtml(name)}</strong><span class="badge success">Aktiv</span></div>`).join("") || empty("Keine aktiven Mitglieder vorhanden.")}</div></article>`;
  target().querySelectorAll("[data-fanclub-tab]").forEach(button => button.addEventListener("click", () => setTabHash(button.dataset.fanclubTab)));
  document.getElementById("fanclubOverviewRefresh")?.addEventListener("click", () => renderOverview(true));
}

async function getMembers(force = false) {
  let data = phase3State.get(KEY + "members");
  if (!data || force) data = phase3State.set(KEY + "members", await call("apiListMembers"));
  return data || { members: [], meta: {} };
}
async function renderMembers(force = false) {
  const data = await getMembers(force);
  const members = data.members || [];
  target().innerHTML = `
    <div class="module-toolbar"><input id="memberSearch" class="grow" placeholder="Mitglied suchen …"><select id="memberStatus"><option value="">Alle Status</option>${optionList(data.meta?.statusListe || [])}</select>${canWrite("Mitglieder") ? '<button id="newMember" class="button primary" type="button">+ Mitglied</button>' : ""}<button id="refreshMembers" class="button ghost" type="button">Aktualisieren</button></div>
    <div id="memberResults"></div>`;
  const render = () => {
    const q = normalize(document.getElementById("memberSearch")?.value);
    const s = String(document.getElementById("memberStatus")?.value || "");
    const list = members.filter(m => (!q || normalize([m.id,m.name,m.email,m.telefon,m.status].join(" ")).includes(q)) && (!s || m.status === s));
    document.getElementById("memberResults").innerHTML = entityTable(
      ["Mitglied", "Status", "Mitgliedschaft", "Kontakt", ""],
      list.map(m => [`<strong>${escapeHtml(m.name || "Ohne Name")}</strong><div class="subtle">${escapeHtml(m.id || "")}</div>`, statusBadge(m.status), escapeHtml(m.mitgliedschaft || "–"), `<span class="subtle">${escapeHtml(m.email || m.telefon || "–")}</span>`, `<button class="button small ghost" data-member-id="${escapeAttr(m.id)}">Öffnen</button>`]),
      "Keine Mitglieder gefunden."
    );
    document.querySelectorAll("[data-member-id]").forEach(btn => btn.addEventListener("click", () => openMember(btn.dataset.memberId)));
  };
  render();
  document.getElementById("memberSearch")?.addEventListener("input", render);
  document.getElementById("memberStatus")?.addEventListener("change", render);
  document.getElementById("newMember")?.addEventListener("click", () => openMemberForm(null, data.meta));
  document.getElementById("refreshMembers")?.addEventListener("click", () => renderMembers(true));
}

function entityTable(headers, rows, emptyMessage) {
  const head = headers.map(h => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("");
  const cards = rows.map(row => `<article class="card entity-card">${row.map((cell,i) => `<div><small class="subtle">${escapeHtml(headers[i] || "")}</small><div>${cell}</div></div>`).join("")}</article>`).join("");
  return rows.length ? `<div class="card table-card"><div class="data-table-wrap desktop-only"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div><div class="mobile-cards">${cards}</div>` : empty(emptyMessage);
}

async function openMember(id) {
  try {
    const member = await call("apiGetMember", id);
    const address = [member.strasse, member.hausnummer, [member.plz,member.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    openDialog({
      title: member.name || "Mitglied", kicker: member.id || "Mitglied",
      body: `<div class="grid two"><article class="card"><h3>Mitgliedschaft</h3><p>${statusBadge(member.status)} · ${escapeHtml(member.mitgliedschaft || "–")}</p><p style="margin-top:12px"><strong>Eintritt:</strong> ${escapeHtml(fmtDate(member.eintritt))}<br><strong>Geburtstag:</strong> ${escapeHtml(fmtDate(member.geburtsdatum))}</p></article><article class="card"><h3>Kontakt</h3><p>${escapeHtml(address || "–")}<br>${escapeHtml(member.telefon || "–")}<br>${escapeHtml(member.email || "–")}</p></article></div>${member.contribution ? `<article class="card"><h3>Aktueller Beitrag</h3><p>Soll ${fmtMoney(member.contribution.soll)} · Gezahlt ${fmtMoney(member.contribution.gezahlt)} · Offen <strong>${fmtMoney(member.contribution.offen)}</strong></p></article>` : ""}<div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button>${canWrite("Mitglieder") ? '<button id="editMember" class="button primary" type="button">Bearbeiten</button>' : ""}</div>`, wide: true
    });
    document.getElementById("editMember")?.addEventListener("click", () => openMemberForm(member, phase3State.get(KEY + "members")?.meta || {}));
  } catch (error) { showToast(error.message, "error", 6000); }
}

function openMemberForm(member = {}, meta = {}) {
  member = member || {};
  openDialog({
    title: member.id ? "Mitglied bearbeiten" : "Mitglied anlegen", kicker: member.id || "Neue Mitgliedschaft", wide: true,
    body: `<form><input type="hidden" name="id" value="${escapeAttr(member.id || "")}"><div class="form-grid">
      <label>Status<select name="status">${optionList(meta.statusListe || ["Aktiv","Passiv","Ehrenmitglied","Ausgetreten"], member.status || "Aktiv")}</select></label>
      <label>Mitgliedschaft<select name="mitgliedschaft">${optionList(meta.mitgliedschaften || ["Vollzahler"], member.mitgliedschaft || "Vollzahler")}</select></label>
      <label>Vorname<input name="vorname" value="${escapeAttr(member.vorname || "")}"></label><label>Nachname<input name="nachname" value="${escapeAttr(member.nachname || "")}"></label>
      <label>Geburtstag<input type="date" name="geburtsdatum" value="${escapeAttr(member.geburtsdatum || "")}"></label><label>Eintritt<input type="date" name="eintritt" value="${escapeAttr(member.eintritt || today())}"></label>
      <label>Telefon<input name="telefon" value="${escapeAttr(member.telefon || "")}"></label><label>E-Mail<input type="email" name="email" value="${escapeAttr(member.email || "")}"></label>
      <label>Straße<input name="strasse" value="${escapeAttr(member.strasse || "")}"></label><label>Hausnummer<input name="hausnummer" value="${escapeAttr(member.hausnummer || "")}"></label>
      <label>PLZ<input name="plz" inputmode="numeric" value="${escapeAttr(member.plz || "")}"></label><label>Ort<input name="ort" value="${escapeAttr(member.ort || "")}"></label>
      <label class="full">Bemerkung<textarea name="bemerkung">${escapeHtml(member.bemerkung || "")}</textarea></label></div></form>`,
    onSubmit: async data => {
      await runWrite("Mitglied wird gespeichert …", () => call("apiSaveMember", data));
      closeDialog(); phase3State.remove(KEY + "members"); phase3State.remove(KEY + "overview"); await renderMembers(true);
    }
  });
}

async function renderContributions(force = false) {
  let data = phase3State.get(KEY + "contributions");
  if (!data || force) data = phase3State.set(KEY + "contributions", await call("apiListContributions", { status: "alle" }));
  const list = data.contributions || [];
  target().innerHTML = `<div class="module-toolbar"><input id="contributionSearch" class="grow" placeholder="Beitrag suchen …"><select id="contributionStatus"><option value="offen">Offen</option><option value="bezahlt">Bezahlt</option><option value="alle">Alle</option></select><button id="refreshContributions" class="button ghost">Aktualisieren</button></div><div id="contributionResults"></div>`;
  const render = () => {
    const q = normalize(document.getElementById("contributionSearch")?.value);
    const status = document.getElementById("contributionStatus")?.value || "offen";
    const filtered = list.filter(c => (!q || normalize([c.id,c.name,c.beitragsklasse,c.status].join(" ")).includes(q)) && (status === "alle" || (status === "offen" ? Number(c.offen)>0 : Number(c.offen)<=0 && Number(c.gezahlt)>0)));
    document.getElementById("contributionResults").innerHTML = entityTable(["Mitglied","Soll","Gezahlt","Offen","Status",""], filtered.map(c => [escapeHtml(c.name || c.id), fmtMoney(c.soll), fmtMoney(c.gezahlt), `<strong>${fmtMoney(c.offen)}</strong>`, statusBadge(Number(c.offen)>0 ? "Offen" : "Bezahlt"), canWrite("Beiträge") && Number(c.offen)>0 ? `<button class="button small primary" data-pay-member="${escapeAttr(c.id)}">Buchen</button>` : ""]), "Keine Beiträge gefunden.");
    document.querySelectorAll("[data-pay-member]").forEach(btn => btn.addEventListener("click", () => openContributionPayment(filtered.find(c => String(c.id)===btn.dataset.payMember), data.meta || {})));
  };
  render(); document.getElementById("contributionSearch")?.addEventListener("input", render); document.getElementById("contributionStatus")?.addEventListener("change", render); document.getElementById("refreshContributions")?.addEventListener("click", () => renderContributions(true));
}
async function accountData(force = false) {
  let data = phase3State.get(KEY + "accounts");
  if (!data || force) data = phase3State.set(KEY + "accounts", await call("apiListAccounts"));
  return data || { accounts: [], inactive: [], meta: {} };
}
async function openContributionPayment(contribution, meta) {
  if (!contribution) return;
  const accounts = await accountData();
  const names = (accounts.accounts || []).filter(a => a.aktiv !== "NEIN").map(a => a.name);
  openDialog({ title: "Beitragszahlung buchen", kicker: contribution.name || contribution.id,
    body: `<form><input type="hidden" name="mitgliedsId" value="${escapeAttr(contribution.id)}"><div class="form-grid"><label>Betrag<input name="betrag" inputmode="decimal" value="${escapeAttr(contribution.offen || contribution.soll || "")}" required></label><label>Datum<input type="date" name="datum" value="${today()}" required></label><label>Zahlungsart<select name="zahlungsart">${optionList(meta.zahlungsarten || ["Bar","Überweisung","PayPal","Lastschrift","Sonstiges"], "Bar")}</select></label><label>Konto<select name="konto" required>${optionList(names, names.includes("Kasse") ? "Kasse" : names[0], "Konto auswählen")}</select></label><label class="full">Bemerkung<input name="bemerkung"></label></div></form>`,
    onSubmit: async data => { await runWrite("Beitragszahlung wird gebucht …", () => call("apiBookContribution", data)); closeDialog(); phase3State.remove(KEY+"contributions"); phase3State.remove(KEY+"accounts"); await renderContributions(true); }
  });
}

async function renderCashbook(force = false) {
  let data = phase3State.get(KEY + "cashbook");
  if (!data || force) data = phase3State.set(KEY + "cashbook", await call("apiListBookings", { max: 100 }));
  const list = data.bookings || [];
  target().innerHTML = `<div class="module-toolbar"><input id="bookingSearch" class="grow" placeholder="Buchung suchen …">${canWrite("Kasse") ? '<button id="newBooking" class="button primary">+ Buchung</button><button id="newTransfer" class="button secondary">Umbuchung</button>' : ""}<button id="refreshCashbook" class="button ghost">Aktualisieren</button></div><div id="bookingResults"></div>`;
  const render = () => {
    const q = normalize(document.getElementById("bookingSearch")?.value);
    const filtered = list.filter(b => !q || normalize([b.buchungsNr,b.datum,b.art,b.kategorie,b.beschreibung,b.konto,b.status,b.betrag].join(" ")).includes(q));
    document.getElementById("bookingResults").innerHTML = entityTable(["Datum","Buchung","Konto","Betrag","Status",""], filtered.map(b => [escapeHtml(fmtDate(b.datum)), `<strong>${escapeHtml(b.beschreibung || b.kategorie || b.buchungsNr)}</strong><div class="subtle">${escapeHtml(b.buchungsNr || "")}</div>`, escapeHtml(b.konto || "–"), `<strong>${fmtMoney(b.betrag)}</strong><div class="subtle">${escapeHtml(b.art || "")}</div>`, statusBadge(b.status || "Aktiv"), canWrite("Kasse") && !/storniert/i.test(b.status || "") ? `<div class="button-row"><button class="button small ghost" data-edit-booking="${escapeAttr(b.buchungsNr)}">Bearbeiten</button><button class="button small danger" data-cancel-booking="${escapeAttr(b.buchungsNr)}">Stornieren</button></div>` : ""]), "Keine Buchungen gefunden.");
    document.querySelectorAll("[data-edit-booking]").forEach(btn => btn.addEventListener("click", () => openBookingForm(filtered.find(b => b.buchungsNr === btn.dataset.editBooking), data.meta || {})));
    document.querySelectorAll("[data-cancel-booking]").forEach(btn => btn.addEventListener("click", () => cancelBooking(btn.dataset.cancelBooking)));
  };
  render(); document.getElementById("bookingSearch")?.addEventListener("input", render); document.getElementById("newBooking")?.addEventListener("click", () => openBookingForm({}, data.meta || {})); document.getElementById("newTransfer")?.addEventListener("click", openTransferForm); document.getElementById("refreshCashbook")?.addEventListener("click", () => renderCashbook(true));
}
async function openBookingForm(booking = {}, meta = {}) {
  const accounts = await accountData();
  const names = (accounts.accounts || []).filter(a => a.aktiv !== "NEIN").map(a => a.name);
  openDialog({ title: booking.buchungsNr ? "Buchung bearbeiten" : "Freie Buchung", kicker: booking.buchungsNr || "Neue Buchung",
    body: `<form><input type="hidden" name="buchungsNr" value="${escapeAttr(booking.buchungsNr || "")}"><input type="hidden" name="mitglied" value="${escapeAttr(booking.mitglied || "")}"><input type="hidden" name="mitgliedsId" value="${escapeAttr(booking.mitgliedsId || "")}"><input type="hidden" name="beleg" value="${escapeAttr(booking.beleg || "")}"><div class="form-grid"><label>Art<select name="art">${optionList(["Einnahme","Ausgabe"], booking.art || "Einnahme")}</select></label><label>Betrag<input name="betrag" inputmode="decimal" value="${escapeAttr(booking.betrag || "")}" required></label><label>Datum<input type="date" name="datum" value="${escapeAttr(booking.datum || today())}" required></label><label>Konto<select name="konto" required>${optionList(names, booking.konto || "", "Konto auswählen")}</select></label><label>Kategorie<select name="kategorie">${optionList(meta.kategorien || ["Sonstiges"], booking.kategorie || "", "Kategorie auswählen")}</select></label><label class="full">Beschreibung<input name="beschreibung" value="${escapeAttr(booking.beschreibung || "")}"></label><label class="full">Bemerkung<input name="bemerkung" value="${escapeAttr(booking.bemerkung || "")}"></label></div></form>`,
    onSubmit: async data => { await runWrite("Buchung wird gespeichert …", () => call("apiSaveBooking", data)); closeDialog(); phase3State.remove(KEY+"cashbook"); phase3State.remove(KEY+"accounts"); await renderCashbook(true); }
  });
}
async function cancelBooking(no) {
  if (!await confirmAction({ title: "Buchung stornieren", message: `Buchung ${no} wirklich stornieren?`, confirmText: "Stornieren" })) return;
  await runWrite("Storno wird verarbeitet …", () => call("apiCancelBooking", no)); phase3State.remove(KEY+"cashbook"); phase3State.remove(KEY+"accounts"); await renderCashbook(true);
}
async function openTransferForm() {
  const accounts = await accountData(); const names = (accounts.accounts || []).filter(a => a.aktiv !== "NEIN").map(a => a.name);
  openDialog({ title: "Umbuchung", kicker: "Zwischen Konten", body: `<form><div class="form-grid"><label>Von Konto<select name="vonKonto" required>${optionList(names,"","Konto auswählen")}</select></label><label>Nach Konto<select name="nachKonto" required>${optionList(names,"","Konto auswählen")}</select></label><label>Betrag<input name="betrag" inputmode="decimal" required></label><label>Datum<input type="date" name="datum" value="${today()}" required></label><label class="full">Beschreibung<input name="beschreibung"></label><label class="full">Bemerkung<input name="bemerkung"></label></div></form>`, onSubmit: async data => { await runWrite("Umbuchung wird gebucht …", () => call("apiCreateTransfer", data)); closeDialog(); phase3State.remove(KEY+"cashbook"); phase3State.remove(KEY+"accounts"); await renderCashbook(true); } });
}

async function renderAccounts(force = false) {
  const data = await accountData(force); const active = data.accounts || []; const inactive = data.inactive || [];
  const cards = list => list.map(a => `<article class="card entity-card"><div class="entity-head"><div><h3>${escapeHtml(a.name)}</h3><span class="subtle">${escapeHtml(a.id || "")} · ${escapeHtml(a.typ || "")}</span></div>${statusBadge(a.aktiv)}</div><strong style="font-size:1.45rem;color:var(--blue-900)">${fmtMoney(a.saldo)}</strong>${canWrite("Konten") ? `<div class="button-row"><button class="button small ghost" data-edit-account="${escapeAttr(a.id)}">Bearbeiten</button><button class="button small ${a.aktiv === "JA" ? "danger" : "secondary"}" data-toggle-account="${escapeAttr(a.id)}" data-active="${a.aktiv === "JA" ? "false" : "true"}">${a.aktiv === "JA" ? "Deaktivieren" : "Aktivieren"}</button></div>` : ""}</article>`).join("");
  target().innerHTML = `<div class="module-toolbar">${canWrite("Konten") ? '<button id="newAccount" class="button primary">+ Konto</button><button id="recalcAccounts" class="button secondary">Salden aktualisieren</button>' : ""}<button id="refreshAccounts" class="button ghost">Aktualisieren</button></div><div class="grid three">${cards(active) || empty("Keine aktiven Konten.")}</div>${inactive.length ? `<article class="card"><h3>Deaktivierte Konten</h3><div class="grid three" style="margin-top:14px">${cards(inactive)}</div></article>` : ""}`;
  const all = active.concat(inactive); document.querySelectorAll("[data-edit-account]").forEach(btn => btn.addEventListener("click", () => openAccountForm(all.find(a => a.id===btn.dataset.editAccount), data.meta || {}))); document.querySelectorAll("[data-toggle-account]").forEach(btn => btn.addEventListener("click", () => toggleAccount(btn.dataset.toggleAccount, btn.dataset.active === "true"))); document.getElementById("newAccount")?.addEventListener("click", () => openAccountForm({}, data.meta || {})); document.getElementById("recalcAccounts")?.addEventListener("click", recalcAccounts); document.getElementById("refreshAccounts")?.addEventListener("click", () => renderAccounts(true));
}
function openAccountForm(account = {}, meta = {}) {
  openDialog({ title: account.id ? "Konto bearbeiten" : "Konto anlegen", kicker: account.id || "Neues Konto", body: `<form><input type="hidden" name="id" value="${escapeAttr(account.id || "")}"><div class="form-grid"><label>Name<input name="name" value="${escapeAttr(account.name || "")}" required></label><label>Kontotyp<select name="typ">${optionList(meta.kontotypen || ["Kasse","Bank","PayPal","Fond","Bus-Kasse"], account.typ || "")}</select></label><label>Startbestand<input name="startbestand" inputmode="decimal" value="${escapeAttr(account.startbestand || 0)}"></label><label>Aktiv<select name="aktiv">${optionList(["JA","NEIN"], account.aktiv || "JA")}</select></label><label class="full">Bemerkung<input name="bemerkung" value="${escapeAttr(account.bemerkung || "")}"></label></div></form>`, onSubmit: async data => { await runWrite("Konto wird gespeichert …", () => call("apiSaveAccount", data)); closeDialog(); phase3State.remove(KEY+"accounts"); await renderAccounts(true); } });
}
async function toggleAccount(id, active) { await runWrite(active ? "Konto wird aktiviert …" : "Konto wird deaktiviert …", () => call("apiSetAccountActive", id, active)); phase3State.remove(KEY+"accounts"); await renderAccounts(true); }
async function recalcAccounts() { await runWrite("Kontosalden werden neu berechnet …", () => call("apiRecalcAccounts")); phase3State.remove(KEY+"accounts"); await renderAccounts(true); }

async function renderTasks(force = false) {
  let data = phase3State.get(KEY + "tasks"); if (!data || force) data = phase3State.set(KEY + "tasks", await call("apiListFanclubTasks", { status: "alle" }));
  const mine = data.mine || []; const board = data.board || []; const all = [...mine, ...board.filter(b => !mine.some(m => m.row === b.row))];
  target().innerHTML = `<div class="module-toolbar"><input id="taskSearch" class="grow" placeholder="Aufgabe suchen …"><select id="taskStatus"><option value="offen">Offen</option><option value="alle">Alle</option><option value="erledigt">Erledigt</option></select>${canWrite("Aufgaben") ? '<button id="newTask" class="button primary">+ Aufgabe</button>' : ""}<button id="refreshTasks" class="button ghost">Aktualisieren</button></div><div id="taskResults"></div>`;
  const render = () => { const q=normalize(document.getElementById("taskSearch")?.value); const s=document.getElementById("taskStatus")?.value||"offen"; const list=all.filter(t=>(!q||normalize([t.aufgabe,t.team,t.verantwortlich,t.status].join(" ")).includes(q))&&(s==="alle"||(s==="offen"?!t.erledigt:!!t.erledigt))); document.getElementById("taskResults").innerHTML = `<div class="list-grid">${list.map(t => `<article class="card task-card ${normalize(t.prioritaet)==="dringend"?"priority-urgent":normalize(t.prioritaet)==="hoch"?"priority-high":""}"><div class="entity-head"><div><div class="task-title">${escapeHtml(t.aufgabe)}</div><span class="subtle">${escapeHtml(t.team || "Ohne Team")}</span></div>${statusBadge(t.status)}</div><div class="meta-grid"><div class="meta-item"><small>Verantwortlich</small>${escapeHtml(t.verantwortlich || "–")}</div><div class="meta-item"><small>Frist</small>${escapeHtml(fmtDate(t.frist))}</div></div>${t.notiz?`<p>${escapeHtml(t.notiz)}</p>`:""}<div class="button-row">${canWrite("Aufgaben")?`<button class="button small ghost" data-edit-task="${t.row}">Bearbeiten</button>${!t.erledigt?`<button class="button small primary" data-complete-task="${t.row}">Erledigen</button>`:""}`:""}</div></article>`).join("") || empty("Keine Aufgaben gefunden.")}</div>`; document.querySelectorAll("[data-edit-task]").forEach(btn=>btn.addEventListener("click",()=>openTaskForm(all.find(t=>String(t.row)===btn.dataset.editTask), data.meta||{}))); document.querySelectorAll("[data-complete-task]").forEach(btn=>btn.addEventListener("click",()=>completeTask(Number(btn.dataset.completeTask)))); };
  render(); document.getElementById("taskSearch")?.addEventListener("input",render); document.getElementById("taskStatus")?.addEventListener("change",render); document.getElementById("newTask")?.addEventListener("click",()=>openTaskForm({},data.meta||{})); document.getElementById("refreshTasks")?.addEventListener("click",()=>renderTasks(true));
}
function openTaskForm(task = {}, meta = {}) {
  const teams = meta.teamsDetailed || (meta.teams || []).map(name => ({id:name,name}));
  openDialog({ title: task.row ? "Aufgabe bearbeiten" : "Aufgabe anlegen", kicker: task.team || "Vorstandsaufgabe", body: `<form><input type="hidden" name="row" value="${escapeAttr(task.row || "")}"><input type="hidden" name="id" value="${escapeAttr(task.id || "")}"><div class="form-grid"><label class="full">Aufgabe<input name="aufgabe" value="${escapeAttr(task.aufgabe || "")}" required></label><label>Team<select name="teamId" required>${optionList(teams.map(t=>({value:t.id,label:t.name})), task.teamId || "", "Team auswählen")}</select></label><label>Priorität<select name="prioritaet">${optionList(meta.prioritaeten || ["Niedrig","Normal","Hoch","Dringend"], task.prioritaet || "Normal")}</select></label><label>Frist<input type="date" name="frist" value="${escapeAttr(task.frist || "")}"></label><label>Status<select name="status">${optionList(meta.statusListe || ["Offen","In Arbeit","Erledigt"], task.status || "Offen")}</select></label><label class="full">Verantwortlich<input name="verantwortlich" value="${escapeAttr(task.verantwortlichId || task.verantwortlich || "")}" placeholder="Benutzer-ID oder Name"></label><label class="full">Notiz<textarea name="notiz">${escapeHtml(task.notiz || "")}</textarea></label></div></form>`, onSubmit: async data => { await runWrite("Aufgabe wird gespeichert …", () => call("apiSaveTask", data)); closeDialog(); phase3State.remove(KEY+"tasks"); await renderTasks(true); } });
}
async function completeTask(row) { await runWrite("Aufgabe wird erledigt …", () => call("apiCompleteTask", row)); phase3State.remove(KEY+"tasks"); await renderTasks(true); }
