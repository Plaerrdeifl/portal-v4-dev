import { auth } from "../auth.js";
import { escapeAttr, escapeHtml, showToast } from "../ui.js";

export { escapeAttr, escapeHtml, showToast };

export function call(name, ...args) {
  return auth.call(name, ...args);
}

export function canRead(area) { return auth.canReadArea(area); }
export function canWrite(area) { return auth.canWriteArea(area); }
export function canAdmin(area) { return auth.canAdminArea(area); }
export function isAdmin() { return auth.isAdmin(); }
export function currentUser() { return auth.current().user || {}; }
export function portal() { return auth.current().portal || {}; }

export function fmtNumber(value) {
  return new Intl.NumberFormat("de-DE").format(Number(value || 0));
}
export function fmtMoney(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}
export function fmtDate(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value || "–");
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}
export function normalize(value) {
  return String(value || "").toLowerCase().trim().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss");
}
export function yes(value) { return value === true || /^(ja|yes|true|1)$/i.test(String(value || "")); }
export function today() { return new Date().toISOString().slice(0, 10); }
export function safeId(value) { return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_"); }

export function statusBadge(value) {
  const text = String(value || "–");
  const n = normalize(text);
  const type = /(aktiv|bezahlt|erledigt|freigegeben|ok|ja)/.test(n) ? "success" : /(offen|warten|hinweis|pruefen)/.test(n) ? "warning" : /(storniert|abgelehnt|fehler|inaktiv|nein)/.test(n) ? "danger" : "neutral";
  return `<span class="badge ${type}">${escapeHtml(text)}</span>`;
}

export function loading(message = "Daten werden geladen …") {
  return `<div class="loading-panel"><span class="spinner" aria-hidden="true"></span><strong>${escapeHtml(message)}</strong></div>`;
}
export function empty(message = "Keine Einträge vorhanden.") {
  return `<div class="empty-state"><span>ℹ️</span><p>${escapeHtml(message)}</p></div>`;
}
export function errorPanel(error, title = "Daten konnten nicht geladen werden") {
  return `<div class="notice error"><strong>${escapeHtml(title)}</strong><br>${escapeHtml(error?.message || String(error || "Unbekannter Fehler"))}</div>`;
}

export function statCard(label, value, icon = "•", detail = "") {
  return `<article class="card stat-card"><div class="card-icon">${escapeHtml(icon)}</div><h3>${escapeHtml(label)}</h3><strong>${escapeHtml(value)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</article>`;
}

export function tabBar(items, active, scope) {
  return `<div class="module-tabs" role="tablist">${items.map(item => `<button type="button" class="module-tab ${item.id === active ? "active" : ""}" data-module-tab="${escapeAttr(scope)}" data-tab="${escapeAttr(item.id)}">${escapeHtml(item.icon || "")} ${escapeHtml(item.label)}</button>`).join("")}</div>`;
}

export function optionList(items, selected = "", placeholder = "") {
  const rows = [];
  if (placeholder) rows.push(`<option value="">${escapeHtml(placeholder)}</option>`);
  (items || []).forEach(item => {
    const value = typeof item === "object" ? (item.value ?? item.id ?? item.name ?? "") : item;
    const label = typeof item === "object" ? (item.label ?? item.name ?? item.title ?? value) : item;
    rows.push(`<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`);
  });
  return rows.join("");
}

export function formDataObject(form) {
  const result = {};
  new FormData(form).forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = Array.isArray(result[key]) ? result[key].concat(value) : [result[key], value];
    } else result[key] = value;
  });
  form.querySelectorAll('input[type="checkbox"][name]').forEach(input => {
    if (!Object.prototype.hasOwnProperty.call(result, input.name)) result[input.name] = false;
    else if (!Array.isArray(result[input.name])) result[input.name] = input.checked;
  });
  return result;
}

function ensureDialog() {
  let dialog = document.getElementById("appDialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "appDialog";
  dialog.className = "app-dialog";
  dialog.innerHTML = `<div class="dialog-shell"><header><div><span id="dialogKicker" class="dialog-kicker"></span><h2 id="dialogTitle"></h2></div><button type="button" class="icon-button" data-dialog-close aria-label="Schließen">×</button></header><div id="dialogBody" class="dialog-body"></div></div>`;
  document.body.appendChild(dialog);
  dialog.addEventListener("click", event => {
    if (event.target === dialog || event.target.closest("[data-dialog-close]")) closeDialog();
  });
  return dialog;
}

export function openDialog({ title, kicker = "", body = "", wide = false, onSubmit = null, submitLabel = "Speichern", danger = false }) {
  const dialog = ensureDialog();
  dialog.classList.toggle("wide", Boolean(wide));
  document.getElementById("dialogTitle").textContent = title || "Dialog";
  document.getElementById("dialogKicker").textContent = kicker || "";
  const target = document.getElementById("dialogBody");
  target.innerHTML = body;
  const form = target.querySelector("form");
  if (form && onSubmit) {
    if (!form.querySelector("[data-dialog-actions]")) {
      form.insertAdjacentHTML("beforeend", `<div class="dialog-actions" data-dialog-actions><button type="button" class="button ghost" data-dialog-close>Abbrechen</button><button type="submit" class="button ${danger ? "danger" : "primary"}">${escapeHtml(submitLabel)}</button></div>`);
    }
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const old = submit?.textContent || submitLabel;
      if (submit) { submit.disabled = true; submit.textContent = "Wird verarbeitet …"; }
      try {
        await onSubmit(formDataObject(form), form);
      } catch (error) {
        showToast(error?.message || "Aktion fehlgeschlagen.", "error", 6500);
        if (submit) { submit.disabled = false; submit.textContent = old; }
      }
    });
  }
  if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  return dialog;
}

export function closeDialog() {
  const dialog = document.getElementById("appDialog");
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
}

export async function confirmAction({ title, message, confirmText = "Bestätigen", phrase = "", danger = true }) {
  return new Promise(resolve => {
    const phraseField = phrase ? `<label>Zur Bestätigung eingeben: <strong>${escapeHtml(phrase)}</strong><input name="phrase" autocomplete="off" required></label>` : "";
    openDialog({
      title,
      kicker: danger ? "Sicherheitsabfrage" : "Bestätigung",
      danger,
      submitLabel: confirmText,
      body: `<form><div class="notice ${danger ? "error" : "warning"}">${escapeHtml(message)}</div>${phraseField}</form>`,
      onSubmit: async data => {
        if (phrase && String(data.phrase || "").trim() !== phrase) throw new Error("Bestätigungstext stimmt nicht überein.");
        closeDialog();
        resolve(true);
      }
    });
    const dialog = document.getElementById("appDialog");
    dialog?.addEventListener("close", () => resolve(false), { once: true });
  });
}

export function bindFilter(inputId, callback) {
  const input = document.getElementById(inputId);
  input?.addEventListener("input", callback);
  input?.addEventListener("change", callback);
}

export async function runWrite(message, operation, successMessage = "Änderung gespeichert.") {
  showToast(message, "info", 1800);
  const result = await operation();
  const text = result?.message || successMessage;
  showToast(text, "success", 4600);
  return result;
}
