# RPost 阅读站（rpost）

GitHub Pages 部署的前端壳：**不包含文章 Markdown / QMD 源文件。**封面页可用发布者的 BYOK Token 发起微信草稿上传请求；上传仍由内容仓 Action 执行。

正文、清单、封面图均在验证通过后，用浏览器里的 BYOK Token 经 GitHub Contents API 从私有内容仓（默认 `shalom-lab/r-post`）拉取。

## 本地

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run test:access
```

生产 base：`/rpost/` → `https://shalom-lab.github.io/rpost/`

## BYOK（localStorage）

| 键 | 含义 |
|---|---|
| `gh-repo-rpost` | 内容仓 `owner/repo`，默认填 `shalom-lab/r-post` |
| `gh-token-rpost` | 阅读需要内容仓 `Contents: read`；封面页触发草稿上传还需要 `Actions: write` 的 PAT |

可在「连接」页填写，也可事先写入 localStorage；启动会自动读。Token 不进仓库、不进前端打包。

封面页从内容仓的 `wechat/all-posts-state.json` 读取「未上传 / 已上传 / 已发表」状态。未上传且封面可用的卡片可触发 `wechat-draft.yml`，只传文章 ID，不指定主题；GitHub 接受请求后会提示已提交，状态以内容仓台账和后续状态清单更新为准。

## IndexedDB 持久化

库名 `rpost-cache-v2`：

| Store | 内容 |
|---|---|
| `entries` | `content/index.json`、正文 Markdown、`cover/cover.json` 等文本 |
| `blobs` | 封面图等二进制 |

策略：先读本地缓存立刻展示，再后台打 GitHub API 校验；有变更才刷新 UI。连接页可「清除阅读缓存」。

## 与内容仓分工

| 仓库 | 职责 |
|---|---|
| `r-post`（宜私有） | 选题、QMD、渲染、封面、公众号脚本 |
| `rpost`（本仓） | 阅读 UI、白名单、草稿 Action 触发入口、Pages |

把 `r-post` 设为私有后，未授权用户既看不到源仓，也看不到 Pages 上的 Markdown（因为根本没有部署上去）。
