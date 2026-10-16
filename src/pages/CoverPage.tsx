import { useEffect, useMemo, useRef, useState } from "react";
import { COVER_INDEX_CACHE_KEY, fetchCovers, loadCoverImageUrl, type CoverItem } from "../lib/covers";
import { CACHE_UPDATED } from "../lib/local-cache";
import { showToast } from "../lib/toast";
import { dispatchWeChatDraft, fetchWeChatPostStates, type WeChatPostState, type WeChatPostStatus } from "../lib/wechat-posts";

const STATUSES: WeChatPostStatus[] = ["未上传", "已上传", "已发表"];
type PostCard = { state: WeChatPostState; item: CoverItem };
type UploadState = "sending" | "queued";

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
  state,
  onPreview,
  onUpload,
  uploadState,
}: {
  item: CoverItem;
  state: WeChatPostState;
  onPreview: (preview: Preview | null) => void;
  onUpload: (state: WeChatPostState) => void;
  uploadState?: UploadState;
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
      {!pending && src ? (
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
      ) : !pending ? (
        <div className="cover-card-media cover-card-loading-media" aria-label="封面加载中">
          <div className="cover-card-empty">加载中…</div>
        </div>
      ) : (
        <div className="cover-card-media cover-card-pending-media" aria-label="封面待补充">
          <div className="cover-card-empty">待补充</div>
        </div>
      )}
      <div className="cover-card-body">
        <code className="cover-id" title={item.id}>{item.id}</code>
        <h2 title={item.title}>{item.title}</h2>
        <span className="cover-card-status">{state.date} · {state.status}</span>
        <div className="cover-card-actions">
          <button type="button" onClick={() => void copy("id", item.id)}>
            {copied === "id" ? "已复制" : "复制 id"}
          </button>
          <button type="button" onClick={() => void copy("title", item.title)}>
            {copied === "title" ? "已复制" : "复制标题"}
          </button>
          {state.status === "未上传" && !pending && src && size && (
            <button
              type="button"
              className="cover-upload-action"
              disabled={Boolean(uploadState)}
              onClick={() => onUpload(state)}
              title={uploadState === "sending" ? "正在提交上传请求" : uploadState === "queued" ? "上传请求已提交" : "上传到微信草稿"}
              aria-label={`${item.title}：${uploadState === "sending" ? "正在提交上传请求" : uploadState === "queued" ? "上传请求已提交" : "上传到微信草稿"}`}
            >
              {uploadState === "queued" ? (
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3.2 3.2L13 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 10V2.5m0 0L5.2 5.3M8 2.5l2.8 2.8M3 10.5v2.2c0 .7.6 1.3 1.3 1.3h7.4c.7 0 1.3-.6 1.3-1.3v-2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </button>
          )}
        </div>
        <p className="cover-card-meta">
          {pending
            ? (item.note || "封面未配置")
            : size
              ? `长宽比 ${formatRatio(size.w, size.h)} · ${size.w}×${size.h}`
              : src
                ? "尺寸读取中…"
                : "封面加载中…"}
        </p>
      </div>
    </article>
  );
}

export default function CoverPage() {
  const [cards, setCards] = useState<PostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const submitted = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    async function loadCards() {
      try {
        const [states, coverIndex] = await Promise.all([fetchWeChatPostStates(), fetchCovers()]);
        const byId = new Map(coverIndex.covers.map((row) => [row.id, row]));
        const merged: PostCard[] = states.map((state) => {
          const row = byId.get(state.id);
          return {
            state,
            item: row
              ? { ...row, title: state.title }
              : { id: state.id, title: state.title, image: null, active: false, prompt: null, note: "待补充" },
          };
        });

        if (!cancelled) {
          setCards(merged);
          setError("");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "无法加载封面。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCards();
    function onCache(event: Event) {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key === COVER_INDEX_CACHE_KEY) void loadCards();
    }
    window.addEventListener(CACHE_UPDATED, onCache);
    window.addEventListener("focus", loadCards);
    return () => {
      cancelled = true;
      window.removeEventListener(CACHE_UPDATED, onCache);
      window.removeEventListener("focus", loadCards);
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

  const sections = useMemo(() => STATUSES.map((status) => ({
    status,
    cards: cards.filter(({ state }) => state.status === status),
  })), [cards]);
  const pendingItems = useMemo(() => cards.map(({ item }) => item).filter(needsCover), [cards]);
  const pending = pendingItems.length;
  const ready = cards.length - pending;
  const [copiedBrief, setCopiedBrief] = useState(false);

  async function uploadDraft(state: WeChatPostState) {
    if (submitted.current.has(state.id)) return;
    submitted.current.add(state.id);
    setUploadStates((current) => ({ ...current, [state.id]: "sending" }));
    try {
      await dispatchWeChatDraft(state.id);
      setUploadStates((current) => ({ ...current, [state.id]: "queued" }));
      showToast(`GitHub 已接收「${state.title}」的草稿上传请求。`, "ok");
    } catch (reason) {
      submitted.current.delete(state.id);
      setUploadStates((current) => {
        const next = { ...current };
        delete next[state.id];
        return next;
      });
      showToast(reason instanceof Error ? reason.message : "提交草稿上传请求失败。", "error");
    }
  }

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
          <h1>封面与公众号状态</h1>
          <p>
            文章状态来自 <code>wechat/all-posts-state.json</code>，封面来自 <code>cover/cover.json</code>。无图或未启用的显示「待补充」；未上传且封面完整的文章可提交微信草稿上传请求。
            {cards.length > 0 && ` 合计 ${cards.length} · 封面已有 ${ready} · 待补充 ${pending}。`}
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
      {!loading && !error && !cards.length && <p className="reader-state">还没有文章。</p>}

      {!loading && !error && sections.map(({ status, cards: sectionCards }) => (
        <section className="cover-status-section" key={status} aria-label={`${status}文章`}>
          <h2>{status}<span>{sectionCards.length}</span></h2>
          {sectionCards.length ? (
            <div className="cover-grid">
              {sectionCards.map(({ item, state }) => (
                <CoverCard
                  key={item.id}
                  item={item}
                  state={state}
                  onPreview={setPreview}
                  onUpload={(post) => void uploadDraft(post)}
                  uploadState={uploadStates[item.id]}
                />
              ))}
            </div>
          ) : <p className="cover-status-empty">暂无{status}文章。</p>}
        </section>
      ))}

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
