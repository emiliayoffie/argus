import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPalette,
  otherTheme,
  resolvePalette,
  resolveTheme,
} from "./theme";

describe("resolveTheme", () => {
  it("prefers the stored choice", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("falls back to the system preference", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });

  it("treats garbage values as no choice", () => {
    expect(resolveTheme("garbage", true)).toBe("dark");
    expect(resolveTheme("garbage", false)).toBe("light");
  });
});

describe("otherTheme", () => {
  it("round-trips", () => {
    expect(otherTheme(otherTheme("dark"))).toBe("dark");
    expect(otherTheme(otherTheme("light"))).toBe("light");
    expect(otherTheme("dark")).toBe("light");
    expect(otherTheme("light")).toBe("dark");
  });
});

describe("resolvePalette", () => {
  it("accepts the three palette names", () => {
    expect(resolvePalette("deutan")).toBe("deutan");
    expect(resolvePalette("tritan")).toBe("tritan");
    expect(resolvePalette("mono")).toBe("mono");
  });

  it("treats unknown, empty, and missing values as no palette", () => {
    expect(resolvePalette("blue")).toBeNull();
    expect(resolvePalette("")).toBeNull();
    expect(resolvePalette(null)).toBeNull();
  });
});

describe("applyPalette", () => {
  const stubDom = () => {
    const dataset: Record<string, string> = {};
    const store = new Map<string, string>();
    vi.stubGlobal("document", { documentElement: { dataset } });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
    return { dataset, store };
  };

  afterEach(() => vi.unstubAllGlobals());

  it("sets the attribute and persists the choice", () => {
    const { dataset, store } = stubDom();
    applyPalette("deutan");
    expect(dataset.palette).toBe("deutan");
    expect(store.get("palette")).toBe("deutan");
  });

  it("removes the attribute and storage key when cleared", () => {
    const { dataset, store } = stubDom();
    applyPalette("tritan");
    applyPalette(null);
    expect(dataset.palette).toBeUndefined();
    expect(store.has("palette")).toBe(false);
  });
});
