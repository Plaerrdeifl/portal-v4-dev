import {
  call,
  errorPanel,
  escapeAttr,
  escapeHtml,
  openDialog,
  showToast
} from "./common.js";
import { navigate } from "../router.js";

const MONEY = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

const TASK_STATUS = {
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  WAITING: "Wartet"
};

const TASK_PRIORITY = {
  URGENT: "Eilt",
  HIGH: "Hoch",
  NORMAL: "Normal",
  LOW: "Niedrig"
};

const CONTRIBUTION_STATUS = {
  NO_SEASON: { label: "Keine Saison", type: "neutral" },
  NOT_ASSIGNED: { label: "Nicht zugeordnet", type: "warning" },
  EXEMPT: { label: "Befreit", type: "success" },
  OPEN: { label: "Offen", type: "danger" },
  PARTIAL: { label: "Teilbezahlt", type: "warning" },
  PENDING: { label: "In Prüfung", type: "warning" },
  PAID: { label: "Bezahlt", type: "success" }
};

const SIZE_LABELS = {
  small: "S · sehr kompakt",
  compact: "Kompakt",
  standard: "Standard",
  wide: "Breit"
};

const ALL_SIZES = ["small", "compact", "standard", "wide"];
const SMALL_METRIC_ROW_KEYS = ["member_count", "open_contributions", "finance"];
const SMALL_TITLES = {
  member_count: "Mitglieder",
  open_contributions: "Offen",
  finance: "Kassen"
};

const WIDGET_CATALOG = [
  {
    key: "member_count",
    title: "Aktive Mitglieder",
    shortTitle: "Mitglieder",
    icon: "👥",
    defaultSize: "compact",
    allowSmall: true
  },
  {
    key: "contribution",
    title: "Dein Beitragsstatus",
    shortTitle: "Beitrag",
    icon: "💳",
    defaultSize: "compact"
  },
  {
    key: "open_contributions",
    title: "Offene Beiträge",
    shortTitle: "Offene Beiträge",
    icon: "📌",
    defaultSize: "compact",
    allowSmall: true
  },
  {
    key: "birthdays",
    title: "Nächste Geburtstage",
    shortTitle: "Geburtstage",
    icon: "🎂",
    defaultSize: "compact"
  },
  {
    key: "own_tasks",
    title: "Deine Aufgaben",
    shortTitle: "Eigene Aufgaben",
    icon: "✅",
    defaultSize: "standard"
  },
  {
    key: "team_tasks",
    title: "Teamaufgaben",
    shortTitle: "Teamaufgaben",
    icon: "🤝",
    defaultSize: "standard"
  },
  {
    key: "finance",
    title: "Fanclub-Kassen",
    shortTitle: "Kassen",
    icon: "💶",
    defaultSize: "standard",
    allowSmall: true
  },
  {
    key: "board_tasks",
    title: "Vorstandsaufgaben",
    shortTitle: "Vorstand",
    icon: "🏒",
    defaultSize: "wide"
  }
].map((widget, index) => ({
  ...widget,
  defaultPosition: index,
  allowedSizes: widget.allowSmall
    ? ALL_SIZES
    : ALL_SIZES.filter(size => size !== "small")
}));

const CATALOG_BY_KEY = new Map(
  WIDGET_CATALOG.map(widget => [widget.key, widget])
);

let dashboardState = {
  data: null,
  available: [],
  layout: [],
  rawSavedWidgets: [],
  preferencesSaved: false
};

function money(value) {
  return MONEY.format(Number(value || 0));
}

