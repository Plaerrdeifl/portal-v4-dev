await import("./runtime-config.js");

const STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const { prepareLivetickerGameStorage } = await import("./liveticker-game-storage.js?v=20260905-1");

try {
  await prepareLivetickerGameStorage();

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this !== localStorage || key !== STORAGE_KEY) return;
    try {
      const state = JSON.parse(value);
      if (state && Array.isArray(state.history)) {
        window.dispatchEvent(new CustomEvent("pd-liveticker-state-saved", { detail: { state } }));
      }
    } catch {}
  };

  await import("./liveticker-prototype-v4.js?v=20260905-game-storage1");
} catch (error) {
  console.error(error);
  const box = document.querySelector("#formError");
  if (box) {
    box.textContent = error?.message || "Liveticker konnte nicht geladen werden.";
    box.hidden = false;
  }
  document.querySelector("#tickerForm")?.setAttribute("aria-disabled", "true");
}
