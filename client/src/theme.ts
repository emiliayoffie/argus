import { useSyncExternalStore } from "react";
import type { Status } from "./domain/types";

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

// Reads the live attribute rather than closing over React state, so it is a
// stable function and safe to use in effect dependencies
const toggle = () => applyTheme(otherTheme(getSnapshot()));

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { theme, toggle };
}

export const PALETTES = ["deutan", "tritan", "mono"] as const;
export type Palette = (typeof PALETTES)[number] | null;

export const PALETTE_KEY = "palette";

export function resolvePalette(stored: string | null): Palette {
  return PALETTES.find((p) => p === stored) ?? null;
}

export function applyPalette(palette: Palette): void {
  if (palette === null) {
    delete document.documentElement.dataset.palette;
  } else {
    document.documentElement.dataset.palette = palette;
  }
  try {
    if (palette === null) localStorage.removeItem(PALETTE_KEY);
    else localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    // The attribute still applied for this session
  }
}

function getPaletteSnapshot(): Palette {
  return resolvePalette(document.documentElement.dataset.palette ?? null);
}

function getPaletteServerSnapshot(): Palette {
  return null;
}

// Palette changes and theme changes both re-tint the status colours, so
// subscribers watch both attributes
function subscribeAttributes(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-palette"],
  });
  return () => observer.disconnect();
}

export function usePalette(): {
  palette: Palette;
  setPalette: (p: Palette) => void;
} {
  const palette = useSyncExternalStore(
    subscribeAttributes,
    getPaletteSnapshot,
    getPaletteServerSnapshot,
  );
  return { palette, setPalette: applyPalette };
}

export type PaletteColors = {
  status: Record<Status, string>;
  mixed: string;
  selected: string;
  stroke: string;
};

// getSnapshot must return a stable reference between changes, so cache on
// the attribute pair rather than rebuilding the record every render
let colorsKey = "";
let colorsCache: PaletteColors = {
  status: {
    operating: "",
    commissioning: "",
    committed: "",
    retired: "",
    other: "",
  },
  mixed: "",
  selected: "",
  stroke: "",
};

function readPaletteColors(): PaletteColors {
  const el = document.documentElement;
  const key = `${el.dataset.theme ?? ""}|${el.dataset.palette ?? ""}`;
  if (key !== colorsKey) {
    const cs = getComputedStyle(el);
    const read = (name: string) => cs.getPropertyValue(name).trim();
    const retired = read("--status-retired");
    colorsCache = {
      status: {
        operating: read("--status-operating"),
        commissioning: read("--status-commissioning"),
        committed: read("--status-committed"),
        retired,
        other: retired,
      },
      mixed: read("--status-mixed"),
      selected: read("--accent"),
      stroke: read("--marker-stroke"),
    };
    colorsKey = key;
  }
  return colorsCache;
}

// Leaflet markers are drawn from JS, not CSS, so their colours come from
// computed style variables that this hook re-reads on every theme or
// palette change
export function usePaletteColors(): PaletteColors {
  return useSyncExternalStore(subscribeAttributes, readPaletteColors);
}
