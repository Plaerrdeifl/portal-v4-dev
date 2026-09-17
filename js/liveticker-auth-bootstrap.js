import { auth } from "./auth.js";

try {
  await auth.initialize();
  const state = auth.current();
  if (!state?.authenticated || state.status !== "ACTIVE" || !auth.hasCapability("liveticker.manage")) {
    window.location.replace("../#/login");
  } else {
    const app = document.getElementById("tickerApp");
    if (app) app.hidden = false;
    await import("./liveticker-runtime-controls.js?v=20260917-wa-wpp-control-r2");
    await import("./liveticker-bootstrap.js?v=20260917-liveticker-hotfix-r1");
    await import("./liveticker-graphics-inline.js?v=20260917-classic-only-r1");
  }
} catch (error) {
  console.error(error);
  window.location.replace("../#/login");
}
