import { CONFIG } from "./config.js";
import { storage } from "./storage.js";

const AUTH_KEY = "pd_portal_auth_phase2";

export const auth = {
  current() {
    return storage.get(AUTH_KEY, { authenticated: false, user: null });
  },
  isAuthenticated() {
    return Boolean(this.current()?.authenticated);
  },
  clear() {
    storage.remove(AUTH_KEY);
  },
  openLegacyPortal() {
    window.open(CONFIG.urls.legacyPortal, "_blank", "noopener,noreferrer");
  }
};
