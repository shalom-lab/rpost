import { cachedLoadText } from "./local-cache";
import { fetchRepoText } from "./repo-content";

export type Article = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  categorySlug: string;
  tags: string[];
  qmd: string;
  md: string | null;
};

export type ContentIndex = {
  articles: Article[];
  updatedAt: string;
};

export const CONTENT_INDEX_CACHE_KEY = "content/index.json";

export function contentBodyCacheKey(relativePath: string): string {
  return `content/${relativePath.replace(/^\//, "")}`;
}

export async function fetchIndex(): Promise<ContentIndex> {
  const text = await cachedLoadText(
    CONTENT_INDEX_CACHE_KEY,
    () => fetchRepoText("content/index.json"),
    {
      metaFromBody: (body) => {
        try {
          return String((JSON.parse(body) as ContentIndex).updatedAt || "");
        } catch {
          return "";
        }
      },
    },
  );
  return JSON.parse(text) as ContentIndex;
}

/** relativePath is relative to content/, e.g. posts/<id>/file.md */
export async function fetchContent(relativePath: string): Promise<string> {
  const key = contentBodyCacheKey(relativePath);
  const clean = relativePath.replace(/^\//, "");
  return cachedLoadText(key, () => fetchRepoText(`content/${clean}`));
}
