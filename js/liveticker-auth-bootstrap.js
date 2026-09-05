import { auth } from "./auth.js";

try {
  await auth.initialize();
  const state = auth.current();
  if (!state?.authenticated || state.status !== "ACTIVE" || !auth.hasCapability("liveticker.manage")) {
    window.location.replace("../#/login");
  } else {
    const app = document.getElementById("tickerApp");
    if (app) app.hidden = false;
    await import("./liveticker-bootstrap.js?v=20260905-prod2");
  }
} catch (error) {
  console.error(error);
  window.location.replace("../#/login");
}