function dateOnly(value) {
  if (!value) return "–";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function detailRow(label, value) {
  return `<div class="v4-dashboard-detail-row">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function sizeClass(size) {
  return ALL_SIZES.includes(size) ? size : "standard";
}

function card({
  key,
  icon,
  title,
  shortTitle = title,
  description = "",
  size = "standard",
  body = "",
  className = "",
  targetRoute = "",
  targetTab = ""
}) {
  const normalizedSize = sizeClass(size);
  const visibleTitle = normalizedSize === "small"
    ? SMALL_TITLES[key] || shortTitle
    : normalizedSize === "compact"
      ? shortTitle
      : title;

  return `<article
    class="card dashboard-widget widget-size-${escapeAttr(normalizedSize)} ${escapeAttr(className)}${targetRoute ? " is-clickable" : ""}"
    data-dashboard-widget="${escapeAttr(key)}"
    data-widget-size="${escapeAttr(normalizedSize)}"
    ${targetRoute ? `data-dashboard-route="${escapeAttr(targetRoute)}"${targetTab ? ` data-dashboard-tab="${escapeAttr(targetTab)}"` : ""} tabindex="0" role="button" aria-label="${escapeAttr(`${visibleTitle} öffnen`)}"` : ""}
  >
    <div class="v4-dashboard-card-layout">
      <div class="v4-dashboard-card-meta">
        <span class="dashboard-widget-icon" aria-hidden="true">${icon}</span>
        <div class="v4-dashboard-card-copy">
          <h3>${escapeHtml(visibleTitle)}</h3>
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        </div>
      </div>
      <div class="v4-dashboard-card-content">
        ${body}
      </div>
      ${targetRoute ? '<span class="v4-dashboard-card-chevron" aria-hidden="true">›</span>' : ""}
    </div>
  </article>`;
}

function contributionCard(definition, contribution, size) {
  const status = CONTRIBUTION_STATUS[contribution?.status]
    || CONTRIBUTION_STATUS.NOT_ASSIGNED;
  const normalizedSize = sizeClass(size);
  const rows = [];

  if (normalizedSize !== "compact" && contribution?.className) {
    rows.push(detailRow("Klasse", contribution.className));
  }

  if (!["NO_SEASON", "NOT_ASSIGNED"].includes(contribution?.status)) {
    if (normalizedSize === "wide") {
      rows.push(detailRow("Beitrag", money(contribution.amountDue)));
      rows.push(detailRow("Bezahlt", money(contribution.paidAmount)));

      if (Number(contribution.pendingAmount || 0) > 0) {
        rows.push(detailRow("In Prüfung", money(contribution.pendingAmount)));
      }
    }

    if (normalizedSize !== "compact") {
      rows.push(detailRow("Noch offen", money(contribution.openAmount)));
    }
  }

  const compactValue = ["NO_SEASON", "NOT_ASSIGNED"].includes(
    contribution?.status
  )
    ? status.label
    : money(contribution.openAmount);

  return card({
    key: definition.key,
    icon: definition.icon,
    title: definition.title,
    shortTitle: definition.shortTitle,
    description: contribution?.seasonName || "Laufende Saison",
    size: normalizedSize,
    className: `v4-dashboard-contribution is-${escapeAttr(status.type)}`,
    targetRoute: "fanclub",
    targetTab: "contributions",
    body: `<div class="v4-dashboard-topline">
      <span class="badge ${escapeAttr(status.type)}">${escapeHtml(status.label)}</span>
    </div>
    ${normalizedSize === "compact"
      ? `<div class="v4-dashboard-compact-value">
          <strong>${escapeHtml(compactValue)}</strong>
          <span>${["NO_SEASON", "NOT_ASSIGNED"].includes(contribution?.status)
            ? "Status"
            : "noch offen"}</span>
        </div>`
      : `<div class="v4-dashboard-detail-grid">${rows.join("")}</div>`}`
  });
}

function taskBadges(task) {
  const priorityType = task.priority === "URGENT"
    ? "danger"
    : task.priority === "HIGH"
      ? "warning"
      : "neutral";

  return `<span class="badge ${priorityType}">
    ${escapeHtml(TASK_PRIORITY[task.priority] || task.priority || "Normal")}
  </span>
  <span class="badge neutral">
    ${escapeHtml(TASK_STATUS[task.status] || task.status || "Offen")}
  </span>`;
}

function taskRows(items, limit) {
  return (items || []).slice(0, limit).map(task => `<button
    class="v4-dashboard-task-row"
    type="button"
    data-dashboard-task-id="${escapeAttr(task.id)}"
  >
    <span class="v4-dashboard-task-main">
      <strong>${escapeHtml(task.title)}</strong>
      <small>${escapeHtml(
        task.teamName || (task.context === "BOARD" ? "Vorstand" : "Aufgabe")
      )}</small>
    </span>
    <span class="v4-dashboard-task-side">
      <span class="v4-dashboard-task-badges">${taskBadges(task)}</span>
      <span class="v4-dashboard-task-arrow" aria-hidden="true">›</span>
    </span>
  </button>`).join("");
}

function boardTaskSummary(statusCounts = {}) {
  return `<div class="v4-dashboard-status-summary">
    <div><strong>${Number(statusCounts.OPEN || 0)}</strong><span>Offen</span></div>
    <div><strong>${Number(statusCounts.IN_PROGRESS || 0)}</strong><span>In Arbeit</span></div>
    <div><strong>${Number(statusCounts.WAITING || 0)}</strong><span>Wartet</span></div>
  </div>`;
}

function taskCard(definition, taskData, size, options = {}) {
  const normalizedSize = sizeClass(size);
  const itemLimit = normalizedSize === "compact"
    ? 1
    : normalizedSize === "standard"
      ? 2
      : 5;
  const count = Number(taskData?.count || 0);
  const summary = options.board && normalizedSize !== "compact"
    ? boardTaskSummary(taskData?.statusCounts)
    : "";

  return card({
    key: definition.key,
    icon: definition.icon,
    title: definition.title,
    shortTitle: definition.shortTitle,
    description: options.description || "",
    size: normalizedSize,
    className: "v4-dashboard-task-card",
    body: `${normalizedSize === "compact"
      ? `<div class="v4-dashboard-compact-value">
          <strong>${count}</strong>
          <span>aktive ${count === 1 ? "Aufgabe" : "Aufgaben"}</span>
        </div>`
      : summary}
      <div class="v4-dashboard-task-list">
        ${taskRows(taskData?.items || [], itemLimit)}
      </div>
      <button
        class="v4-dashboard-task-row v4-dashboard-open-module"
        type="button"
        data-dashboard-open-tasks
      >
        <span class="v4-dashboard-task-main"><strong>${escapeHtml(
          count > itemLimit ? `Alle ${count} Aufgaben` : "Aufgabenübersicht"
        )}</strong></span>
        <span class="v4-dashboard-task-arrow" aria-hidden="true">›</span>
      </button>`
  });
}

function birthdaysCard(definition, birthdays, size) {
  const normalizedSize = sizeClass(size);
  const limit = normalizedSize === "compact"
    ? 1
    : normalizedSize === "standard"
      ? 3
      : 5;

  return card({
    key: definition.key,
    icon: definition.icon,
    title: definition.title,
    shortTitle: definition.shortTitle,
    description: "Kommende Termine",
    targetRoute: "dates",
    size: normalizedSize,
    className: "v4-dashboard-birthdays",
    body: `<div class="v4-dashboard-birthday-list">
      ${(birthdays || []).slice(0, limit).map(entry => `<div class="v4-dashboard-birthday-row">
        <span>
          <strong>${escapeHtml(entry.name)}</strong>
          <small>${Number(entry.daysUntil || 0) === 0
            ? "Heute"
            : `in ${Number(entry.daysUntil || 0)} Tagen`}</small>
        </span>
        <strong>${dateOnly(entry.birthdayOn)}</strong>
      </div>`).join("")}
    </div>`
  });
}

function memberCountCard(definition, count, size) {
  return card({
    key: definition.key,
    icon: definition.icon,
    title: definition.title,
    shortTitle: definition.shortTitle,
    description: "Aktueller Fanclub-Bestand",
    targetRoute: "fanclub",
    targetTab: "members",
    size,
    className: "v4-dashboard-metric-card",
    body: `<div class="v4-dashboard-primary-value">${Number(count || 0)}</div>`
  });
}

function financeCard(definition, finance, size) {
  const normalizedSize = sizeClass(size);
  const accountLimit = ["small", "compact"].includes(normalizedSize)
    ? 0
    : normalizedSize === "standard"
      ? 3
      : 8;

  return card({
    key: definition.key,
    icon: definition.icon,
    title: definition.title,
    shortTitle: definition.shortTitle,
    description: "Aktuelle Kontostände",
    targetRoute: "fanclub",
    targetTab: "cashbook",
    size: normalizedSize,
    className: "v4-dashboard-finance",
    body: `<div class="v4-dashboard-primary-value">${money(finance.totalBalance)}</div>
      ${accountLimit > 0
        ? `<div class="v4-dashboard-detail-grid">
          ${(finance.accounts || [])
            .slice(0, accountLimit)
            .map(account => detailRow(account.name, money(account.balance)))
            .join("")}
        </div>`
        : ""}`
  });
}

function openContributionsCard(definition, finance, size) {
  return card({
    key: definition.key,
    icon: definition.icon,
    title: definition.title,
    shortTitle: definition.shortTitle,
    description: finance.seasonName || "Laufende Saison",
    targetRoute: "fanclub",
    targetTab: "contributions",
    size,
    className: "v4-dashboard-metric-card",
    body: `<div class="v4-dashboard-inline-metric">
      <strong>${Number(finance.openContributionCount || 0)}</strong>
      <span>${escapeHtml(`${money(finance.openContributionAmount)} offen`)}</span>
    </div>`
  });
}

function availableWidgets(data) {
  const available = [];
  const member = data.member;
  const finance = data.finance;

  const add = key => {
    const definition = CATALOG_BY_KEY.get(key);
    if (definition) available.push(definition);
  };

  if (member) add("member_count");
  if (member?.contribution) add("contribution");
  if (finance?.seasonId) add("open_contributions");
  if ((member?.birthdays || []).length > 0) add("birthdays");
  if (Number(data.ownTasks?.count || 0) > 0) add("own_tasks");
  if (Number(data.teamTasks?.count || 0) > 0) add("team_tasks");
  if ((finance?.accounts || []).length > 0) add("finance");
  if (Number(data.boardTasks?.count || 0) > 0) add("board_tasks");

  return available;
}

function defaultLayout(available) {
  return available.map(definition => ({
    key: definition.key,
    size: definition.defaultSize,
    visible: true
  }));
}

function savedWidgets(preferences) {
  const widgets = preferences?.layout?.widgets;
  return Array.isArray(widgets) ? widgets : [];
}

function resolveLayout(available, preferences) {
  const saved = savedWidgets(preferences);
  const savedMode = preferences?.saved === true;

  if (!savedMode) {
    return defaultLayout(available);
  }

  const availableKeys = new Set(available.map(widget => widget.key));
  const used = new Set();
  const layout = [];

  for (const item of saved) {
    const definition = CATALOG_BY_KEY.get(item?.key);

    if (!definition || !availableKeys.has(definition.key) || used.has(definition.key)) {
      continue;
    }

    used.add(definition.key);
    layout.push({
      key: definition.key,
      size: ALL_SIZES.includes(item.size)
        ? item.size
        : definition.defaultSize,
      visible: item.visible !== false
    });
  }

  for (const definition of available) {
    if (used.has(definition.key)) continue;

    layout.push({
      key: definition.key,
      size: definition.defaultSize,
      visible: false
    });
  }

  return layout;
}

function renderWidget(item, data) {
  const definition = CATALOG_BY_KEY.get(item.key);
  if (!definition) return "";

  switch (item.key) {
    case "member_count":
      return memberCountCard(
        definition,
        data.member?.memberCount,
        item.size
      );
    case "contribution":
      return contributionCard(
        definition,
        data.member?.contribution,
        item.size
      );
    case "open_contributions":
      return openContributionsCard(definition, data.finance, item.size);
    case "birthdays":
      return birthdaysCard(
        definition,
        data.member?.birthdays || [],
        item.size
      );
    case "own_tasks":
      return taskCard(definition, data.ownTasks, item.size, {
        description: "Dir persönlich zugewiesen"
      });
    case "team_tasks":
      return taskCard(definition, data.teamTasks, item.size, {
        description: "Aufgaben deiner Teams"
      });
    case "finance":
      return financeCard(definition, data.finance, item.size);
    case "board_tasks":
      return taskCard(definition, data.boardTasks, item.size, {
        board: true,
        description: "Aktive Vorstandsaufgaben"
      });
    default:
      return "";
  }
}

function renderDashboard() {
  const panel = document.getElementById("dashboardWidgets");
  const toolbar = document.getElementById("dashboardToolbar");

  if (!panel) return;

  if (toolbar) {
    toolbar.hidden = dashboardState.available.length === 0;
  }

  const cards = [];

  for (const item of dashboardState.layout) {
    if (!item.visible) continue;

    const rendered = renderWidget(item, dashboardState.data);

    if (rendered) {
      cards.push(rendered);
    }
  }

  panel.classList.toggle("is-empty", cards.length === 0);
  panel.innerHTML = cards.join("");
  bindDashboardNavigation(panel);
}

function bindDashboardNavigation(panel) {
  panel.querySelectorAll("[data-dashboard-route]").forEach(card => {
    const open = event => {
      if (event?.target?.closest?.("button, a, input, select, textarea, label")) return;
      const route = card.dataset.dashboardRoute;
      if (!route) return;
      const params = new URLSearchParams();
      if (card.dataset.dashboardTab) params.set("tab", card.dataset.dashboardTab);
      navigate(route, params);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      open(event);
    });
  });

  panel.querySelectorAll("[data-dashboard-task-id]").forEach(button => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.dashboardTaskId;
      if (!taskId) return;

      navigate(
        "tasks",
        new URLSearchParams({ taskId })
      );
    });
  });

  panel.querySelectorAll("[data-dashboard-open-tasks]").forEach(button => {
    button.addEventListener("click", () => navigate("tasks"));
  });
}

function sizeOptions(definition, selected) {
  return definition.allowedSizes.map(size => `<option
    value="${escapeAttr(size)}"
    ${size === selected ? "selected" : ""}
  >${escapeHtml(SIZE_LABELS[size])}</option>`).join("");
}

function editorRow(item, index, total) {
  const definition = CATALOG_BY_KEY.get(item.key);

  return `<div
    class="v4-dashboard-editor-row"
    data-widget-editor-key="${escapeAttr(item.key)}"
    draggable="true"
  >
    <span
      class="v4-dashboard-drag-handle"
      aria-hidden="true"
      title="Ziehen"
    >⋮⋮</span>

    <span class="v4-dashboard-editor-icon" aria-hidden="true">
      ${definition.icon}
    </span>

    <div class="v4-dashboard-editor-copy">
      <strong>${escapeHtml(definition.title)}</strong>
      <small>${escapeHtml(definition.shortTitle)}</small>
    </div>

    <label class="v4-dashboard-visible-toggle">
      <input
        type="checkbox"
        name="visible__${escapeAttr(item.key)}"
        ${item.visible ? "checked" : ""}
      >
      <span>Anzeigen</span>
    </label>

    <label class="v4-dashboard-size-field">
      <span class="sr-only">Größe für ${escapeHtml(definition.title)}</span>
      <select name="size__${escapeAttr(item.key)}">
        ${sizeOptions(definition, item.size)}
      </select>
    </label>

    <div class="v4-dashboard-order-buttons">
      <button
        class="icon-button"
        type="button"
        data-dashboard-move="-1"
        aria-label="${escapeAttr(definition.title)} nach oben"
        ${index === 0 ? "disabled" : ""}
      >↑</button>
      <button
        class="icon-button"
        type="button"
        data-dashboard-move="1"
        aria-label="${escapeAttr(definition.title)} nach unten"
        ${index === total - 1 ? "disabled" : ""}
      >↓</button>
    </div>
  </div>`;
}

function editorRows(layout) {
  return layout.map((item, index) =>
    editorRow(item, index, layout.length)
  ).join("");
}

function editorBody(layout) {
  const availableKeys = new Set(layout.map(item => item.key));
  const canUseSmallMetricRow = SMALL_METRIC_ROW_KEYS.every(
    key => availableKeys.has(key)
  );

  return `<form class="v4-dashboard-editor-form">
    <p class="subtle v4-dashboard-editor-intro">
      Wähle ausschließlich die für dich freigegebenen Widgets, ihre Größe
      und Reihenfolge.
    </p>

    ${canUseSmallMetricRow
      ? `<button
          class="button secondary small v4-dashboard-small-row-button"
          type="button"
          data-dashboard-small-row
        >
          3er-Kennzahlenreihe
        </button>`
      : ""}

    <input
      type="hidden"
      name="order"
      value="${escapeAttr(layout.map(item => item.key).join(","))}"
    >

    <div id="dashboardWidgetEditor" class="v4-dashboard-editor-list">
      ${editorRows(layout)}
    </div>

    <button
      class="button ghost small"
      type="button"
      data-dashboard-reset
    >
      Standard wiederherstellen
    </button>
  </form>`;
}

function updateEditorOrder(form) {
  const rows = [
    ...form.querySelectorAll("[data-widget-editor-key]")
  ];
  const order = form.elements.namedItem("order");

  if (order) {
    order.value = rows
      .map(row => row.dataset.widgetEditorKey)
      .join(",");
  }

  rows.forEach((row, index) => {
    const up = row.querySelector('[data-dashboard-move="-1"]');
    const down = row.querySelector('[data-dashboard-move="1"]');

    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === rows.length - 1;
  });
}

function bindEditorControls(form) {
  const list = form.querySelector("#dashboardWidgetEditor");
  if (!list) return;

  list.addEventListener("click", event => {
    const button = event.target.closest("[data-dashboard-move]");
    if (!button) return;

    const row = button.closest("[data-widget-editor-key]");
    if (!row) return;

    const direction = Number(button.dataset.dashboardMove || 0);

    if (direction < 0 && row.previousElementSibling) {
      list.insertBefore(row, row.previousElementSibling);
    }

    if (direction > 0 && row.nextElementSibling) {
      list.insertBefore(row.nextElementSibling, row);
    }

    updateEditorOrder(form);
  });

  let draggedKey = "";

  list.addEventListener("dragstart", event => {
    const row = event.target.closest("[data-widget-editor-key]");
    if (!row) return;

    draggedKey = row.dataset.widgetEditorKey || "";
    row.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", draggedKey);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });

  list.addEventListener("dragend", event => {
    event.target.closest("[data-widget-editor-key]")
      ?.classList.remove("is-dragging");
    draggedKey = "";
    updateEditorOrder(form);
  });

  list.addEventListener("dragover", event => {
    if (!draggedKey) return;
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });

  list.addEventListener("drop", event => {
    if (!draggedKey) return;
    event.preventDefault();

    const source = list.querySelector(
      `[data-widget-editor-key="${CSS.escape(draggedKey)}"]`
    );
    const target = event.target.closest("[data-widget-editor-key]");

    if (!source || !target || source === target) return;

    const rect = target.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;

    list.insertBefore(
      source,
      after ? target.nextElementSibling : target
    );

    updateEditorOrder(form);
  });

  form.querySelector("[data-dashboard-small-row]")
    ?.addEventListener("click", () => {
      const rows = SMALL_METRIC_ROW_KEYS.map(key =>
        list.querySelector(`[data-widget-editor-key="${key}"]`)
      );

      if (rows.some(row => !row)) return;

      for (const key of SMALL_METRIC_ROW_KEYS) {
        const row = list.querySelector(
          `[data-widget-editor-key="${key}"]`
        );
        const checkbox = row?.querySelector(
          `[name="visible__${key}"]`
        );
        const select = row?.querySelector(
          `[name="size__${key}"]`
        );

        if (checkbox) checkbox.checked = true;
        if (select) select.value = "small";
      }

      for (const key of SMALL_METRIC_ROW_KEYS.slice().reverse()) {
        const row = list.querySelector(
          `[data-widget-editor-key="${key}"]`
        );

        if (row) list.insertBefore(row, list.firstElementChild);
      }

      updateEditorOrder(form);
    });

  form.querySelector("[data-dashboard-reset]")
    ?.addEventListener("click", () => {
      const defaults = defaultLayout(dashboardState.available);
      list.innerHTML = editorRows(defaults);
      updateEditorOrder(form);
    });

  updateEditorOrder(form);
}

function layoutFromForm(values) {
  const order = String(values.order || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const availableKeys = new Set(
    dashboardState.available.map(widget => widget.key)
  );
  const used = new Set();
  const widgets = [];

  for (const key of order) {
    const definition = CATALOG_BY_KEY.get(key);

    if (!definition || !availableKeys.has(key) || used.has(key)) {
      continue;
    }

    used.add(key);

    const requestedSize = values[`size__${key}`];

    widgets.push({
      key,
      size: definition.allowedSizes.includes(requestedSize)
        ? requestedSize
        : definition.defaultSize,
      visible: values[`visible__${key}`] === "on"
    });
  }

  for (const definition of dashboardState.available) {
    if (used.has(definition.key)) continue;

    widgets.push({
      key: definition.key,
      size: definition.defaultSize,
      visible: false
    });
  }

  const availableKeySet = new Set(widgets.map(item => item.key));
  const preservedUnavailable = dashboardState.rawSavedWidgets.filter(item =>
    CATALOG_BY_KEY.has(item?.key)
    && !availableKeySet.has(item.key)
  );

  return {
    version: 1,
    widgets: [...widgets, ...preservedUnavailable]
  };
}

function openDashboardEditor() {
  if (dashboardState.available.length === 0) return;

  openDialog({
    title: "Dashboard anpassen",
    kicker: "Persönliche Ansicht",
    body: editorBody(dashboardState.layout),
    submitLabel: "Dashboard speichern",
    onSubmit: async values => {
      const layout = layoutFromForm(values);
      const preferences = await call(
        "saveDashboardPreferences",
        { layout }
      );

      dashboardState.preferencesSaved = true;
      dashboardState.rawSavedWidgets = savedWidgets(preferences);
      dashboardState.layout = resolveLayout(
        dashboardState.available,
        preferences
      );

      renderDashboard();
      showToast("Dashboard wurde gespeichert.", "success");
    }
  });

  const form = document.querySelector(
    "#v4DialogBody .v4-dashboard-editor-form"
  );

  if (form) bindEditorControls(form);
}

export async function hydrateDashboard(context = {}) {
  const panel = document.getElementById("dashboardWidgets");
  const customizeButton = document.getElementById(
    "dashboardCustomizeButton"
  );

  if (!panel) return;

  panel.setAttribute("aria-busy", "true");

  try {
    const data = await call("dashboard");

    if (context.isCurrent && !context.isCurrent()) return;

    const available = availableWidgets(data);
    const preferences = data.preferences || {
      saved: false,
      layout: null,
      updatedAt: null
    };

    dashboardState = {
      data,
      available,
      layout: resolveLayout(available, preferences),
      rawSavedWidgets: savedWidgets(preferences),
      preferencesSaved: preferences.saved === true
    };

    renderDashboard();

    customizeButton?.addEventListener(
      "click",
      openDashboardEditor
    );
  } catch (error) {
    panel.classList.remove("is-empty");
    panel.innerHTML = errorPanel(
      error,
      "Dashboard konnte nicht geladen werden"
    );
  } finally {
    panel.setAttribute("aria-busy", "false");
  }
}

const __V4_DASHBOARD_ROLE_AWARE_R1__ = true;
const __V4_DASHBOARD_LAYOUT_CORR1__ = true;
const __V4_DASHBOARD_LAYOUT_CORR3__ = true;
const __V4_PERSONAL_DASHBOARD_WIDGETS_R1__ = true;
const __V4_DASHBOARD_SMALL_WIDGETS_R1__ = true;

export function noop() {}
