import { useEffect, useMemo, useState } from "react";
import { CONTENT_INDEX_CACHE_KEY, fetchIndex } from "../lib/content";
import { COVER_INDEX_CACHE_KEY, fetchCovers, loadCoverImageUrl, type CoverItem } from "../lib/covers";
import { CACHE_UPDATED } from "../lib/local-cache";
import { showToast } from "../lib/toast";

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

/** 给 AGENT 的批量补封面提示：按当前待补充列表动态生成。 */
function pendingCoverBrief(items: CoverItem[]): string {
  const lines = items.map((item, index) => `${index + 1}. \`${item.id}\`　${item.title}`);
  return [
    "请按照 cover/AGENTS.md 里的要求，为下列文章制作封面：",
    "",
    ...lines,
    "",
    "逐篇先读正文再出图；合格后写入 cover/images/ 并更新 cover/cover.json（active: true）。",
  ].join("\n");
}

function formatRatio(width: number, height: number): string {
  if (!width || !height) return "—";
  const g = gcd(width, height);
  const a = width / g;
  const b = height / g;
  if (a <= 100 && b <= 100) return `${a}:${b}`;
  return `${(width / height).toFixed(2)}:1`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function needsCover(item: CoverItem): boolean {
  return !item.image || !item.active;
}

type Preview = { src: string; title: string };

function CoverCard({
  item,
  onPreview,
}: {
  item: CoverItem;
  onPreview: (preview: Preview | null) => void;
}) {
  const [copied, setCopied] = useState<"id" | "title" | "">("");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const pending = needsCover(item);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setSize(null);
    if (pending || !item.image) return;
    void loadCoverImageUrl(item.image)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [item.image, pending]);

  async function copy(kind: "id" | "title", text: string) {
    try {
      await copyText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  }

  return (
    <article className={`cover-card${pending ? " pending" : ""}`}>
      {src && !pending ? (
        <button
          type="button"
          className="cover-card-media"
          onClick={() => onPreview({ src, title: item.title })}
        >
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            onLoad={(event) => {
              const img = event.currentTarget;
              setSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
        </button>
      ) : (
        <div className="cover-card-media cover-card-pending-media" aria-label="封面待补充">
          <div className="cover-card-empty">待补充</div>
        </div>
      )}
      <div className="cover-card-body">
        <code className="cover-id" title={item.id}>{item.id}</code>
        <h2 title={item.title}>{item.title}</h2>
        <div className="cover-card-actions">
          <button type="button" onClick={() => void copy("id", item.id)}>
            {copied === "id" ? "已复制" : "复制 id"}
          </button>
          <button type="button" onClick={() => void copy("title", item.title)}>
            {copied === "title" ? "已复制" : "复制标题"}
          </button>
        </div>
        <p className="cover-card-meta">
          {pending
            ? (item.note || "封面未配置")
            : size
              ? `长宽比 ${formatRatio(size.w, size.h)} · ${size.w}×${size.h}`
              : "尺寸读取中…"}
        </p>
      </div>
    </article>
  );
}

export default function CoverPage() {
  const [covers, setCovers] = useState<CoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCovers() {
      try {
        const [index, coverIndex] = await Promise.all([fetchIndex(), fetchCovers()]);
        const byId = new Map(coverIndex.covers.map((row) => [row.id, row]));
        const merged: CoverItem[] = (index.articles || [])
          .filter((article) => article.qmd)
          .map((article) => {
            const row = byId.get(article.id);
            byId.delete(article.id);
            if (row) {
              return {
                ...row,
                title: article.title || row.title,
              };
            }
            return {
              id: article.id,
              title: article.title,
              image: null,
              active: false,
              prompt: null,
              note: "待补充",
            };
          });
        // cover.json 里多出的旧 id 仍展示，方便清理
        for (const row of byId.values()) merged.push(row);

        if (!cancelled) {
          setCovers(merged);
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "无法加载封面。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCovers();
    function onCache(event: Event) {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key === COVER_INDEX_CACHE_KEY || key === CONTENT_INDEX_CACHE_KEY) void loadCovers();
    }
    window.addEventListener(CACHE_UPDATED, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_UPDATED, onCache);
    };
  }, []);

  useEffect(() => {
    if (!preview) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const ordered = useMemo(() => {
    return [...covers].sort((a, b) => {
      const ap = needsCover(a) ? 0 : 1;
      const bp = needsCover(b) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return b.id.localeCompare(a.id);
    });
  }, [covers]);

  const pendingItems = useMemo(() => ordered.filter(needsCover), [ordered]);
  const pending = pendingItems.length;
  const ready = ordered.length - pending;
  const [copiedBrief, setCopiedBrief] = useState(false);

  async function copyPendingBrief() {
    if (!pendingItems.length) return;
    try {
      await copyText(pendingCoverBrief(pendingItems));
      setCopiedBrief(true);
      showToast(`已复制 ${pendingItems.length} 篇待补充封面提示`, "ok");
      window.setTimeout(() => setCopiedBrief(false), 1500);
    } catch {
      showToast("复制失败", "error");
    }
  }

  return (
    <section className="cover-page">
      <header className="cover-page-header">
        <div className="cover-page-header-text">
          <span className="eyebrow">公众号</span>
          <h1>封面预览</h1>
          <p>
            对照文章清单与 <code>cover/cover.json</code>。无图或未启用的显示「待补充」；有图可点放大，按钮复制 id / 标题。
            {ordered.length > 0 && ` 合计 ${ordered.length} · 已有 ${ready} · 待补充 ${pending}。`}
          </p>
        </div>
        {pending > 0 && (
          <button
            type="button"
            className={`cover-copy-pending${copiedBrief ? " copied" : ""}`}
            onClick={() => void copyPendingBrief()}
            title={`复制待补充封面提示（${pending}）`}
            aria-label={`复制待补充封面提示，共 ${pending} 篇`}
          >
            {copiedBrief ? (
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="5" y="5" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M3.5 10.5V3.5A1 1 0 0 1 4.5 2.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            )}
          </button>
        )}
      </header>

      {loading && <p className="reader-state">正在加载封面…</p>}
      {error && <p className="reader-state error">{error}</p>}
      {!loading && !error && !ordered.length && <p className="reader-state">还没有文章。</p>}

      <div className="cover-grid">
        {ordered.map((item) => (
          <CoverCard key={item.id} item={item} onPreview={setPreview} />
        ))}
      </div>

      {preview && (
        <div className="cover-lightbox" role="dialog" aria-label={preview.title} onClick={() => setPreview(null)}>
          <figure className="cover-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <img src={preview.src} alt={preview.title} />
            <figcaption>{preview.title}</figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
