import { describe, expect, it } from "vitest";
import { AU_VIEWBOX, stateShapes } from "./geo";

describe("stateShapes", () => {
  const shapes = stateShapes();

  it("covers the seven states and territories the data uses, each once", () => {
    expect(shapes.map((s) => s.state).sort()).toEqual([
      "NSW",
      "NT",
      "QLD",
      "SA",
      "TAS",
      "VIC",
      "WA",
    ]);
  });

  it("projects every point inside the viewBox", () => {
    for (const s of shapes) {
      const numbers = s.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      expect(numbers.length).toBeGreaterThan(8);
      for (let i = 0; i < numbers.length; i += 2) {
        expect(numbers[i]).toBeGreaterThanOrEqual(0);
        expect(numbers[i]).toBeLessThanOrEqual(AU_VIEWBOX.width);
        expect(numbers[i + 1]).toBeGreaterThanOrEqual(0);
        expect(numbers[i + 1]).toBeLessThanOrEqual(AU_VIEWBOX.height);
      }
    }
  });

  it("keeps geography the right way up and round: Tasmania south of Victoria, WA west of NSW", () => {
    const centre = (state: string) => {
      const d = shapes.find((s) => s.state === state)?.d ?? "";
      const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      return {
        x: xs.reduce((a, b) => a + b, 0) / xs.length,
        y: ys.reduce((a, b) => a + b, 0) / ys.length,
      };
    };
    expect(centre("TAS").y).toBeGreaterThan(centre("VIC").y);
    expect(centre("WA").x).toBeLessThan(centre("NSW").x);
    expect(centre("NT").y).toBeLessThan(centre("SA").y);
  });

  it("closes every ring", () => {
    for (const s of shapes) expect(s.d.endsWith("Z")).toBe(true);
  });
});
