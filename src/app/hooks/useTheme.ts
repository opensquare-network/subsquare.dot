import { useEffect, useState } from "react";

const STORAGE_KEY = "subsquare-theme";

/** Returns the saved preference, falling back to the system color scheme. */
function getInitialDark(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Theme hook: persists the dark/light choice to localStorage and applies
 * it to the <html> element. Falls back to the OS preference on first visit.
 */
export function useTheme() {
  const [dark, setDark] = useState<boolean>(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}
