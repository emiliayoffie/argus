import { describe, expect, it } from "vitest";
import { ERROR_COPY, errorCode, isFacilitiesResponse } from "./useFacilities";

describe("errorCode", () => {
  it("reads a known code", () => {
    expect(
      errorCode({ error: { code: "upstream_network", message: "x" } }),
    ).toBe("upstream_network");
  });

  it.each([
    null,
    "not json",
    {},
    { error: {} },
    { error: { code: "made_up" } },
    { error: { code: 42 } },
  ])("falls back to internal_error for %j", (body) => {
    expect(errorCode(body)).toBe("internal_error");
  });
});

describe("isFacilitiesResponse", () => {
  it("accepts a well-formed envelope", () => {
    expect(
      isFacilitiesResponse({
        facilities: [],
        fetchedAt: "a",
        sourceCreatedAt: "b",
      }),
    ).toBe(true);
  });

  it.each([
    { facilities: {}, fetchedAt: "a", sourceCreatedAt: "b" },
    { facilities: [] },
    { facilities: [], fetchedAt: "a" },
    { facilities: [], fetchedAt: 1, sourceCreatedAt: "b" },
    null,
  ])("rejects %j", (body) => {
    expect(isFacilitiesResponse(body)).toBe(false);
  });
});

describe("ERROR_COPY", () => {
  it("has non-empty text for every code", () => {
    for (const copy of Object.values(ERROR_COPY)) {
      expect(copy.text.length).toBeGreaterThan(0);
    }
  });
});
