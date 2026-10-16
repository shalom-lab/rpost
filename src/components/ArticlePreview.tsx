import { useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Link } from "react-router-dom";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  CONTENT_INDEX_CACHE_KEY,
  contentBodyCacheKey,
  type Article,
  fetchContent,
  fetchIndex,
} from "../lib/content";
import { CACHE_UPDATED } from "../lib/local-cache";
import "../styles/markmuse-default.css";

function withoutFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}

function articleUrlTransform(url: string) {
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(url)) return url;
  return defaultUrlTransform(url);
}

type Props = {
  articleId: string;
  /** 面板里显示「整页打开」；独立页可关掉 */
  showOpenPage?: boolean;
  /** 独立页书签 ?view=qmd */
  preferQmd?: boolean;
};

export default function ArticlePreview({
  articleId,
  showOpenPage = true,
  preferQmd = false,
}: Props) {
  const [article, setArticle] = useState<Article | null>(null);
  const [qmdText, setQmdText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [hasMd, setHasMd] = useState(false);
  const [wantQmd, setWantQmd] = useState(preferQmd);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWantQmd(preferQmd);
  }, [preferQmd, articleId]);

  useEffect(() => {
    let cancelled = false;
    let watchedKeys = new Set<string>([CONTENT_INDEX_CACHE_KEY]);
    setLoading(true);
    setError("");

    async function loadArticle() {
      try {
        const index = await fetchIndex();
        const found = index.articles.find((item) => item.id === articleId);
        if (!found?.qmd) throw new Error("找不到这篇文章的 QMD");

        watchedKeys = new Set([CONTENT_INDEX_CACHE_KEY, contentBodyCacheKey(found.qmd)]);
        if (found.md) watchedKeys.add(contentBodyCacheKey(found.md));

        const qmdBody = await fetchContent(found.qmd);
        let mdBody = "";
        let mdOk = false;
        if (found.md) {
          try {
            mdBody = withoutFrontmatter(await fetchContent(found.md));
            mdOk = Boolean(mdBody.trim());
          } catch {
            mdOk = false;
          }
        }

        if (!cancelled) {
          setArticle(found);
          setQmdText(qmdBody);
          setMarkdown(mdBody);
          setHasMd(mdOk);
          setError("");
        }
      } catch (reason) {
        if (!cancelled) {
          setArticle(null);
          setError(reason instanceof Error ? reason.message : "无法加载文章。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadArticle();
    function onCache(event: Event) {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key && watchedKeys.has(key)) void loadArticle();
    }
    window.addEventListener(CACHE_UPDATED, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_UPDATED, onCache);
    };
  }, [articleId]);

  if (loading) return <p className="reader-state">正在加载文章…</p>;
  if (error) return <p className="reader-state error">{error}</p>;
  if (!article) return null;

  const showMd = hasMd && !wantQmd;

  return (
    <div className="article-preview">
      <header className="article-toolbar">
        <div className="article-toolbar-main">
          <div className="article-meta">
            <span className="article-number">{article.date || article.id}</span>
            {article.category && <span>{article.category}</span>}
            {showOpenPage && (
              <Link
                className="article-open-page"
                to={`/article/${article.id}`}
                title="整页打开"
                aria-label="整页打开"
              >
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M6.5 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8A1.5 1.5 0 0 0 13 12.5V9.5M9 2h5v5M14 2 7.5 8.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            )}
          </div>
          {article.tags.length > 0 && (
            <div className="article-tags" aria-label="标签">
              {article.tags.map((tag) => (
                <span className="article-tag" key={tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="view-toggle" role="tablist" aria-label="源稿与渲染">
          {hasMd ? (
            <button
              type="button"
              className={`view-tab${showMd ? " active" : ""}`}
              role="tab"
              aria-selected={showMd}
              onClick={() => setWantQmd(false)}
            >
              MD
            </button>
          ) : (
            <span className="view-tab disabled" role="tab" aria-disabled="true" title="尚未渲染">
              MD
            </span>
          )}
          <button
            type="button"
            className={`view-tab${!showMd ? " active" : ""}`}
            role="tab"
            aria-selected={!showMd}
            onClick={() => setWantQmd(true)}
          >
            QMD
          </button>
        </div>
      </header>

      <section className="content-card" aria-label={showMd ? "已渲染 Markdown" : "原始 QMD"}>
        {showMd ? (
          <div id="markmuse" className="article-md">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} urlTransform={articleUrlTransform}>
              {markdown}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="qmd-source">
            <code>{qmdText}</code>
          </pre>
        )}
      </section>
    </div>
  );
}
