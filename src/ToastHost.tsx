import { useEffect, useState } from "react";
import { TOAST_EVENT, type ToastDetail } from "./lib/toast";

const TTL_MS = 3200;

export default function ToastHost() {
  const [items, setItems] = useState<ToastDetail[]>([]);

  useEffect(() => {
    const timers = new Map<number, number>();

    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      setItems((prev) => [...prev.slice(-4), detail]);
      const timer = window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== detail.id));
        timers.delete(detail.id);
      }, TTL_MS);
      timers.set(detail.id, timer);
    }

    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast-item toast-${item.kind}`} role="status">
          {item.message}
        </div>
      ))}
    </div>
  );
}
