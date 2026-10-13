# RPost 阅读站（rpost）

只读前端壳：GitHub Pages 部署本仓库。**不包含文章 Markdown / QMD 源文件。**

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
| `gh-token-rpost` | 有 `contents:read` 的 PAT |

可在「连接」页填写，也可事先写入 localStorage；启动会自动读。Token 不进仓库、不进前端打包。

## 与内容仓分工

| 仓库 | 职责 |
|---|---|
| `r-post`（宜私有） | 选题、QMD、渲染、封面、公众号脚本 |
| `rpost`（本仓） | 阅读 UI、白名单、Pages |

把 `r-post` 设为私有后，未授权用户既看不到源仓，也看不到 Pages 上的 Markdown（因为根本没有部署上去）。
