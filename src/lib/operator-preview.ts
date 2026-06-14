// Operator preview mode: admins can preview what operators see.
// Stored in localStorage so it's per-device and never affects other users.
import { useEffect, useState } from "react";

const KEY = "fleetflow:operator-preview";

export function isOperatorPreviewOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setOperatorPreview(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("fleetflow:operator-preview-changed"));
  } catch {
    // ignore
  }
}

export function useOperatorPreview() {
  const [on, setOn] = useState<boolean>(() => isOperatorPreviewOn());
  useEffect(() => {
    const sync = () => setOn(isOperatorPreviewOn());
    window.addEventListener("fleetflow:operator-preview-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("fleetflow:operator-preview-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return on;
}
