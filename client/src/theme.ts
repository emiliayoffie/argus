import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export const THEME_KEY = "theme";

const SYSTEM_DARK = "(prefers-color-scheme: dark)";

// Explicit choice wins; otherwise follow the system
export function resolveTheme(
  stored: string | null,
  systemDark: boolean,
): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return systemDark ? "dark" : "light";
}

export const otherTheme = (theme: Theme): Theme =>
  theme === "dark" ? "light" : "dark";

// localStorage can throw in privacy modes; losing persistence is fine
function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // The attribute still applied for this session
  }
}

function getSnapshot(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  return resolveTheme(null, matchMedia(SYSTEM_DARK).matches);
}

function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  const media = matchMedia(SYSTEM_DARK);
  const followSystem = () => {
    // No stored preference: keep the attribute tracking the system without
    // persisting anything, so an explicit click is still "the first choice"
    const stored = readStored();
    if (stored !== "light" && stored !== "dark") {
      document.documentElement.dataset.theme = resolveTheme(
        null,
        media.matches,
      );
    }
    onChange();
  };
  media.addEventListener("change", followSystem);

  return () => {
    observer.disconnect();
    media.removeEventListener("change", followSystem);
  };
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => applyTheme(otherTheme(getSnapshot()));
  return { theme, toggle };
}
