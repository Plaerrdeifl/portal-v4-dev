import { api } from "../api.js";
import { auth } from "../auth.js";
import { escapeAttr, escapeHtml, showToast } from "../ui.js";
import { platformMode } from "../platform-mode.js";

export { escapeAttr, escapeHtml, showToast };

let dialogReturnFocus = null;
let dialogContextSequence = 0;
const dialogContexts = [];

export function call(action, payload = {}) {
  return api.call(action, payload);
}

export function importIcs(action, file, sourceKey, previewFingerprint = "") {
  return api.importIcs(action, file, sourceKey, previewFingerprint);
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

function dialogBody() {
  return document.getElementById("v4DialogBody");
}

function dispatchDialogContextClose(dialog, contextId) {
  dialog.dispatchEvent(new CustomEvent("v4dialogclose", {
    detail: { contextId }
  }));
}

function saveDialogContext(dialog) {
  const body = dialogBody();
  if (!body) return;

  const active = document.activeElement;
  const focus = active instanceof HTMLElement && body.contains(active) ? active : null;
  const scrollTop = body.scrollTop;
  const content = document.createDocumentFragment();
  while (body.firstChild) content.appendChild(body.firstChild);

  dialogContexts.push({
    contextId: dialog.dataset.v4DialogContext || "",
    title: document.getElementById("v4DialogTitle")?.textContent || "Dialog",
    kicker: document.getElementById("v4DialogKicker")?.textContent || "",
    content,
    focus,
    scrollTop
  });
}

function restoreDialogContext(dialog) {
  const previous = dialogContexts.pop();
  const body = dialogBody();
  if (!previous || !body) return false;

  document.getElementById("v4DialogTitle").textContent = previous.title;
  document.getElementById("v4DialogKicker").textContent = previous.kicker;
  body.replaceChildren(previous.content);
  dialog.dataset.v4DialogContext = previous.contextId;

  requestAnimationFrame(() => {
    body.scrollTop = previous.scrollTop;
    const focusTarget = previous.focus instanceof HTMLElement
      && previous.focus.isConnected
      ? previous.focus
      : body.querySelector("input:not([type=hidden]),select,textarea,button,a[href]");
    focusTarget?.focus({ preventScroll: true });
  });
  return true;
}

function closeDialog(dialog, returnValue = "", { restoreParent = true } = {}) {
  blurDialogFocus(dialog);
  if (!dialog.open) return;

  const contextId = dialog.dataset.v4DialogContext || "";
  dispatchDialogContextClose(dialog, contextId);
  if (!restoreParent && dialogContexts.length) {
    dialogContexts.length = 0;
    dialog._v4NativeClose(returnValue);
    return;
  }
  if (restoreDialogContext(dialog)) return;

  dialog._v4NativeClose(returnValue);
}

export function closeAllDialogs() {
  const dialog = document.getElementById("v4Dialog");
  if (!dialog?.open) return;
  dialogContexts.length = 0;
  closeDialog(dialog);
}

export function afterDialogContextClose(dialog, callback) {
  const contextId = dialog?.dataset?.v4DialogContext;
  if (!contextId || typeof callback !== "function") return () => {};

  const handleClose = event => {
    if (event.detail?.contextId !== contextId) return;
    dialog.removeEventListener("v4dialogclose", handleClose);
    setTimeout(() => callback(), 0);
  };
  dialog.addEventListener("v4dialogclose", handleClose);
  return () => dialog.removeEventListener("v4dialogclose", handleClose);
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

  dialog._v4NativeClose = dialog.close.bind(dialog);
  dialog.close = returnValue => closeDialog(dialog, returnValue);

  dialog.addEventListener("click", event => {
    if (event.target === dialog || event.target.closest("[data-v4-dialog-close]")) {
      closeDialog(dialog);
    }
  });

  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeDialog(dialog);
  });

  window.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !dialog.open) return;
    event.preventDefault();
    closeDialog(dialog);
  });

  dialog.addEventListener("close", () => {
    blurDialogFocus(dialog);
    dialogContexts.length = 0;
    window.dispatchEvent(new CustomEvent("v4-dialog-modal-state", {
      detail: { open: false }
    }));
    const returnTarget = dialogReturnFocus;
    dialogReturnFocus = null;

    if (returnTarget instanceof HTMLElement && returnTarget.isConnected) {
      returnTarget.focus({ preventScroll: true });
    }
  });

  window.addEventListener("hashchange", () => {
    if (dialog.open) closeAllDialogs();
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

const DIALOG_ALLOWED_ELEMENTS = new Set([
  "A", "ARTICLE", "ASIDE", "B", "BR", "BUTTON", "CODE", "DD", "DETAILS",
  "DIV", "DL", "DT", "EM", "FIELDSET", "FOOTER", "FORM", "H2", "H3", "H4",
  "HEADER", "HR", "I", "INPUT", "LABEL", "LEGEND", "LI", "NAV", "OL",
  "OPTION", "OUTPUT", "P", "SECTION", "SELECT", "SMALL", "SPAN", "STRONG", "SUMMARY", "TABLE",
  "TBODY", "TD", "TEXTAREA", "TH", "THEAD", "TIME", "TR", "UL"
]);

const DIALOG_ALLOWED_ATTRIBUTES = new Set([
  "accept", "autocomplete", "autofocus", "checked", "class", "cols",
  "colspan", "disabled", "download", "for", "hidden", "href", "id",
  "inputmode", "max", "maxlength", "method", "min", "minlength", "multiple",
  "name", "novalidate", "open", "pattern", "placeholder", "readonly", "rel",
  "required", "role", "rows", "rowspan", "scope", "selected", "step",
  "tabindex", "target", "title", "type", "value"
]);

function safeDialogHref(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw.startsWith("#") || raw.startsWith("./")) return true;
  if (raw.startsWith("/") && !raw.startsWith("//")) return true;
  if (/^tel:\+?[0-9 ()/-]{3,40}$/u.test(raw)) return true;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function safeDialogFragment(markup) {
  const template = document.createElement("template");
  template.innerHTML = String(markup || "");

  for (const element of template.content.querySelectorAll("*")) {
    if (!DIALOG_ALLOWED_ELEMENTS.has(element.tagName)) {
      throw new TypeError(`DIALOG_UNSAFE_ELEMENT:${element.tagName}`);
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const allowed = DIALOG_ALLOWED_ATTRIBUTES.has(name)
        || name.startsWith("aria-")
        || name.startsWith("data-");
      if (!allowed || name.startsWith("on") || name === "style") {
        throw new TypeError(`DIALOG_UNSAFE_ATTRIBUTE:${name}`);
      }
    }

    if (element.hasAttribute("href") && !safeDialogHref(element.getAttribute("href"))) {
      throw new TypeError("DIALOG_UNSAFE_URL");
    }

    if (element.hasAttribute("target")) {
      const rel = new Set(
        String(element.getAttribute("rel") || "").toLowerCase().split(/\s+/).filter(Boolean)
      );
      if (
        element.tagName !== "A"
        || element.getAttribute("target") !== "_blank"
        || !rel.has("noopener")
        || !rel.has("noreferrer")
      ) {
        throw new TypeError("DIALOG_UNSAFE_EXTERNAL_LINK");
      }
    }
  }

  return template.content;
}

function appendDialogActions(bodyNode, { submitLabel, danger }) {
  const actions = document.createElement("div");
  actions.className = "dialog-actions";

  const cancel = document.createElement("button");
  cancel.className = "button ghost";
  cancel.type = "button";
  cancel.dataset.v4DialogClose = "";
  cancel.textContent = "Abbrechen";

  const submit = document.createElement("button");
  submit.id = "v4DialogSubmit";
  submit.className = `button ${danger ? "danger" : "primary"}`;
  submit.type = "button";
  submit.textContent = String(submitLabel || "Speichern");

  actions.append(cancel, submit);
  bodyNode.append(actions);
}

export function openDialog({
  title,
  kicker = "",
  body,
  submitLabel = "Speichern",
  onSubmit = null,
  danger = false,
  preserveParentOnSubmit = false
}) {
  const dialog = ensureDialog();

  if (dialog.open) saveDialogContext(dialog);

  if (!dialog.open) {
    dialogReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  }

  const contextId = String(++dialogContextSequence);
  dialog.dataset.v4DialogContext = contextId;

  document.getElementById("v4DialogTitle").textContent = title || "Dialog";
  document.getElementById("v4DialogKicker").textContent = kicker || "";

  const bodyNode = document.getElementById("v4DialogBody");
  bodyNode.replaceChildren(safeDialogFragment(body));
  if (onSubmit) appendDialogActions(bodyNode, { submitLabel, danger });

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
        closeDialog(dialog, "", { restoreParent: preserveParentOnSubmit });
      } catch (error) {
        showToast(error?.message || "Aktion fehlgeschlagen.", "error", 5200);
        button.disabled = false;
        button.textContent = original;
      }
    });
  }

  if (!dialog.open) {
    dialog.showModal();
    window.dispatchEvent(new CustomEvent("v4-dialog-modal-state", {
      detail: { open: true }
    }));
  }

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
      preserveParentOnSubmit: true,
      body: `<div class="v4-confirm-copy"><p>${escapeHtml(message)}</p></div>`,
      onSubmit: async () => {
        settled = true;
        resolve(true);
      }
    });

    const contextId = dialog.dataset.v4DialogContext;
    const handleClose = event => {
      if (event.type === "v4dialogclose" && event.detail?.contextId !== contextId) return;
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("v4dialogclose", handleClose);
      if (!settled) resolve(false);
    };
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("v4dialogclose", handleClose);
  });
}

export async function runWrite(operation, successMessage = "Änderung gespeichert.") {
  try {
    platformMode.assertUserWriteAllowed();
  } catch (error) {
    showToast(error?.message || "Schreibaktionen sind aktuell nicht verfügbar.", "warning", 6000);
    throw error;
  }
  const result = await operation();
  showToast(successMessage, "success", 3800);
  return result;
}
