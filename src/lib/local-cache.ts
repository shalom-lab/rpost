/** IndexedDB persistence for private-repo payloads. Token stays in localStorage. */

const DB_NAME = "rpost-cache-v2";
const TEXT_STORE = "entries";
const BLOB_STORE = "blobs";
const DB_VERSION = 2;

export const CACHE_UPDATED = "rpost-cache-updated";

type TextRow = {
  key: string;
  body: string;
  meta: string;
  savedAt: number;
};

type BlobRow = {
  key: string;
  blob: Blob;
  meta: string;
  savedAt: number;
};

/** In-memory blob: URLs for the current tab (rebuilt from IDB when missing). */
const liveBlobUrls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TEXT_STORE)) {
        db.createObjectStore(TEXT_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function idbPut(store: string, row: object): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(row);
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

export async function cacheGet(key: string): Promise<TextRow | null> {
  return idbGet<TextRow>(TEXT_STORE, key);
}

export async function cacheSet(key: string, body: string, meta = ""): Promise<void> {
  await idbPut(TEXT_STORE, { key, body, meta, savedAt: Date.now() } satisfies TextRow);
}

async function blobCacheGet(key: string): Promise<BlobRow | null> {
  return idbGet<BlobRow>(BLOB_STORE, key);
}

async function blobCacheSet(key: string, blob: Blob, meta = ""): Promise<void> {
  await idbPut(BLOB_STORE, { key, blob, meta, savedAt: Date.now() } satisfies BlobRow);
}

function revokeLiveUrls() {
  for (const url of liveBlobUrls.values()) URL.revokeObjectURL(url);
  liveBlobUrls.clear();
}

export async function cacheClear(): Promise<void> {
  revokeLiveUrls();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([TEXT_STORE, BLOB_STORE], "readwrite");
      tx.objectStore(TEXT_STORE).clear();
      tx.objectStore(BLOB_STORE).clear();
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

/** Stale-while-revalidate for text (index / markdown / cover.json). */
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

function blobUrlFor(key: string, blob: Blob): string {
  const existing = liveBlobUrls.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  liveBlobUrls.set(key, url);
  return url;
}

/**
 * Stale-while-revalidate for binary assets (cover images).
 * Returns a blob: URL; persists Blob in IndexedDB across reloads.
 */
export async function cachedLoadBlobUrl(
  key: string,
  loader: () => Promise<Blob>,
  options?: { metaFromBlob?: (blob: Blob) => string },
): Promise<string> {
  const live = liveBlobUrls.get(key);
  if (live) {
    // Same tab already has a URL; only refresh IndexedDB for the next visit.
    void (async () => {
      try {
        const blob = await loader();
        const meta = options?.metaFromBlob?.(blob) ?? `${blob.type}:${blob.size}`;
        await blobCacheSet(key, blob, meta);
      } catch {
        /* keep live url */
      }
    })();
    return live;
  }

  const cached = await blobCacheGet(key);

  const network = (async () => {
    const blob = await loader();
    const meta = options?.metaFromBlob?.(blob) ?? `${blob.type}:${blob.size}`;
    await blobCacheSet(key, blob, meta);
    const prev = liveBlobUrls.get(key);
    if (prev) URL.revokeObjectURL(prev);
    liveBlobUrls.delete(key);
    const url = blobUrlFor(key, blob);
    if (!cached || cached.meta !== meta || cached.blob.size !== blob.size) {
      notifyCacheUpdated(key);
    }
    return url;
  })();

  if (cached?.blob) {
    void network.catch(() => {
      /* keep serving stale cache */
    });
    return blobUrlFor(key, cached.blob);
  }

  return network;
}
