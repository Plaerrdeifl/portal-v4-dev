export const ROSTER = Object.freeze([
  { number: "40", name: "Leon Pöhlmann", position: "Tor" },
  { number: "42", name: "Benedict Roßberg", position: "Tor" },
  { number: "2", name: "Lucas Kleider", position: "Verteidigung" },
  { number: "5", name: "Colin Freibert", position: "Verteidigung" },
  { number: "19", name: "Kristers Donins", position: "Verteidigung" },
  { number: "28", name: "Renars Dzerods Alksnis", position: "Verteidigung" },
  { number: "69", name: "Lukas Krumpe", position: "Verteidigung" },
  { number: "33", name: "Thomáš Pribyl", position: "Verteidigung" },
  { number: "", name: "Ondrej Nedved", position: "Verteidigung" },
  { number: "10", name: "Kevin Heckenberger", position: "Sturm" },
  { number: "24", name: "Alex Asmus", position: "Sturm" },
  { number: "46", name: "Pavel Bares", position: "Sturm" },
  { number: "41", name: "Tomas Cermak", position: "Sturm" },
  { number: "70", name: "Josef Dana", position: "Sturm" },
  { number: "84", name: "Nils Melchior", position: "Sturm" },
  { number: "89", name: "Dimitri Litesov", position: "Sturm" },
  { number: "91", name: "Georg Pinsack", position: "Sturm" },
  { number: "", name: "Ricards Bernhards", position: "Sturm" }
]);

export const PENALTY_REASONS = Object.freeze([
  "Halten",
  "Beinstellen",
  "Haken",
  "Stockschlag",
  "Behinderung",
  "Hoher Stock",
  "Crosscheck",
  "Bandencheck",
  "Check gegen Kopf oder Nacken",
  "Ellbogencheck",
  "Kniecheck",
  "Übertriebene Härte",
  "Unsportliches Verhalten",
  "Spielverzögerung",
  "Zu viele Spieler auf dem Eis"
]);

function playerText(player) {
  if (!player) return "";
  return player.number ? `#${player.number} ${player.name}` : player.name;
}

export function formatTickerText({
  action,
  period,
  gameMinute,
  goalPlayer,
  penaltyDuration,
  penaltyReason,
  penaltyPlayer
}) {
  const minute = Number.parseInt(gameMinute, 10);
  const currentPeriod = Number.parseInt(period, 10);

  if (!Number.isInteger(minute) || minute < 1 || minute > 60) {
    throw new Error("Bitte eine Spielminute zwischen 1 und 60 eingeben.");
  }
  if (![1, 2, 3].includes(currentPeriod)) {
    throw new Error("Bitte das aktuelle Drittel auswählen.");
  }

  const timeLine = `🕒 ${minute}. Spielminute · ${currentPeriod}. Drittel`;

  if (action === "GOAL") {
    if (!goalPlayer) throw new Error("Bitte den Torschützen auswählen.");
    return [
      "🥅 *TOR FÜR DIE MIGHTY DOGS!*",
      "",
      `🏒 ${playerText(goalPlayer)}`,
      timeLine
    ].join("\n");
  }

  if (action === "PENALTY") {
    const duration = Number.parseInt(penaltyDuration, 10);
    if (![2, 5, 10].includes(duration)) {
      throw new Error("Bitte eine gültige Strafdauer auswählen.");
    }
    if (!PENALTY_REASONS.includes(penaltyReason)) {
      throw new Error("Bitte einen Strafgrund auswählen.");
    }

    const lines = [
      "⏱️ *STRAFE GEGEN DIE MIGHTY DOGS*",
      "",
      `🚨 ${duration} Minuten · ${penaltyReason}`
    ];
    if (penaltyPlayer) lines.push(`🏒 ${playerText(penaltyPlayer)}`);
    lines.push(timeLine);
    return lines.join("\n");
  }

  throw new Error("Bitte eine Aktion auswählen.");
}

function rosterOption(player) {
  const option = document.createElement("option");
  option.value = player.name;
  option.textContent = playerText(player);
  option.dataset.number = player.number;
  option.dataset.position = player.position;
  return option;
}

function fillRoster(select, includeGroups = true) {
  const positions = ["Tor", "Verteidigung", "Sturm"];

  for (const position of positions) {
    const target = includeGroups
      ? Object.assign(document.createElement("optgroup"), { label: position })
      : select;
    for (const player of ROSTER.filter(entry => entry.position === position)) {
      target.append(rosterOption(player));
    }
    if (includeGroups) select.append(target);
  }
}

function selectedRosterPlayer(select) {
  if (!select.value) return null;
  return ROSTER.find(player => player.name === select.value) || null;
}

function initialize() {
  const form = document.querySelector("#tickerForm");
  if (!form) return;

  const goalFields = document.querySelector("#goalFields");
  const penaltyFields = document.querySelector("#penaltyFields");
  const goalPlayer = document.querySelector("#goalPlayer");
  const penaltyPlayer = document.querySelector("#penaltyPlayer");
  const penaltyReason = document.querySelector("#penaltyReason");
  const gameMinute = document.querySelector("#gameMinute");
  const output = document.querySelector("#tickerOutput");
  const copyButton = document.querySelector("#copyButton");
  const formError = document.querySelector("#formError");

  fillRoster(goalPlayer);
  fillRoster(penaltyPlayer);
  for (const reason of PENALTY_REASONS) {
    penaltyReason.append(new Option(reason, reason));
  }

  function selectedAction() {
    return new FormData(form).get("action");
  }

  function syncActionFields() {
    const isGoal = selectedAction() === "GOAL";
    goalFields.hidden = !isGoal;
    penaltyFields.hidden = isGoal;
    goalPlayer.required = isGoal;
    penaltyReason.required = !isGoal;
    formError.hidden = true;
  }

  form.addEventListener("change", event => {
    if (event.target.name === "action") syncActionFields();
  });

  for (const button of document.querySelectorAll("[data-minute-step]")) {
    button.addEventListener("click", () => {
      const current = Number.parseInt(gameMinute.value, 10) || 1;
      const step = Number.parseInt(button.dataset.minuteStep, 10);
      gameMinute.value = String(Math.min(60, Math.max(1, current + step)));
    });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    formError.hidden = true;

    try {
      const data = new FormData(form);
      output.value = formatTickerText({
        action: data.get("action"),
        period: data.get("period"),
        gameMinute: data.get("gameMinute"),
        goalPlayer: selectedRosterPlayer(goalPlayer),
        penaltyDuration: data.get("penaltyDuration"),
        penaltyReason: data.get("penaltyReason"),
        penaltyPlayer: selectedRosterPlayer(penaltyPlayer)
      });
      output.focus();
      output.setSelectionRange(output.value.length, output.value.length);
      copyButton.dataset.copied = "false";
      copyButton.textContent = "Kopieren";
    } catch (error) {
      formError.textContent = error.message || "Der Text konnte nicht erstellt werden.";
      formError.hidden = false;
    }
  });

  copyButton.addEventListener("click", async () => {
    if (!output.value.trim()) {
      formError.textContent = "Bitte zuerst einen Text erstellen.";
      formError.hidden = false;
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);
    } catch {
      output.focus();
      output.select();
      document.execCommand("copy");
      output.setSelectionRange(output.value.length, output.value.length);
    }

    copyButton.dataset.copied = "true";
    copyButton.textContent = "Kopiert ✓";
    formError.hidden = true;
  });

  syncActionFields();
}

if (typeof document !== "undefined") initialize();
