import { describe, expect, it } from "vitest";
import { otherTheme, resolveTheme } from "./theme";

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
