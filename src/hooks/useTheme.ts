import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "manovik:theme";

/** Read the persisted theme. Dark is the default when nothing is stored. */
export function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/**
 * Apply the theme instantly (no reload): toggles the .light class on
 * <html> — :root is the dark theme, so removing .light restores dark.
 */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("light", theme === "light");
  el.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable; theme still applies for this session */
  }
}

/** Theme state synced with localStorage + the <html> class. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = readTheme();
    setThemeState(stored);
    // Re-apply on mount in case the anti-FOUC head script didn't run
    // (e.g. client-side navigation into a fresh document).
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
