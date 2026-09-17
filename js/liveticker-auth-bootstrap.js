import { auth } from "./auth.js";

const isGameMode = new URLSearchParams(window.location.search).get("mode") === "game-day";

try {
  await auth.initialize();
  const state = auth.current();
  if (!state?.authenticated || state.status !== "ACTIVE" || !auth.hasCapability("liveticker.manage")) {
    window.location.replace("../#/login");
  } else {
    const app = document.getElementById("tickerApp");
    if (app && !isGameMode) app.hidden = false;
    await import("./liveticker-bootstrap.js?v=20260917-player-fast-r1");
    await import("./liveticker-graphics-inline.js?v=20260916-game-day-r4");
  }
} catch (error) {
  console.error(error);
  window.location.replace("../#/login");
}
