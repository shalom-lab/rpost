import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ArticlePreview from "../components/ArticlePreview";
import { CONTENT_INDEX_CACHE_KEY, type Article, fetchIndex } from "../lib/content";
import { CACHE_UPDATED } from "../lib/local-cache";
import { fetchWeChatPostStates, type WeChatPostState, type WeChatPostStatus } from "../lib/wechat-posts";

const PAGE_SIZE = 12;
const STATUSES: WeChatPostStatus[] = ["未上传", "已上传", "已发表"];

function categoryClass(slug: string | undefined): string {
  const key = String(slug || "").trim();
  if (!key) return "cat-other";
  return `cat-${key}`;
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [postStates, setPostStates] = useState<WeChatPostState[]>([]);
  const [query, setQuery] = useState("");
  const [categoriesSelected, setCategoriesSelected] = useState<string[]>([]);
  const [activeStatus, setActiveStatus] = useState<WeChatPostStatus>("未上传");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedId = searchParams.get("id") || "";

  useEffect(() => {
    let cancelled = false;
    async function loadArticles() {
      try {
        const [index, states] = await Promise.all([fetchIndex(), fetchWeChatPostStates()]);
        if (!cancelled) {
          setArticles(index.articles.filter((article) => article.qmd));
          setPostStates(states);
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
    window.addEventListener("focus", loadArticles);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_UPDATED, onCache);
      window.removeEventListener("focus", loadArticles);
    };
  }, []);

  const categories = useMemo(() => {
    const unique = new Map<string, string>();
    for (const article of articles) {
      if (article.category) unique.set(article.categorySlug || article.category, article.category);
    }
    return [...unique.entries()];
  }, [articles]);

  const statusById = useMemo(() => new Map(postStates.map((state) => [state.id, state.status])), [postStates]);
  const statusCounts = useMemo(() => STATUSES.map((status) => ({
    status,
    count: articles.filter((article) => statusById.get(article.id) === status).length,
  })), [articles, statusById]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (statusById.get(article.id) !== activeStatus) return false;
      if (categoriesSelected.length && !categoriesSelected.includes(article.categorySlug || article.category)) return false;
      if (!keyword) return true;
      return [article.title, article.description, article.category, ...article.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [articles, statusById, activeStatus, categoriesSelected, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const activeId = visible.some((item) => item.id === selectedId) ? selectedId : visible[0]?.id || "";

  useEffect(() => {
    if (loading || error || activeId === selectedId) return;
    setSearchParams(activeId ? { id: activeId } : {}, { replace: true });
  }, [loading, error, activeId, selectedId, setSearchParams]);

  function toggleCategory(slug: string) {
    setCategoriesSelected((current) => current.includes(slug)
      ? current.filter((value) => value !== slug)
      : [...current, slug]);
    setPage(1);
  }

  function selectArticle(id: string) {
    setSearchParams({ id }, { replace: true });
  }

  return (
    <div className="library-split">
      <aside className="library-pane" aria-label="文章列表">
        <div className="library-status-tabs" role="tablist" aria-label="公众号文章状态">
          {statusCounts.map(({ status, count }) => (
            <button
              key={status}
              id={`library-tab-${status}`}
              type="button"
              role="tab"
              aria-selected={activeStatus === status}
              aria-controls="library-article-list"
              tabIndex={activeStatus === status ? 0 : -1}
              onClick={() => { setActiveStatus(status); setPage(1); }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const index = STATUSES.indexOf(status);
                const next = STATUSES[(index + (event.key === "ArrowRight" ? 1 : -1) + STATUSES.length) % STATUSES.length];
                setActiveStatus(next);
                setPage(1);
                document.getElementById(`library-tab-${next}`)?.focus();
              }}
            >
              {status}<span className="library-tab-count">{count}</span>
            </button>
          ))}
        </div>
        <section className="library-tools" aria-label="文章筛选">
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="搜索标题、内容或标签…"
            aria-label="搜索文章"
          />
          <div className="library-category-tags" role="group" aria-label="按分类筛选，可多选">
            {categories.map(([slug, name]) => (
              <button
                key={slug}
                type="button"
                className={`library-category-tag ${categoryClass(slug)}`}
                aria-pressed={categoriesSelected.includes(slug)}
                onClick={() => toggleCategory(slug)}
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        {loading && <p className="reader-state">正在加载文章…</p>}
        {error && <p className="reader-state error">{error}</p>}
        {!loading && !error && !visible.length && (
          <p className="reader-state">没有匹配的文章。</p>
        )}

        <div className="article-list compact" id="library-article-list" role="tabpanel" aria-labelledby={`library-tab-${activeStatus}`}>
          {pageItems.map((article) => {
            const active = article.id === activeId;
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
        {activeId ? (
          <ArticlePreview articleId={activeId} showOpenPage />
        ) : (
          <p className="reader-state">从左侧点一篇文章预览。</p>
        )}
      </section>
    </div>
  );
}
