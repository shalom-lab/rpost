import RequireAccess from "./RequireAccess";
import ToastHost from "./ToastHost";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import ArticlePage from "./pages/ArticlePage";
import CoverPage from "./pages/CoverPage";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";

function GitHubIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function App() {
  return (
    <div className="reader-shell">
      <header className="reader-topbar">
        <Link className="reader-brand" to="/">
          <span>R</span>
          <div><strong>RPost</strong><small>R 语言短教程</small></div>
        </Link>
        <div className="reader-actions">
          <nav className="reader-nav" aria-label="主导航">
            <NavLink to="/" end>文章</NavLink>
            <NavLink to="/covers">封面</NavLink>
            <NavLink to="/settings">连接</NavLink>
          </nav>
          <a className="reader-github" href="https://github.com/shalom-lab/rpost" target="_blank" rel="noreferrer" aria-label="打开阅读站仓库">
            <GitHubIcon /><span>GitHub</span>
          </a>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<RequireAccess><HomePage /></RequireAccess>} />
          <Route path="/articles" element={<Navigate to="/" replace />} />
          <Route path="/article/:id" element={<RequireAccess><ArticlePage /></RequireAccess>} />
          <Route path="/topics" element={<Navigate to="/" replace />} />
          <Route path="/covers" element={<RequireAccess><CoverPage /></RequireAccess>} />
          <Route path="/queue" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="reader-footer">RPost · 个人文稿后台</footer>
      <ToastHost />
    </div>
  );
}
