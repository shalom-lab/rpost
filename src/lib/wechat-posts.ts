import { loadSettings, parseRepoFull } from "./github";
import { fetchRepoText } from "./repo-content";

export type WeChatPostStatus = "未上传" | "已上传" | "已发表";

export type WeChatPostState = {
  id: string;
  title: string;
  date: string;
  status: WeChatPostStatus;
};

const PUBLISH_REPO = "shalom-lab/r-post";

export async function fetchWeChatPostStates(): Promise<WeChatPostState[]> {
  const rows: unknown = JSON.parse(await fetchRepoText("wechat/all-posts-state.json"));
  if (!Array.isArray(rows)) throw new Error("公众号文章状态清单格式不正确。");
  const states = rows.filter((row): row is WeChatPostState => {
    if (!row || typeof row !== "object") return false;
    const item = row as Record<string, unknown>;
    return typeof item.id === "string"
      && typeof item.title === "string"
      && typeof item.date === "string"
      && ["未上传", "已上传", "已发表"].includes(String(item.status));
  });
  if (states.length !== rows.length) throw new Error("公众号文章状态清单中有无效记录。");
  return states;
}

/** GitHub 接收请求只表示 Action 已排队，不表示微信草稿已上传。 */
export async function dispatchWeChatDraft(articleId: string): Promise<void> {
  const { repoFull, pat } = loadSettings();
  if (!pat.trim()) throw new Error("请先在连接页填写 GitHub Token。");
  const { owner, repo } = parseRepoFull(repoFull || PUBLISH_REPO);
  if (`${owner}/${repo}`.toLowerCase() !== PUBLISH_REPO) {
    throw new Error(`草稿上传仅支持内容仓 ${PUBLISH_REPO}。`);
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${PUBLISH_REPO}/actions/workflows/wechat-draft.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${pat.trim()}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "master", inputs: { article_id: articleId } }),
        cache: "no-store",
      },
    );
  } catch {
    throw new Error("无法连接 GitHub，请检查网络后重试。");
  }
  if (response.ok) return;
  if (response.status === 401) throw new Error("GitHub Token 无效或已失效。");
  if (response.status === 403) throw new Error("Token 无权触发草稿上传，请检查 Actions: write 权限。");
  if (response.status === 404) throw new Error("找不到草稿工作流，或 Token 无权访问内容仓。");
  const data = await response.json().catch(() => null) as { message?: string } | null;
  throw new Error(`触发草稿上传失败（${response.status}）${data?.message ? `：${data.message}` : "。"}`);
}
