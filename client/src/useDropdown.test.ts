import { describe, expect, it } from "vitest";
import { nextIndex } from "./useDropdown";

describe("nextIndex", () => {
  it("steps down and up, wrapping at both ends", () => {
    expect(nextIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextIndex("ArrowDown", 2, 3)).toBe(0);
    expect(nextIndex("ArrowUp", 2, 3)).toBe(1);
    expect(nextIndex("ArrowUp", 0, 3)).toBe(2);
  });

  it("enters the list from the trigger: Down to the first, Up to the last", () => {
    expect(nextIndex("ArrowDown", -1, 3)).toBe(0);
    expect(nextIndex("ArrowUp", -1, 3)).toBe(2);
  });

  it("jumps with Home and End", () => {
    expect(nextIndex("Home", 2, 3)).toBe(0);
    expect(nextIndex("End", 0, 3)).toBe(2);
  });

  it("leaves other keys and empty lists alone", () => {
    expect(nextIndex("Tab", 1, 3)).toBeNull();
    expect(nextIndex("Enter", 1, 3)).toBeNull();
    expect(nextIndex("ArrowDown", -1, 0)).toBeNull();
  });
});
