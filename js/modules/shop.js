import { auth } from "../auth.js";
import { CONFIG } from "../config.js";
import { showToast } from "../ui.js";

function bridgeAction() {
  return `${CONFIG.shop.baseUrl.replace(/\/$/, "")}/?pd_shop_bridge=1`;
}

function submitBridge(accessToken, target) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = bridgeAction();
  form.target = target;
  form.hidden = true;

  const token = document.createElement("input");
  token.type = "hidden";
  token.name = "access_token";
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

  if (state.customerClass !== "MEMBER" || !accessToken) {
    if (status) {
      status.className = "notice error";
      status.textContent = "Der Shop ist nur für aktive Mitglieder verfügbar.";
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
