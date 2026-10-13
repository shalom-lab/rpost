import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import ArticlePreview from "../components/ArticlePreview";

/** Old serial article ids → new YYYYMMDD-slug folder ids (keep old links alive). */
const LEGACY_ARTICLE_REDIRECTS: Record<string, string> = {
  "002": "20260921-r-save-five-methods",
  "003": "20260921-regex-real-world",
  "004": "20260927-batch-read-without-for",
  "005": "20260927-regex-extract-data",
};

export default function ArticlePage() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const legacyTarget = rawId ? LEGACY_ARTICLE_REDIRECTS[rawId] : undefined;
  const id = legacyTarget || rawId;

  useEffect(() => {
    if (!id || legacyTarget) return;
    if (searchParams.get("view") === "md") {
      navigate(`/article/${id}`, { replace: true });
    }
  }, [id, legacyTarget, searchParams, navigate]);

  if (legacyTarget) {
    const search = searchParams.toString();
    return (
      <Navigate
        to={search ? `/article/${legacyTarget}?${search}` : `/article/${legacyTarget}`}
        replace
      />
    );
  }

  if (!id) {
    return (
      <div className="reader-state error">
        <p>缺少文章 id。</p>
        <Link to="/">返回文章列表</Link>
      </div>
    );
  }

  return (
    <article className="reader-article">
      <Link className="reader-back" to={`/?id=${encodeURIComponent(id)}`}>
        ← 返回文章列表
      </Link>
      <ArticlePreview
        articleId={id}
        showOpenPage={false}
        preferQmd={searchParams.get("view") === "qmd"}
      />
    </article>
  );
}
