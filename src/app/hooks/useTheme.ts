import { createContext, useContext } from "react";

export type ThemeState =
  | { source: "host" }
  | { source: "standalone"; dark: boolean; toggle: () => void };

export const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used within ThemeProvider");
  return theme;
}
