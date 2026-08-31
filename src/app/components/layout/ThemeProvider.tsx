import {
  getThemeProvider,
  isInsideContainerSync,
  type HostSubscription,
} from "@parity/product-sdk/host";
import { type ReactNode, useEffect, useState } from "react";
import { ThemeContext } from "../../hooks/useTheme";
import { ensureHostPort } from "../../lib/host";

const STORAGE_KEY = "subsquare-theme";

function applyDarkClass(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

function getInitialDark(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function StandaloneThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(getInitialDark);

  useEffect(() => {
    applyDarkClass(dark);
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  return (
    <ThemeContext.Provider
      value={{
        source: "standalone",
        dark,
        toggle: () => setDark((current) => !current),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

function HostThemeProvider({
  children,
  onUnavailable,
}: {
  children: ReactNode;
  onUnavailable: () => void;
}) {
  useEffect(() => {
    let cancelled = false;
    let subscription: HostSubscription | undefined;

    void (async () => {
      await ensureHostPort();
      if (cancelled) return;

      const provider = await getThemeProvider();
      if (cancelled) return;
      if (!provider) {
        onUnavailable();
        return;
      }

      subscription = provider.subscribeTheme((theme) => {
        if (!cancelled) applyDarkClass(theme.variant === "Dark");
      });
    })().catch((error: unknown) => {
      if (!cancelled) console.warn("host theme subscription failed", error);
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [onUnavailable]);

  return (
    <ThemeContext.Provider value={{ source: "host" }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Chooses the Host theme provider when embedded, otherwise local theme state. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<"host" | "standalone">(() =>
    isInsideContainerSync() ? "host" : "standalone",
  );

  if (source === "host") {
    return (
      <HostThemeProvider onUnavailable={() => setSource("standalone")}>
        {children}
      </HostThemeProvider>
    );
  }

  return <StandaloneThemeProvider>{children}</StandaloneThemeProvider>;
}
