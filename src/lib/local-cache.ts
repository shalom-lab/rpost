/** IndexedDB cache for private-repo payloads. Token stays in localStorage. */

const DB_NAME = "rpost-cache-v1";
const STORE = "entries";

export const CACHE_UPDATED = "rpost-cache-updated";

type CacheRow = {
  key: string;
  body: string;
  meta: string;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function cacheGet(key: string): Promise<CacheRow | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as CacheRow | undefined) ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, body: string, meta = ""): Promise<void> {
  try {
    const db = await openDb();
    const row: CacheRow = { key, body, meta, savedAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(row);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    /* ignore quota / private mode */
  }
}

export async function cacheClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    /* ignore */
  }
}

export function notifyCacheUpdated(key: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CACHE_UPDATED, { detail: { key } }));
}

/** Stale-while-revalidate against an authenticated loader (not a public URL). */
export async function cachedLoadText(
  key: string,
  loader: () => Promise<string>,
  options?: { metaFromBody?: (body: string) => string },
): Promise<string> {
  const cached = await cacheGet(key);

  const network = (async () => {
    const body = await loader();
    const meta = options?.metaFromBody?.(body) ?? "";
    const changed = !cached || cached.body !== body || cached.meta !== meta;
    await cacheSet(key, body, meta);
    if (changed) notifyCacheUpdated(key);
    return body;
  })();

  if (cached?.body != null) {
    void network.catch(() => {
      /* keep serving stale cache */
    });
    return cached.body;
  }

  return network;
}
