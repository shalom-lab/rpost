import { useEffect, useState, type ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";
import { LS_GH_REPO, LS_GH_TOKEN, SETTINGS_CHANGED, probeGitHubAccess } from "./lib/github";
import { showToast } from "./lib/toast";

/** Session unlock: survives route changes; cleared when Token/settings change. */
let sessionUnlocked = false;

export default function RequireAccess({ children }: { children?: ReactNode }) {
  const [ok, setOk] = useState(sessionUnlocked);
  const [ready, setReady] = useState(sessionUnlocked);

  useEffect(() => {
    let generation = 0;
    let disposed = false;

    async function check(reason: "boot" | "settings" | "focus") {
      const current = ++generation;
      const already = sessionUnlocked;

      if (reason === "settings") {
        sessionUnlocked = false;
        setOk(false);
        setReady(false);
      }

      if (!already && reason !== "focus") {
        showToast("正在验证访问权限…", "info");
      }

      const result = await probeGitHubAccess();
      if (disposed || current !== generation) return;

      sessionUnlocked = result.ok;
      setOk(result.ok);
      setReady(true);

      if (result.ok) {
        if (!already) showToast(result.message || "已通过验证", "ok");
      } else if (reason !== "focus" || already) {
        showToast(result.message || "验证失败，请填写或更新 Token", "error");
      }
    }

    function onSettingsChanged() {
      void check("settings");
    }
    function onStorage(event: StorageEvent) {
      if (!event.key || event.key === LS_GH_REPO || event.key === LS_GH_TOKEN) {
        void check("settings");
      }
    }
    function onFocus() {
      void check("focus");
    }

    if (sessionUnlocked) {
      setOk(true);
      setReady(true);
    } else {
      void check("boot");
    }

    window.addEventListener(SETTINGS_CHANGED, onSettingsChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.removeEventListener(SETTINGS_CHANGED, onSettingsChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!ready || !ok) {
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

  return children ?? <Outlet />;
}
