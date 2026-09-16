import { auth } from "../auth.js";
import { CONFIG } from "../config.js";
import { showToast } from "../ui.js";

function bridgeAction() {
  const baseUrl = String(CONFIG.shop?.baseUrl || "").trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("Shop ist in dieser Umgebung nicht konfiguriert.");
  return `${baseUrl}/?pd_shop_bridge=1`;
}

function submitBridge(accessToken, target) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = bridgeAction();
  form.target = target;
  form.hidden = true;

  const token = document.createElement("input");
  token.type = "hidden";
  token.name = "pd_shop_access_token";
  token.value = accessToken;
  form.append(token);
  document.body.append(form);
  form.submit();

  token.value = "";
  window.setTimeout(() => form.remove(), 0);
}

export async function hydrateShop() {
  const state = auth.current();
  const status = document.getElementById("pdShopBridgeStatus");
  const frame = document.getElementById("pdShopFrame");
  const external = document.getElementById("pdShopOpenExternal");
  const accessToken = String(state.session?.access_token || "").trim();

  if (!CONFIG.shop?.baseUrl) {
    if (status) {
      status.className = "notice error";
      status.textContent = "Der Shop ist in dieser Umgebung noch nicht freigeschaltet.";
    }
    if (external) external.hidden = true;
    return;
  }

  const canUseShop = state.customerClass === "MEMBER" || auth.isAdmin();
  if (!canUseShop || !accessToken) {
    if (status) {
      status.className = "notice error";
      status.textContent = "Der Shop ist nur für aktive Mitglieder und Administratoren verfügbar.";
    }
    if (external) external.hidden = true;
    return;
  }

  let submitted = false;
  if (frame) {
    frame.addEventListener("load", () => {
      if (!submitted) return;
      frame.hidden = false;
      if (status) status.hidden = true;
    }, { once: true });
  }

  if (external) {
    external.addEventListener("click", () => {
      try {
        submitBridge(accessToken, "_blank");
      } catch (error) {
        showToast(error?.message || "Shop konnte nicht geöffnet werden.", "error", 6000);
      }
    });
  }

  submitted = true;
  submitBridge(accessToken, frame?.name || "pdShopFrame");
}
