import { api } from "../api.js";
import { auth } from "../auth.js";
import { escapeAttr, escapeHtml, showToast } from "../ui.js";

export { escapeAttr, escapeHtml, showToast };

export function call(action, payload = {}) {
  return api.call(action, payload);
}

export function currentUser() {
  return auth.current().user || {};
}

export function hasCapability(code) {
  return auth.hasCapability(code);
}

export function loading(message = "Daten werden geladen …") {
  return `<article class="card loading-card"><h3>${escapeHtml(message)}</h3></article>`;
}

export function empty(message = "Keine Einträge vorhanden.") {
  return `<article class="card empty-card"><p>${escapeHtml(message)}</p></article>`;
}

export function errorPanel(error, title = "Daten konnten nicht geladen werden") {
  return `<article class="card notice error"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(error?.message || String(error || "Unbekannter Fehler"))}</p></article>`;
}

export function fmtDate(value) {
  if (!value) return "–";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}

export function fmtDateTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(date);
}

export function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function optionList(items, selected = "", placeholder = "") {
  const options = [];
  if (placeholder) {
    options.push(`<option value="">${escapeHtml(placeholder)}</option>`);
  }
  for (const item of items || []) {
    const value = typeof item === "object" ? item.value ?? item.id : item;
    const label = typeof item === "object" ? item.label ?? item.name ?? item.value ?? item.id : item;
    options.push(
      `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`
    );
  }
  return options.join("");
}

export function statusBadge(value) {
  const normalized = String(value || "").toUpperCase();
  const type = ["ACTIVE", "APPROVED", "DONE"].includes(normalized)
    ? "success"
    : ["PENDING", "WAITING", "IN_PROGRESS"].includes(normalized)
      ? "warning"
      : ["BLOCKED", "REJECTED"].includes(normalized)
        ? "danger"
        : "neutral";
  return `<span class="badge ${type}">${escapeHtml(value || "–")}</span>`;
}

function ensureDialog() {
  let dialog = document.getElementById("v4Dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "v4Dialog";
  dialog.className = "v4-dialog";
  dialog.innerHTML = '<div class="v4-dialog-shell"><header><div><span id="v4DialogKicker" class="subtle"></span><h2 id="v4DialogTitle"></h2></div><button type="button" class="icon-button" data-v4-dialog-close aria-label="Schließen">×</button></header><div id="v4DialogBody"></div></div>';
  document.body.appendChild(dialog);
  dialog.addEventListener("click", event => {
    if (event.target === dialog || event.target.closest("[data-v4-dialog-close]")) {
      dialog.close();
    }
  });
  return dialog;
}

export function openDialog({
  title,
  kicker = "",
  body,
  submitLabel = "Speichern",
  onSubmit = null,
  danger = false
}) {
  const dialog = ensureDialog();
  document.getElementById("v4DialogTitle").textContent = title || "Dialog";
  document.getElementById("v4DialogKicker").textContent = kicker || "";
  const bodyNode = document.getElementById("v4DialogBody");
  bodyNode.innerHTML = `${body || ""}${onSubmit ? `<div class="dialog-actions"><button class="button ghost" type="button" data-v4-dialog-close>Abbrechen</button><button id="v4DialogSubmit" class="button ${danger ? "danger" : "primary"}" type="button">${escapeHtml(submitLabel)}</button></div>` : ""}`;
  if (onSubmit) {
    document.getElementById("v4DialogSubmit")?.addEventListener("click", async () => {
      const form = bodyNode.querySelector("form");
      if (form && !form.reportValidity()) return;
      const button = document.getElementById("v4DialogSubmit");
      button.disabled = true;
      const original = button.textContent;
      button.textContent = "Wird gespeichert …";
      try {
        await onSubmit(form ? formDataObject(form) : {});
        dialog.close();
      } catch (error) {
        showToast(error?.message || "Speichern fehlgeschlagen.", "error", 6500);
        button.disabled = false;
        button.textContent = original;
      }
    });
  }
  if (!dialog.open) dialog.showModal();
  return dialog;
}

export async function confirmAction(message) {
  return window.confirm(message);
}

export async function runWrite(operation, successMessage = "Änderung gespeichert.") {
  const result = await operation();
  showToast(successMessage, "success", 4200);
  return result;
}
