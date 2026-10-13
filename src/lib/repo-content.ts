import { loadSettings, parseRepoFull } from "./github";

const DEFAULT_REPO = "shalom-lab/r-post";

function authHeaders(pat: string): HeadersInit {
  return {
    Accept: "application/vnd.github.raw+json",
    Authorization: `Bearer ${pat}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function repoParts() {
  const { repoFull, pat } = loadSettings();
  const token = pat.trim();
  if (!token) throw new Error("请先填写 GitHub Token。");
  const full = (repoFull || DEFAULT_REPO).trim() || DEFAULT_REPO;
  const { owner, repo } = parseRepoFull(full);
  return { owner, repo, token, repoFull: `${owner}/${repo}` };
}

/** Read a text file from the private content repo (BYOK). Never ships .md in this site repo. */
export async function fetchRepoText(path: string): Promise<string> {
  const { owner, repo, token } = repoParts();
  const clean = path.replace(/^\/+/, "");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${clean}`;
  const response = await fetch(url, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("Token 无效或无权读取内容仓库。");
  if (response.status === 404) throw new Error(`内容不存在：${clean}`);
  if (!response.ok) throw new Error(`无法读取内容（${response.status}）`);
  return response.text();
}

/** Read a binary file as Blob (for IndexedDB + blob: URL). */
export async function fetchRepoBlob(path: string): Promise<Blob> {
  const { owner, repo, token } = repoParts();
  const clean = path.replace(/^\/+/, "");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${clean}`;
  const response = await fetch(url, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("Token 无效或无权读取内容仓库。");
  if (response.status === 404) throw new Error(`图片不存在：${clean}`);
  if (!response.ok) throw new Error(`无法读取图片（${response.status}）`);
  const buffer = await response.arrayBuffer();
  const mime = response.headers.get("content-type") || "application/octet-stream";
  return new Blob([buffer], { type: mime });
}
