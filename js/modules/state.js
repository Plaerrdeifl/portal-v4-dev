const store = new Map();

export const phase3State = Object.freeze({
  get(key, fallback = null) { return store.has(key) ? store.get(key) : fallback; },
  set(key, value) { store.set(key, value); return value; },
  has(key) { return store.has(key); },
  remove(key) { store.delete(key); },
  clear(prefix = "") {
    if (!prefix) return store.clear();
    [...store.keys()].filter(key => String(key).startsWith(prefix)).forEach(key => store.delete(key));
  }
});
