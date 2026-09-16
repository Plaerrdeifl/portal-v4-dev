import { auth } from "../auth.js";
import { CONFIG } from "../config.js";
import { navigate } from "../router.js";

const clean = value => String(value ?? "").trim();

function money(value, currency) {
  const amount = Number.parseFloat(String(value ?? "0"));
  const code = clean(currency).toUpperCase() || "EUR";
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: code
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"} ${code}`;
  }
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function renderOrder(order) {
  const card = document.createElement("article");
  card.className = "pd-shop-order-card";

  const top = document.createElement("div");
  top.className = "pd-shop-order-top";
  const heading = document.createElement("div");
  const number = document.createElement("div");
  number.className = "pd-shop-order-number";
  number.textContent = `Bestellung #${clean(order?.orderNumber) || "–"}`;
  const created = document.createElement("div");
  created.className = "pd-shop-order-date";
  created.textContent = dateLabel(order?.createdAt);
  heading.append(number, created);

  const status = document.createElement("span");
  status.className = "pd-shop-order-status";
  status.textContent = clean(order?.statusLabel) || clean(order?.status) || "Bestellt";
  top.append(heading, status);
  card.append(top);

  const items = document.createElement("ul");
  items.className = "pd-shop-order-items";
  for (const item of Array.isArray(order?.items) ? order.items : []) {
    const row = document.createElement("li");
    row.className = "pd-shop-order-item";
    const main = document.createElement("div");
    const name = document.createElement("div");
    name.className = "pd-shop-order-item-name";
    name.textContent = `${Math.max(0, Number.parseInt(item?.quantity, 10) || 0)} × ${clean(item?.name) || "Artikel"}`;
    const options = document.createElement("div");
    options.className = "pd-shop-order-item-options";
    options.textContent = (Array.isArray(item?.options) ? item.options : [])
      .map(option => [clean(option?.label), clean(option?.value)].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(" · ");
    options.hidden = !options.textContent;
    main.append(name, options);
    const total = document.createElement("span");
    total.textContent = money(item?.lineTotal, order?.currency);
    row.append(main, total);
    items.append(row);
  }
  card.append(items);

  const pickup = document.createElement("div");
  pickup.className = "pd-shop-order-pickup";
  pickup.textContent = clean(order?.fulfillmentLabel) || "Abholung am Fanstand im Icedome";
  card.append(pickup);

  const total = document.createElement("div");
  total.className = "pd-shop-order-total";
  const label = document.createElement("span");
  label.textContent = "Gesamt";
  const value = document.createElement("span");
  value.textContent = money(order?.total, order?.currency);
  total.append(label, value);
  card.append(total);
  return card;
}

export async function hydrateShopOrders(context = {}) {
  const state = auth.current();
  const status = document.getElementById("pdShopOrdersStatus");
  const list = document.getElementById("pdShopOrdersList");
  document.getElementById("pdShopOrdersOpenShop")
    ?.addEventListener("click", () => navigate("shop"));

  const baseUrl = clean(CONFIG.shop?.baseUrl).replace(/\/$/, "");
  const accessToken = clean(state.session?.access_token);
  if (!baseUrl || state.customerClass !== "MEMBER" || !accessToken) {
    if (status) {
      status.className = "notice error";
      status.textContent = "Bestellungen sind nur für aktive Mitglieder verfügbar.";
    }
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/wp-json/plaerrdeifl-shop/v1/orders`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      credentials: "omit",
      cache: "no-store",
      signal: context.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(clean(body?.message) || "Bestellungen konnten nicht geladen werden.");
    }

    const orders = Array.isArray(body?.orders) ? body.orders : [];
    if (list) {
      list.replaceChildren(...orders.map(renderOrder));
      list.hidden = false;
    }
    if (status) {
      if (orders.length) {
        status.hidden = true;
      } else {
        status.className = "notice";
        status.textContent = "Du hast noch keine Shop-Bestellung.";
        status.hidden = false;
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    if (status) {
      status.className = "notice error";
      status.textContent = error?.message || "Bestellungen konnten nicht geladen werden.";
      status.hidden = false;
    }
    if (list) list.hidden = true;
  }
}
