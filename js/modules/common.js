import { api } from "../api.js";
import { auth } from "../auth.js";
import { escapeAttr, escapeHtml, showToast } from "../ui.js";

export { escapeAttr, escapeHtml, showToast };

let dialogReturnFocus = null;

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
    const label = typeof item === "object"
      ? item.label ?? item.name ?? item.value ?? item.id
      : item;

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
    : ["PENDING", "IN_PROGRESS"].includes(normalized)
      ? "warning"
      : ["BLOCKED", "REJECTED"].includes(normalized)
        ? "danger"
        : "neutral";

  return `<span class="badge ${type}">${escapeHtml(value || "–")}</span>`;
}

function blurDialogFocus(dialog) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && dialog.contains(active)) active.blur();
}

function closeDialog(dialog) {
  blurDialogFocus(dialog);
  if (dialog.open) dialog.close();
}

function ensureDialog() {
  let dialog = document.getElementById("v4Dialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "v4Dialog";
  dialog.className = "v4-dialog";
  dialog.setAttribute("aria-labelledby", "v4DialogTitle");
  dialog.innerHTML = '<div class="v4-dialog-shell"><header><div><span id="v4DialogKicker" class="subtle"></span><h2 id="v4DialogTitle"></h2></div><button type="button" class="icon-button" data-v4-dialog-close aria-label="Schließen">×</button></header><div id="v4DialogBody"></div></div>';
  document.body.appendChild(dialog);

  dialog.addEventListener("click", event => {
    if (event.target === dialog || event.target.closest("[data-v4-dialog-close]")) {
      closeDialog(dialog);
    }
  });

  dialog.addEventListener("close", () => {
    blurDialogFocus(dialog);
    const returnTarget = dialogReturnFocus;
    dialogReturnFocus = null;

    if (returnTarget instanceof HTMLElement && returnTarget.isConnected) {
      returnTarget.focus({ preventScroll: true });
    }
  });

  return dialog;
}

function validationNode(field) {
  const next = field.nextElementSibling;

  if (next?.classList.contains("field-error")) {
    return next;
  }

  const node = document.createElement("small");
  node.className = "field-error";
  node.setAttribute("aria-live", "polite");
  field.insertAdjacentElement("afterend", node);
  return node;
}

function showFieldValidation(field) {
  if (!(field instanceof HTMLInputElement)
      && !(field instanceof HTMLSelectElement)
      && !(field instanceof HTMLTextAreaElement)) {
    return;
  }

  const node = validationNode(field);
  node.textContent = field.validity.valid ? "" : field.validationMessage;
  field.setAttribute("aria-invalid", field.validity.valid ? "false" : "true");
}

function bindInlineValidation(form) {
  if (!form || form.dataset.inlineValidationBound === "true") return;
  form.dataset.inlineValidationBound = "true";

  form.addEventListener("invalid", event => {
    showFieldValidation(event.target);
  }, true);

  form.addEventListener("input", event => {
    showFieldValidation(event.target);
  });

  form.addEventListener("change", event => {
    showFieldValidation(event.target);
  });
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

  dialogReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  document.getElementById("v4DialogTitle").textContent = title || "Dialog";
  document.getElementById("v4DialogKicker").textContent = kicker || "";

  const bodyNode = document.getElementById("v4DialogBody");
  bodyNode.innerHTML = `${body || ""}${onSubmit ? `<div class="dialog-actions"><button class="button ghost" type="button" data-v4-dialog-close>Abbrechen</button><button id="v4DialogSubmit" class="button ${danger ? "danger" : "primary"}" type="button">${escapeHtml(submitLabel)}</button></div>` : ""}`;

  const form = bodyNode.querySelector("form");
  bindInlineValidation(form);

  if (onSubmit) {
    document.getElementById("v4DialogSubmit")?.addEventListener("click", async () => {
      if (form && !form.checkValidity()) {
        form.querySelector(":invalid")?.focus({ preventScroll: true });
        form.reportValidity();
        return;
      }

      const button = document.getElementById("v4DialogSubmit");
      button.disabled = true;
      const original = button.textContent;
      button.textContent = "Wird ausgeführt …";

      try {
        await onSubmit(form ? formDataObject(form) : {});
        closeDialog(dialog);
      } catch (error) {
        showToast(error?.message || "Aktion fehlgeschlagen.", "error", 5200);
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  if (!dialog.open) dialog.showModal();

  requestAnimationFrame(() => {
    bodyNode
      .querySelector("input:not([type=hidden]),select,textarea,button")
      ?.focus({ preventScroll: true });
  });

  return dialog;
}

export function confirmAction(message, options = {}) {
  const destructive = options.danger ?? (
    /(löschen|entfernen|stornieren|archivieren|ablehnen)/i
      .test(String(message || ""))
  );

  const title = options.title || (
    destructive ? "Aktion bestätigen" : "Bitte bestätigen"
  );

  const submitLabel = options.submitLabel || (
    destructive ? "Trotzdem fortfahren" : "Bestätigen"
  );

  return new Promise(resolve => {
    let settled = false;

    const dialog = openDialog({
      title,
      kicker: "Bestätigung",
      danger: destructive,
      submitLabel,
      body: `<div class="v4-confirm-copy"><p>${escapeHtml(message)}</p></div>`,
      onSubmit: async () => {
        settled = true;
        resolve(true);
      }
    });

    dialog.addEventListener("close", () => {
      if (!settled) resolve(false);
    }, { once: true });
  });
}

export async function runWrite(operation, successMessage = "Änderung gespeichert.") {
  const result = await operation();
  showToast(successMessage, "success", 3800);
  return result;
}
