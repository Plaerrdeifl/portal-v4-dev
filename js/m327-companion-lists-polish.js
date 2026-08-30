import {
  setupM327CompanionListsPolish as setupM327CompanionListsTapBase
} from "./m327-companion-lists-tap-base.js?v=20260830-m327-companion-stable1";
import {
  setupM327CompanionListsFinalPolish
} from "./m327-companion-lists-final-polish.js?v=20260830-m327-companion-final2";

export function setupM327CompanionListsPolish() {
  setupM327CompanionListsTapBase();
  setupM327CompanionListsFinalPolish();
}
