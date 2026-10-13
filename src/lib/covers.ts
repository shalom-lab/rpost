import { cachedLoadBlobUrl, cachedLoadText } from "./local-cache";
import { fetchRepoBlob, fetchRepoText } from "./repo-content";

export type CoverItem = {
  id: string;
  title: string;
  image: string | null;
  active: boolean;
  prompt: string | null;
  note: string | null;
};

export type CoverIndex = {
  covers: CoverItem[];
  updatedAt: string | null;
};

export const COVER_INDEX_CACHE_KEY = "cover/cover.json";

export async function fetchCovers(): Promise<CoverIndex> {
  const text = await cachedLoadText(
    COVER_INDEX_CACHE_KEY,
    () => fetchRepoText("cover/cover.json"),
    {
      metaFromBody: (body) => {
        try {
          return String((JSON.parse(body) as CoverIndex).updatedAt || "");
        } catch {
          return "";
        }
      },
    },
  );
  const data = JSON.parse(text) as CoverIndex;
  return {
    covers: Array.isArray(data.covers) ? data.covers : [],
    updatedAt: data.updatedAt ?? null,
  };
}

/** Repo-relative cover image path for authenticated blob fetch. */
export function coverRepoPath(image: string | null): string | null {
  if (!image) return null;
  const rel = image.replace(/^\.\//, "").replace(/^\/+/, "");
  return `cover/${rel}`;
}

export async function loadCoverImageUrl(image: string | null): Promise<string | null> {
  const path = coverRepoPath(image);
  if (!path) return null;
  return cachedLoadBlobUrl(`blob:${path}`, () => fetchRepoBlob(path));
}
