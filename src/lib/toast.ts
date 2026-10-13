export const TOAST_EVENT = "rpost-toast";

export type ToastKind = "ok" | "error" | "info";

export type ToastDetail = {
  id: number;
  message: string;
  kind: ToastKind;
};

let toastSeq = 0;

export function showToast(message: string, kind: ToastKind = "info") {
  if (typeof window === "undefined" || !message.trim()) return;
  const detail: ToastDetail = { id: ++toastSeq, message: message.trim(), kind };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
}
