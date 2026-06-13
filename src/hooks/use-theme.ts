import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "fleetflow-theme";

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const t = getInitial();
    setThemeState(t);
    applyTheme(t);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    applyTheme(next);
    try { window.localStorage.setItem(KEY, next); } catch {}
  }

  function toggle() { setTheme(theme === "dark" ? "light" : "dark"); }

  return { theme, setTheme, toggle };
}
