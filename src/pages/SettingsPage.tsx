import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LS_GH_REPO,
  LS_GH_TOKEN,
  loadSettings,
  probeGitHubAccess,
  saveSettings,
} from "../lib/github";
import { cacheClear } from "../lib/local-cache";
import { showToast } from "../lib/toast";

export default function SettingsPage() {
  const [settings, setSettings] = useState(loadSettings);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function testConnection() {
    setBusy(true);
    setOk(false);
    try {
      saveSettings(settings);
      showToast("正在验证…", "info");
      const result = await probeGitHubAccess(settings);
      setOk(result.ok);
      showToast(result.message, result.ok ? "ok" : "error");
    } catch (reason) {
      setOk(false);
      showToast(reason instanceof Error ? reason.message : "验证失败", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="connection-page">
      <header>
        <span className="eyebrow">连接</span>
        <h1>GitHub 连接</h1>
        <p>本站（rpost）只部署阅读壳，不附带 Markdown 源文件。填写获准账号的 Token 与私有内容仓 <code>owner/repo</code>（默认 <code>shalom-lab/r-post</code>），经 GitHub API 拉取清单与正文。Token 只保存在当前浏览器，不改仓库。公众号草稿/群发仍在内容仓脚本处理。</p>
      </header>
      <div className="connection-panel">
        <label>
          GitHub 仓库
          <input
            disabled={busy}
            value={settings.repoFull}
            onChange={(event) => { setOk(false); setSettings({ ...settings, repoFull: event.target.value }); }}
            placeholder="shalom-lab/r-post"
          />
        </label>
        <label>
          GitHub Personal Access Token
          <input
            disabled={busy}
            type="password"
            value={settings.pat}
            onChange={(event) => { setOk(false); setSettings({ ...settings, pat: event.target.value }); }}
            placeholder="github_pat_..."
            autoComplete="off"
          />
        </label>
        <div className="connection-actions">
          <button disabled={busy} onClick={testConnection}>
            {busy ? "验证中…" : "保存并验证"}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              const cleared = { ...settings, pat: "" };
              saveSettings(cleared);
              setSettings(cleared);
              setOk(false);
              showToast("已清除 Token。", "info");
            }}
          >
            清除 Token
          </button>
          <button
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await cacheClear();
                  setOk(true);
                  showToast("已清除文章/封面本地缓存。", "ok");
                } catch (reason) {
                  setOk(false);
                  showToast(reason instanceof Error ? reason.message : "清除缓存失败。", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            清除阅读缓存
          </button>
        </div>
        {ok && (
          <p className="connection-ok">
            <Link to="/">进入文章</Link>
          </p>
        )}
        <details>
          <summary>本地设置</summary>
          <p><code>{LS_GH_REPO}</code> 与 <code>{LS_GH_TOKEN}</code> 分别保存仓库和 Token。</p>
          <p>文章清单、正文、封面清单缓存在浏览器 IndexedDB；有更新会后台校验并刷新。Token 不进 IndexedDB。</p>
        </details>
      </div>
    </section>
  );
}
