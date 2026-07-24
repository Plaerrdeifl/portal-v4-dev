import {
  call,
  errorPanel,
  escapeAttr,
  escapeHtml
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
  NO_SEASON: {
    label: "Keine laufende Saison",
    type: "neutral"
  },
  NOT_ASSIGNED: {
    label: "Noch nicht zugeordnet",
    type: "warning"
  },
  EXEMPT: {
    label: "Befreit",
    type: "success"
  },
  OPEN: {
    label: "Offen",
    type: "danger"
  },
  PARTIAL: {
    label: "Teilweise bezahlt",
    type: "warning"
  },
  PENDING: {
    label: "Zahlung wartet auf Bestätigung",
    type: "warning"
  },
  PAID: {
    label: "Bezahlt",
    type: "success"
  }
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

function card({
  icon,
  title,
  description = "",
  size = "widget-s",
  body = "",
  className = ""
}) {
  return `<article class="card dashboard-widget ${escapeAttr(size)} ${escapeAttr(className)}">
    <div class="dashboard-widget-head">
      <span class="dashboard-widget-icon" aria-hidden="true">${icon}</span>
      <div>
        <h3>${escapeHtml(title)}</h3>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </div>
    </div>
    <div class="dashboard-widget-body">${body}</div>
  </article>`;
}

function contributionCard(contribution) {
  const status = CONTRIBUTION_STATUS[contribution?.status]
    || CONTRIBUTION_STATUS.NOT_ASSIGNED;

  const details = [];

  if (contribution?.className) {
    details.push(`<div class="widget-value-line">
      <span>Beitragsklasse</span>
      <strong>${escapeHtml(contribution.className)}</strong>
    </div>`);
  }

  if (!["NO_SEASON", "NOT_ASSIGNED"].includes(contribution?.status)) {
    details.push(`<div class="widget-value-line">
      <span>Beitrag</span>
      <strong>${money(contribution.amountDue)}</strong>
    </div>`);

    details.push(`<div class="widget-value-line">
      <span>Bestätigt bezahlt</span>
      <strong>${money(contribution.paidAmount)}</strong>
    </div>`);

    if (Number(contribution.pendingAmount || 0) > 0) {
      details.push(`<div class="widget-value-line">
        <span>In Prüfung</span>
        <strong>${money(contribution.pendingAmount)}</strong>
      </div>`);
    }

    details.push(`<div class="widget-value-line">
      <span>Noch offen</span>
      <strong>${money(contribution.openAmount)}</strong>
    </div>`);
  }

  return card({
    icon: "💳",
    title: "Dein Beitragsstatus",
    description: contribution?.seasonName || "Laufende Saison",
    size: "widget-m",
    className: `v4-dashboard-contribution is-${escapeAttr(status.type)}`,
    body: `<div class="v4-dashboard-contribution-status">
      <span class="badge ${escapeAttr(status.type)}">${escapeHtml(status.label)}</span>
    </div>
    <div class="widget-values">${details.join("")}</div>`
  });
}

function taskBadge(task) {
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

function taskRows(items) {
  return (items || []).map(task => `<button
    class="v4-dashboard-task-row"
    type="button"
    data-dashboard-task-id="${escapeAttr(task.id)}"
  >
    <span class="v4-dashboard-task-copy">
      <strong>${escapeHtml(task.title)}</strong>
      <small>${escapeHtml(task.teamName || (task.context === "BOARD" ? "Vorstand" : "Aufgabe"))}</small>
    </span>
    <span class="v4-dashboard-task-badges">${taskBadge(task)}</span>
    <span class="v4-dashboard-task-arrow" aria-hidden="true">›</span>
  </button>`).join("");
}

function taskCard({
  icon,
  title,
  description,
  count,
  items,
  size = "widget-m",
  summary = ""
}) {
  return card({
    icon,
    title,
    description,
    size,
    className: "v4-dashboard-task-card",
    body: `${summary}
      <div class="v4-dashboard-task-list">${taskRows(items)}</div>
      <small class="v4-dashboard-card-foot">
        ${escapeHtml(`${count} aktive ${count === 1 ? "Aufgabe" : "Aufgaben"}`)}
      </small>`
  });
}

function boardTaskSummary(statusCounts = {}) {
  return `<div class="v4-dashboard-status-summary">
    <span><strong>${Number(statusCounts.OPEN || 0)}</strong> Offen</span>
    <span><strong>${Number(statusCounts.IN_PROGRESS || 0)}</strong> In Bearbeitung</span>
    <span><strong>${Number(statusCounts.WAITING || 0)}</strong> Wartet</span>
  </div>`;
}

function birthdaysCard(birthdays) {
  return card({
    icon: "🎂",
    title: "Nächste Geburtstage",
    description: "Die nächsten fünf Termine",
    size: "widget-m",
    className: "v4-dashboard-birthdays",
    body: `<div class="v4-dashboard-birthday-list">
      ${(birthdays || []).map(entry => `<div class="v4-dashboard-birthday-row">
        <span>
          <strong>${escapeHtml(entry.name)}</strong>
          <small>${Number(entry.daysUntil || 0) === 0 ? "Heute" : `in ${Number(entry.daysUntil || 0)} Tagen`}</small>
        </span>
        <strong>${dateOnly(entry.birthdayOn)}</strong>
      </div>`).join("")}
    </div>`
  });
}

function memberCountCard(count) {
  return card({
    icon: "👥",
    title: "Aktive Mitglieder",
    description: "Aktueller Fanclub-Bestand",
    size: "widget-s",
    body: `<strong class="widget-main-value">${Number(count || 0)}</strong>`
  });
}

function financeCard(finance) {
  return card({
    icon: "💶",
    title: "Fanclub-Kassen",
    description: "Aktuelle Salden aller aktiven Konten",
    size: "widget-m",
    className: "v4-dashboard-finance",
    body: `<strong class="widget-main-value">${money(finance.totalBalance)}</strong>
      <div class="widget-values">
        ${(finance.accounts || []).map(account => `<div class="widget-value-line">
          <span>${escapeHtml(account.name)}</span>
          <strong>${money(account.balance)}</strong>
        </div>`).join("")}
      </div>`
  });
}

function openContributionsCard(finance) {
  return card({
    icon: "📌",
    title: "Offene Beiträge",
    description: finance.seasonName || "Laufende Saison",
    size: "widget-s",
    body: `<strong class="widget-main-value">${Number(finance.openContributionCount || 0)}</strong>
      <small class="v4-dashboard-card-foot">
        ${escapeHtml(`${money(finance.openContributionAmount)} insgesamt offen`)}
      </small>`
  });
}

function bindTaskNavigation(panel) {
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
}

export async function hydrateDashboard(context = {}) {
  const panel = document.getElementById("dashboardWidgets");

  if (!panel) return;

  panel.setAttribute("aria-busy", "true");

  try {
    const data = await call("dashboard");

    if (context.isCurrent && !context.isCurrent()) return;

    const cards = [];
    const member = data.member;
    const ownTasks = data.ownTasks || {};
    const teamTasks = data.teamTasks || {};
    const boardTasks = data.boardTasks || {};
    const finance = data.finance;

    if (member?.contribution) {
      cards.push(contributionCard(member.contribution));
    }

    if (Number(ownTasks.count || 0) > 0) {
      cards.push(taskCard({
        icon: "✅",
        title: "Deine Aufgaben",
        description: "Aktive, dir persönlich zugewiesene Aufgaben",
        count: Number(ownTasks.count || 0),
        items: ownTasks.items || []
      }));
    }

    if (Number(teamTasks.count || 0) > 0) {
      cards.push(taskCard({
        icon: "🤝",
        title: "Teamaufgaben",
        description: "Aktive Aufgaben deiner sichtbaren Teams",
        count: Number(teamTasks.count || 0),
        items: teamTasks.items || []
      }));
    }

    if (Number(boardTasks.count || 0) > 0) {
      cards.push(taskCard({
        icon: "🏒",
        title: "Vorstandsaufgaben",
        description: "Kompakte Übersicht der aktiven Vorstandsaufgaben",
        count: Number(boardTasks.count || 0),
        items: boardTasks.items || [],
        size: "widget-l",
        summary: boardTaskSummary(boardTasks.statusCounts)
      }));
    }

    if (member) {
      cards.push(memberCountCard(member.memberCount));

      if ((member.birthdays || []).length > 0) {
        cards.push(birthdaysCard(member.birthdays));
      }
    }

    if (finance) {
      if ((finance.accounts || []).length > 0) {
        cards.push(financeCard(finance));
      }

      if (finance.seasonId) {
        cards.push(openContributionsCard(finance));
      }
    }

    panel.classList.toggle("is-empty", cards.length === 0);
    panel.innerHTML = cards.join("");
    bindTaskNavigation(panel);
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

export function noop() {}
