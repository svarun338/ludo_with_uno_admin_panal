/* Simple in-memory query cache with TTL */
const store = new Map();

export const cacheGet = key => store.get(key) ?? null;

export const cacheSet = (key, value, ttl = 30_000) => {
    store.set(key, value);
    setTimeout(() => store.delete(key), ttl);
};

export const cacheHas = key => store.has(key);

export const cacheClear = () => store.clear();
