import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LS_GH_REPO, LS_GH_TOKEN, SETTINGS_CHANGED, probeGitHubAccess } from "./lib/github";
import { showToast } from "./lib/toast";

export default function RequireAccess({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [access, setAccess] = useState({ path: "", ok: false });
  const unlockedRef = useRef(false);

  useEffect(() => {
    let generation = 0;
    let disposed = false;

    async function check(reason: "route" | "settings" | "focus") {
      const current = ++generation;
      const alreadyUnlocked = unlockedRef.current;
      if (!alreadyUnlocked) {
        setAccess({ path: pathname, ok: false });
        if (reason !== "focus") showToast("正在验证访问权限…", "info");
      }
      const result = await probeGitHubAccess();
      if (disposed || current !== generation) return;
      unlockedRef.current = result.ok;
      setAccess({ path: pathname, ok: result.ok });
      if (result.ok) {
        if (!alreadyUnlocked) showToast(result.message || "已通过验证", "ok");
      } else {
        showToast(result.message || "验证失败，请填写或更新 Token", "error");
      }
    }

    function onSettingsChanged() {
      void check("settings");
    }
    function onStorage(event: StorageEvent) {
      if (!event.key || event.key === LS_GH_REPO || event.key === LS_GH_TOKEN) void check("settings");
    }
    function onFocus() {
      void check("focus");
    }

    void check("route");
    window.addEventListener(SETTINGS_CHANGED, onSettingsChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.removeEventListener(SETTINGS_CHANGED, onSettingsChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  if (access.path !== pathname || !access.ok) {
    return (
      <section className="connection-page">
        <header>
          <span className="eyebrow">访问</span>
          <h1>连接后阅读</h1>
          <p>验证状态在右上角提示。通过后自动进入；未通过请先填写 Token。</p>
        </header>
        <p className="connection-links">
          <Link to="/settings">填写或更新 Token</Link>
        </p>
      </section>
    );
  }

  return children;
}
