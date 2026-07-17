(() => {
  "use strict";

  const DESKTOP = "(min-width: 861px)";
  let accountMenu = null;
  let scrollBar = null;
  let scrollInner = null;
  let scrollTarget = null;
  let syncTimer = 0;
  let targetScrollHandler = null;

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const visible = element => Boolean(element && !element.hidden && element.getClientRects().length);

  function text(id, fallback = "") {
    return clean(document.getElementById(id)?.textContent || fallback);
  }

  function accountTrigger() {
    return document.getElementById("userSummary");
  }

  function closeAccountMenu() {
    const trigger = accountTrigger();
    if (accountMenu) accountMenu.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function ensureAccountMenu() {
    const actions = document.querySelector(".topbar-actions");
    const trigger = accountTrigger();
    if (!actions || !trigger) return null;

    trigger.classList.add("corr4-account-trigger");
    trigger.setAttribute("role", "button");
    trigger.setAttribute("tabindex", "0");
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-controls", "corr4AccountMenu");
    if (!trigger.hasAttribute("aria-expanded")) trigger.setAttribute("aria-expanded", "false");

    accountMenu = document.getElementById("corr4AccountMenu");
    if (!accountMenu) {
      accountMenu = document.createElement("div");
      accountMenu.id = "corr4AccountMenu";
      accountMenu.className = "corr4-account-menu";
      accountMenu.setAttribute("role", "menu");
      accountMenu.hidden = true;
      actions.appendChild(accountMenu);
    }
    return accountMenu;
  }

  function renderAccountMenu() {
    const menu = ensureAccountMenu();
    const trigger = accountTrigger();
    if (!menu || !trigger || !visible(trigger)) {
      closeAccountMenu();
      return;
    }

    const avatar = text("userAvatar", "PD");
    const name = text("userSummaryName", "Portalbenutzer");
    const role = text("userSummaryRole", "Portaluser");
    const connection = text("connectionStatus", "Sicher verbunden");
    const version = text("buildLabel", "R7.1 · Milestone 4");
    const warning = /prüf|wieder|unterbrochen|offline|warn/i.test(connection);
    const signature = JSON.stringify({ avatar, name, role, connection, version, warning });
    if (menu.dataset.signature === signature) return;
    menu.dataset.signature = signature;
    menu.innerHTML = `<div class="corr4-account-head"><span class="corr4-account-avatar" aria-hidden="true">${avatar.replace(/[<>&"']/g, "") || "PD"}</span><span class="corr4-account-copy"><strong>${name.replace(/[<>&"']/g, "")}</strong><span>${role.replace(/[<>&"']/g, "")}</span></span></div><div class="corr4-account-status ${warning ? "warning" : ""}"><i aria-hidden="true"></i><span>${connection.replace(/[<>&"']/g, "")}</span></div><div class="corr4-account-actions"><button id="corr4AccountRefresh" class="corr4-account-action" type="button" role="menuitem">Ansicht aktualisieren</button><button id="corr4AccountLogout" class="corr4-account-action danger" type="button" role="menuitem">Abmelden</button></div><div class="corr4-account-version">${version.replace(/[<>&"']/g, "")} · Rollen und Rechte werden weiterhin serverseitig geprüft.</div>`;
  }

  function toggleAccountMenu() {
    const menu = ensureAccountMenu();
    const trigger = accountTrigger();
    if (!menu || !trigger) return;
    renderAccountMenu();
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) window.setTimeout(() => menu.querySelector("button")?.focus(), 0);
  }

  function ensureScrollBar() {
    if (scrollBar) return scrollBar;
    scrollBar = document.createElement("div");
    scrollBar.id = "corr4HorizontalScrollbar";
    scrollBar.className = "corr4-horizontal-scrollbar";
    scrollBar.setAttribute("aria-label", "Horizontaler Seiteninhalt");
    scrollBar.hidden = true;
    scrollInner = document.createElement("div");
    scrollBar.appendChild(scrollInner);
    document.body.appendChild(scrollBar);
    scrollBar.addEventListener("scroll", () => {
      if (scrollTarget && Math.abs(scrollTarget.scrollLeft - scrollBar.scrollLeft) > 1) scrollTarget.scrollLeft = scrollBar.scrollLeft;
    }, { passive: true });
    return scrollBar;
  }

  function isDesktopRoute() {
    const route = String(document.documentElement.dataset.route || "");
    return window.matchMedia(DESKTOP).matches && !["login", "profile", "home"].includes(route);
  }

  function scrollCandidates() {
    const selectors = ["#view", ".data-table-wrap", ".module-tabs", ".p2-module-tabs", ".p3-module-tabs"];
    return Array.from(document.querySelectorAll(selectors.join(","))).filter((element, index, all) => all.indexOf(element) === index && visible(element));
  }

  function selectScrollTarget() {
    if (!isDesktopRoute()) return null;
    const candidates = scrollCandidates().filter(element => element.scrollWidth > element.clientWidth + 3);
    if (!candidates.length) return null;
    const inViewport = candidates.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    const pool = inViewport.length ? inViewport : candidates;
    return pool.sort((a, b) => (b.scrollWidth - b.clientWidth) - (a.scrollWidth - a.clientWidth))[0] || null;
  }

  function detachScrollTarget() {
    if (scrollTarget && targetScrollHandler) scrollTarget.removeEventListener("scroll", targetScrollHandler);
    if (scrollTarget) scrollTarget.classList.remove("corr4-scroll-target");
    scrollTarget = null;
    targetScrollHandler = null;
  }

  function syncScrollBar() {
    const bar = ensureScrollBar();
    const target = selectScrollTarget();
    if (!target) {
      detachScrollTarget();
      bar.hidden = true;
      document.body.classList.remove("corr4-scrollbar-visible");
      return;
    }

    if (scrollTarget !== target) {
      detachScrollTarget();
      scrollTarget = target;
      scrollTarget.classList.add("corr4-scroll-target");
      targetScrollHandler = () => {
        if (scrollBar && Math.abs(scrollBar.scrollLeft - scrollTarget.scrollLeft) > 1) scrollBar.scrollLeft = scrollTarget.scrollLeft;
      };
      scrollTarget.addEventListener("scroll", targetScrollHandler, { passive: true });
    }

    const sidebar = document.getElementById("sidebar");
    const left = sidebar && visible(sidebar) ? Math.max(0, Math.round(sidebar.getBoundingClientRect().right)) : 0;
    bar.style.left = `${left}px`;
    scrollInner.style.width = `${Math.max(target.scrollWidth, target.clientWidth)}px`;
    bar.hidden = false;
    bar.scrollLeft = target.scrollLeft;
    document.body.classList.add("corr4-scrollbar-visible");
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      renderAccountMenu();
      syncScrollBar();
    }, 45);
  }

  function handleClick(event) {
    const trigger = event.target.closest("#userSummary");
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      toggleAccountMenu();
      return;
    }
    if (event.target.closest("#corr4AccountRefresh")) {
      event.preventDefault();
      closeAccountMenu();
      document.getElementById("refreshButton")?.click();
      return;
    }
    if (event.target.closest("#corr4AccountLogout")) {
      event.preventDefault();
      closeAccountMenu();
      document.getElementById("logoutButton")?.click();
      return;
    }
    if (accountMenu && !accountMenu.hidden && !event.target.closest("#corr4AccountMenu")) closeAccountMenu();
  }

  function handleKeydown(event) {
    const trigger = event.target.closest?.("#userSummary");
    if (trigger && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      toggleAccountMenu();
      return;
    }
    if (event.key === "Escape") closeAccountMenu();
  }

  function start() {
    ensureAccountMenu();
    ensureScrollBar();
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("hashchange", scheduleSync);
    window.addEventListener("pd-auth-change", scheduleSync, true);
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "data-route", "aria-busy"] });
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(scheduleSync);
      resizeObserver.observe(document.documentElement);
      resizeObserver.observe(document.body);
    }
    scheduleSync();
  }

  document.addEventListener("DOMContentLoaded", start, { once: true });
  if (document.readyState !== "loading") start();
})();
