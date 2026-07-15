const store = new Map();
const inFlight = new Map();

export const phase3State = Object.freeze({
  get(key, fallback = null) { return store.has(key) ? store.get(key) : fallback; },
  set(key, value) { store.set(key, value); return value; },
  has(key) { return store.has(key); },
  remove(key) { store.delete(key); },
  clear(prefix = "") {
    if (!prefix) {
      store.clear();
      inFlight.clear();
      return;
    }
    [...store.keys()].filter(key => String(key).startsWith(prefix)).forEach(key => store.delete(key));
    [...inFlight.keys()].filter(key => String(key).startsWith(prefix)).forEach(key => inFlight.delete(key));
  },
  async once(key, loader, { force = false } = {}) {
    if (!force && store.has(key)) return store.get(key);
    if (!force && inFlight.has(key)) return inFlight.get(key);
    const promise = Promise.resolve()
      .then(loader)
      .then(value => {
        store.set(key, value);
        return value;
      })
      .finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key);
      });
    inFlight.set(key, promise);
    return promise;
  }
});
