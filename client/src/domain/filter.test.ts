import { describe, expect, it } from "vitest";
import { row } from "./__fixtures__/rows";
import {
  EMPTY_FILTERS,
  applyDrilldown,
  applyFilters,
  resolveRecent,
} from "./filter";
import type { UnitRow } from "./types";

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

describe("applyFilters commenced range", () => {
  const unit = (
    status: UnitRow["status"],
    iso: string | null,
    precision: "day" | "month" = "day",
  ) =>
    row({
      status,
      commencement: iso ? { iso, precision } : null,
    });
  const withRange = (from: string | null, to: string | null) => ({
    ...EMPTY_FILTERS,
    commenced: { from, to },
  });
  const inOut = (r: UnitRow, from: string | null, to: string | null) =>
    applyFilters([r], withRange(from, to)).length === 1;

  it("applies a from-only window with an open end", () => {
    expect(
      inOut(unit("operating", "2025-10-22T00:00:00+10:00"), "2025-10-22", null),
    ).toBe(true);
    expect(
      inOut(unit("operating", "2025-10-21T00:00:00+10:00"), "2025-10-22", null),
    ).toBe(false);
    expect(
      inOut(unit("operating", "2026-11-01T00:00:00+10:00"), "2025-10-22", null),
    ).toBe(true);
  });

  it("applies a to-only window with an open start", () => {
    expect(
      inOut(unit("operating", "2025-12-31T00:00:00+10:00"), null, "2025-12-31"),
    ).toBe(true);
    expect(
      inOut(unit("operating", "2026-01-01T00:00:00+10:00"), null, "2025-12-31"),
    ).toBe(false);
  });

  it("applies both bounds inclusively", () => {
    const from = "2025-10-22";
    const to = "2026-10-22";
    expect(
      inOut(unit("operating", "2025-10-22T00:00:00+10:00"), from, to),
    ).toBe(true);
    expect(
      inOut(unit("operating", "2026-10-22T00:00:00+10:00"), from, to),
    ).toBe(true);
    expect(
      inOut(unit("operating", "2026-10-23T00:00:00+10:00"), from, to),
    ).toBe(false);
  });

  it("compares month-precision dates at the first day of the month", () => {
    expect(
      inOut(
        unit("operating", "2025-10-01T00:00:00+10:00", "month"),
        "2025-10-22",
        null,
      ),
    ).toBe(false);
    expect(
      inOut(
        unit("operating", "2025-11-01T00:00:00+10:00", "month"),
        "2025-10-22",
        null,
      ),
    ).toBe(true);
  });

  it("drops missing commencements and statuses that aren't a start", () => {
    expect(inOut(unit("operating", null), "2020-01-01", null)).toBe(false);
    expect(
      inOut(unit("retired", "2026-03-01T00:00:00+10:00"), "2020-01-01", null),
    ).toBe(false);
    expect(inOut(unit("committed", null), "2020-01-01", null)).toBe(false);
  });

  it("imposes no status rule when the range is empty", () => {
    const out = applyFilters(
      [unit("retired", "2015-01-01T00:00:00+10:00"), unit("committed", null)],
      EMPTY_FILTERS,
    );
    expect(out).toHaveLength(2);
  });

  it("matches nothing when from is after to", () => {
    expect(
      applyFilters(
        [unit("operating", "2025-06-01T00:00:00+10:00")],
        withRange("2026-01-01", "2025-01-01"),
      ),
    ).toEqual([]);
  });

  it("applies the range to the same unit as the tech filter", () => {
    // The solar unit came online in the range; the battery unit did not.
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
      {
        ...EMPTY_FILTERS,
        techGroups: ["battery"],
        commenced: { from: "2025-10-22", to: null },
      },
    );
    expect(out).toEqual([]);
  });
});

describe("resolveRecent", () => {
  const AS_OF = "2026-10-22T03:00:00+10:00";

  it("turns recent=12 into a commenced-from, keeping the range open", () => {
    const resolved = resolveRecent(
      { ...EMPTY_FILTERS, recentMonths: 12 },
      AS_OF,
    );
    expect(resolved.commenced).toEqual({ from: "2025-10-22", to: null });
    expect(resolved.recentMonths).toBeNull();
  });

  it("keeps an explicit from over the shorthand", () => {
    const resolved = resolveRecent(
      {
        ...EMPTY_FILTERS,
        recentMonths: 12,
        commenced: { from: "2026-01-01", to: null },
      },
      AS_OF,
    );
    expect(resolved.commenced.from).toBe("2026-01-01");
  });

  it("returns the same object when there is nothing to resolve", () => {
    const none = { ...EMPTY_FILTERS };
    expect(resolveRecent(none, AS_OF)).toBe(none);
    const recent = { ...EMPTY_FILTERS, recentMonths: 12 as const };
    expect(resolveRecent(recent, "")).toBe(recent);
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
