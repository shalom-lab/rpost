import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ArticlePreview from "../components/ArticlePreview";
import { CONTENT_INDEX_CACHE_KEY, type Article, fetchIndex } from "../lib/content";
import { CACHE_UPDATED } from "../lib/local-cache";

const PAGE_SIZE = 12;

function categoryClass(slug: string | undefined): string {
  const key = String(slug || "").trim();
  if (!key) return "cat-other";
  return `cat-${key}`;
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedId = searchParams.get("id") || "";

  useEffect(() => {
    let cancelled = false;
    async function loadArticles() {
      try {
        const index = await fetchIndex();
        if (!cancelled) {
          setArticles(index.articles.filter((article) => article.qmd));
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "无法加载文章。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadArticles();
    function onCache(event: Event) {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key === CONTENT_INDEX_CACHE_KEY) void loadArticles();
    }
    window.addEventListener(CACHE_UPDATED, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_UPDATED, onCache);
    };
  }, []);

  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    for (const article of articles) {
      if (article.category) unique.set(article.categorySlug || article.category, article.category);
    }
    return [...unique.entries()];
  }, [articles]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category && (article.categorySlug || article.category) !== category) return false;
      if (!keyword) return true;
      return [article.title, article.description, article.category, ...article.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [articles, category, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, category]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (loading || error || !visible.length) return;
    if (selectedId && visible.some((item) => item.id === selectedId)) return;
    setSearchParams({ id: visible[0].id }, { replace: true });
  }, [loading, error, visible, selectedId, setSearchParams]);

  function selectArticle(id: string) {
    setSearchParams({ id }, { replace: true });
  }

  return (
    <div className="library-split">
      <aside className="library-pane" aria-label="文章列表">
        <section className="library-tools" aria-label="文章筛选">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、内容或标签…"
            aria-label="搜索文章"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="按分类筛选"
          >
            <option value="">全部分类</option>
            {categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
        </section>

        {loading && <p className="reader-state">正在加载文章…</p>}
        {error && <p className="reader-state error">{error}</p>}
        {!loading && !error && !visible.length && (
          <p className="reader-state">没有匹配的文章。</p>
        )}

        <div className="article-list compact">
          {pageItems.map((article) => {
            const active = article.id === selectedId;
            const cat = categoryClass(article.categorySlug || article.category);
            return (
              <div
                className={`article-card ${cat}${active ? " active" : ""}`}
                key={article.id}
              >
                <button
                  type="button"
                  className="article-card-main"
                  onClick={() => selectArticle(article.id)}
                >
                  <span className="article-number">{article.date || article.id}</span>
                  <div>
                    <h2>{article.title}</h2>
                    <p>{article.description}</p>
                    <div className="article-meta">
                      {article.category && <span>{article.category}</span>}
                      {article.md
                        ? <span className="source-badge soft">已渲染 MD</span>
                        : <span className="source-muted">仅 QMD</span>}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {visible.length > PAGE_SIZE && (
          <nav className="library-pager" aria-label="文章翻页">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span>{safePage} / {pageCount}</span>
            <button
              type="button"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              下一页
            </button>
          </nav>
        )}
      </aside>

      <section className="library-detail" aria-label="文章预览">
        {selectedId ? (
          <ArticlePreview articleId={selectedId} showOpenPage />
        ) : (
          <p className="reader-state">从左侧点一篇文章预览。</p>
        )}
      </section>
    </div>
  );
}
