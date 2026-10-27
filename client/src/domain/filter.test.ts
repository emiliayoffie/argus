import { describe, expect, it } from "vitest";
import { row } from "./__fixtures__/rows";
import { EMPTY_FILTERS, applyDrilldown, applyFilters } from "./filter";
import type { UnitRow } from "./types";

// The dataset date the "recent" window is measured from, never today
const AS_OF = "2026-10-22T03:00:00+10:00";

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
    expect(applyFilters(rows, EMPTY_FILTERS, AS_OF)).toEqual(rows);
  });

  it("ORs within a facet", () => {
    const out = applyFilters(
      rows,
      {
        ...EMPTY_FILTERS,
        techGroups: ["solar", "wind"],
      },
      AS_OF,
    );
    expect(out.map((r) => r.unitCode)).toEqual(["HYB-S", "QW-1"]);
  });

  it("ANDs across facets", () => {
    const out = applyFilters(
      rows,
      {
        ...EMPTY_FILTERS,
        states: ["NSW"],
        techGroups: ["solar", "wind"],
      },
      AS_OF,
    );
    expect(out.map((r) => r.unitCode)).toEqual(["HYB-S"]);
  });

  it("requires every facet to match the same unit", () => {
    // The hybrid facility has a battery unit and a committed unit, but not a
    // committed battery unit, so it must not match.
    const out = applyFilters(
      rows,
      {
        ...EMPTY_FILTERS,
        techGroups: ["battery"],
        statuses: ["operating"],
      },
      AS_OF,
    );
    expect(out).toEqual([]);
  });

  it("searches name and code, case-insensitively, trimming whitespace", () => {
    expect(
      applyFilters(
        rows,
        { ...EMPTY_FILTERS, search: "  queensland " },
        AS_OF,
      ).map((r) => r.unitCode),
    ).toEqual(["QW-1"]);
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, search: "hyb" }, AS_OF).map(
        (r) => r.unitCode,
      ),
    ).toEqual(["HYB-S", "HYB-B"]);
  });

  it("combines search with facets", () => {
    const out = applyFilters(
      rows,
      {
        ...EMPTY_FILTERS,
        search: "hybrid",
        statuses: ["committed"],
      },
      AS_OF,
    );
    expect(out.map((r) => r.unitCode)).toEqual(["HYB-B"]);
  });
});

// recentMonths: 12 with AS_OF 2026-10-22 gives the window 2025-10-22 to
// 2026-10-22 inclusive
describe("applyFilters recent window", () => {
  const recent12 = { ...EMPTY_FILTERS, recentMonths: 12 as const };
  const unit = (
    status: UnitRow["status"],
    iso: string | null,
    precision: "day" | "month" = "day",
  ) =>
    row({
      status,
      commencement: iso ? { iso, precision } : null,
    });
  const inOut = (r: UnitRow) => applyFilters([r], recent12, AS_OF).length === 1;

  it("keeps units that commenced inside the window", () => {
    expect(inOut(unit("operating", "2025-10-22T00:00:00+10:00"))).toBe(true);
    expect(inOut(unit("operating", "2026-10-22T00:00:00+10:00"))).toBe(true);
    expect(inOut(unit("commissioning", "2026-06-01T00:00:00+10:00"))).toBe(
      true,
    );
  });

  it("drops units outside the window or after the dataset date", () => {
    expect(inOut(unit("operating", "2025-10-21T00:00:00+10:00"))).toBe(false);
    expect(inOut(unit("operating", "2026-11-01T00:00:00+10:00"))).toBe(false);
  });

  it("compares month-precision dates at the first day of the month", () => {
    expect(inOut(unit("operating", "2025-10-01T00:00:00+10:00", "month"))).toBe(
      false,
    );
    expect(inOut(unit("operating", "2025-11-01T00:00:00+10:00", "month"))).toBe(
      true,
    );
  });

  it("drops missing commencements and statuses that aren't a start", () => {
    expect(inOut(unit("operating", null))).toBe(false);
    expect(inOut(unit("retired", "2026-03-01T00:00:00+10:00"))).toBe(false);
    expect(inOut(unit("committed", null))).toBe(false);
  });

  it("applies the window to the same unit as the tech filter", () => {
    // The solar unit came online in the window; the battery unit did not.
    // The facility must not match through its solar unit
    const out = applyFilters(
      [
        row({
          facilityCode: "HYB",
          unitCode: "HYB-S",
          techGroup: "solar",
          status: "operating",
          commencement: { iso: "2026-05-01T00:00:00+10:00", precision: "day" },
        }),
        row({
          facilityCode: "HYB",
          unitCode: "HYB-B",
          techGroup: "battery",
          status: "operating",
          commencement: { iso: "2020-01-01T00:00:00+10:00", precision: "day" },
        }),
      ],
      { ...EMPTY_FILTERS, techGroups: ["battery"], recentMonths: 12 },
      AS_OF,
    );
    expect(out).toEqual([]);
  });

  it("is a no-op when recentMonths is null", () => {
    const r = unit("operating", "1999-01-01T00:00:00+10:00");
    expect(applyFilters([r], EMPTY_FILTERS, AS_OF)).toEqual([r]);
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
