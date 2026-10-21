import { describe, expect, it } from "vitest";
import { row } from "./__fixtures__/rows";
import { EMPTY_FILTERS, applyDrilldown, applyFilters } from "./filter";

// A hybrid site: operating solar + committed battery, same facility.
const hybridSolar = row({
  facilityCode: "HYB",
  facilityName: "Hybrid Park",
  unitCode: "HYB-S",
  techGroup: "solar",
  status: "operating",
});
const hybridBattery = row({
  facilityCode: "HYB",
  facilityName: "Hybrid Park",
  unitCode: "HYB-B",
  techGroup: "battery",
  status: "committed",
});
const qldWind = row({
  facilityCode: "QW",
  facilityName: "Queensland Wind",
  unitCode: "QW-1",
  state: "QLD",
  techGroup: "wind",
});
const rows = [hybridSolar, hybridBattery, qldWind];

describe("applyFilters", () => {
  it("returns everything for empty filters", () => {
    expect(applyFilters(rows, EMPTY_FILTERS)).toEqual(rows);
  });

  it("ORs within a facet", () => {
    const out = applyFilters(rows, {
      ...EMPTY_FILTERS,
      techGroups: ["solar", "wind"],
    });
    expect(out.map((r) => r.unitCode)).toEqual(["HYB-S", "QW-1"]);
  });

  it("ANDs across facets", () => {
    const out = applyFilters(rows, {
      ...EMPTY_FILTERS,
      states: ["NSW"],
      techGroups: ["solar", "wind"],
    });
    expect(out.map((r) => r.unitCode)).toEqual(["HYB-S"]);
  });

  it("requires every facet to match the same unit", () => {
    // The hybrid facility has a battery unit and a committed unit, but not a
    // committed battery unit, so it must not match.
    const out = applyFilters(rows, {
      ...EMPTY_FILTERS,
      techGroups: ["battery"],
      statuses: ["operating"],
    });
    expect(out).toEqual([]);
  });

  it("searches name and code, case-insensitively, trimming whitespace", () => {
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, search: "  queensland " }).map(
        (r) => r.unitCode,
      ),
    ).toEqual(["QW-1"]);
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, search: "hyb" }).map(
        (r) => r.unitCode,
      ),
    ).toEqual(["HYB-S", "HYB-B"]);
  });

  it("combines search with facets", () => {
    const out = applyFilters(rows, {
      ...EMPTY_FILTERS,
      search: "hybrid",
      statuses: ["committed"],
    });
    expect(out.map((r) => r.unitCode)).toEqual(["HYB-B"]);
  });
});

describe("applyDrilldown", () => {
  it("is a no-op for null", () => {
    expect(applyDrilldown(rows, null)).toBe(rows);
  });

  it("narrows to one group of the given dimension", () => {
    expect(
      applyDrilldown(rows, { dim: "techGroup", key: "battery" }).map(
        (r) => r.unitCode,
      ),
    ).toEqual(["HYB-B"]);
    expect(
      applyDrilldown(rows, { dim: "state", key: "QLD" }).map((r) => r.unitCode),
    ).toEqual(["QW-1"]);
  });

  it("returns nothing for a key absent from the rows", () => {
    expect(applyDrilldown(rows, { dim: "status", key: "retired" })).toEqual([]);
  });
});
