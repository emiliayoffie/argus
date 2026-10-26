import { describe, expect, it } from "vitest";
import { row } from "./__fixtures__/rows";
import {
  DEFAULT_SORT,
  facilityLifecycle,
  groupByFacility,
  keyDate,
  sortFacilities,
} from "./facilities";
import type { DatePrecision, SourceDate } from "./types";

const AS_OF = "2026-10-20T12:41:08+11:00";
const d = (iso: string, precision: DatePrecision = "day"): SourceDate => ({
  iso,
  precision,
});

describe("keyDate", () => {
  it("picks the date by status, with a label", () => {
    expect(
      keyDate(
        row({ status: "operating", commencement: d("2019-03-01T") }),
        AS_OF,
      ),
    ).toEqual({ label: "Online since", date: d("2019-03-01T"), past: false });
    expect(
      keyDate(row({ status: "retired", closure: d("2023-04-28T") }), AS_OF),
    ).toEqual({ label: "Closed", date: d("2023-04-28T"), past: false });
    expect(
      keyDate(
        row({ status: "commissioning", commencement: d("2026-02-01T") }),
        AS_OF,
      ),
    ).toMatchObject({ label: "Commissioning" });
    expect(keyDate(row({ status: "other" }), AS_OF)).toBeNull();
  });

  it("flags a committed unit whose expected date is already past", () => {
    expect(
      keyDate(
        row({
          status: "committed",
          expectedOperation: d("2025-12-01T", "month"),
        }),
        AS_OF,
      ),
    ).toMatchObject({ label: "Expected", past: true });
    expect(
      keyDate(
        row({
          status: "committed",
          expectedOperation: d("2027-06-01T", "month"),
        }),
        AS_OF,
      ),
    ).toMatchObject({ past: false });
    // No date at all: still shows the label, not flagged.
    expect(keyDate(row({ status: "committed" }), AS_OF)).toEqual({
      label: "Expected",
      date: null,
      past: false,
    });
  });
});

describe("facilityLifecycle", () => {
  it("counts all and retired units per facility, over every row", () => {
    const life = facilityLifecycle([
      row({ facilityCode: "A", unitCode: "A1", status: "retired" }),
      row({ facilityCode: "A", unitCode: "A2", status: "operating" }),
      row({ facilityCode: "A", unitCode: "A3", status: "operating" }),
      row({ facilityCode: "B", unitCode: "B1", status: "retired" }),
    ]);
    expect(life.get("A")).toEqual({ retiredUnits: 1, allUnits: 3 });
    expect(life.get("B")).toEqual({ retiredUnits: 1, allUnits: 1 });
  });
});

describe("groupByFacility", () => {
  const all = [
    row({
      facilityCode: "ERARING",
      facilityName: "Eraring",
      unitCode: "ER01",
      status: "retired",
      capacityMw: 720,
      closure: d("2023-01-01T", "year"),
    }),
    row({
      facilityCode: "ERARING",
      facilityName: "Eraring",
      unitCode: "ER02",
      status: "operating",
      capacityMw: 720,
      commencement: d("1984-01-01T", "year"),
    }),
    row({
      facilityCode: "ERARING",
      facilityName: "Eraring",
      unitCode: "ER03",
      status: "operating",
      capacityMw: null,
      commencement: d("1985-06-01T", "month"),
    }),
    row({
      facilityCode: "HYB",
      facilityName: "Hybrid",
      unitCode: "H-S",
      techGroup: "solar",
      capacityMw: 40,
    }),
    row({
      facilityCode: "HYB",
      facilityName: "Hybrid",
      unitCode: "H-B",
      techGroup: "battery",
      capacityMw: 20,
      mwEligible: false,
    }),
    row({
      facilityCode: "PUMPS",
      facilityName: "Pumps Only",
      unitCode: "P1",
      techGroup: "hydro",
      mwEligible: false,
      capacityMw: 240,
    }),
  ];
  const lifecycle = facilityLifecycle(all);

  it("makes one row per facility from the shown rows", () => {
    const rows = groupByFacility(all, lifecycle, AS_OF);
    expect(rows.map((f) => f.code)).toEqual(["ERARING", "HYB", "PUMPS"]);
  });

  it("sums matching MW over eligible known-capacity units, null when none", () => {
    const rows = groupByFacility(all, lifecycle, AS_OF);
    expect(rows.find((f) => f.code === "ERARING")?.matchingMw).toBe(1440);
    expect(rows.find((f) => f.code === "HYB")?.matchingMw).toBe(40);
    expect(rows.find((f) => f.code === "PUMPS")?.matchingMw).toBeNull();
  });

  it("lists matching technologies and statuses in canonical order", () => {
    const hyb = groupByFacility(all, lifecycle, AS_OF).find(
      (f) => f.code === "HYB",
    );
    expect(hyb?.techGroups).toEqual(["solar", "battery"]);
    const eraring = groupByFacility(all, lifecycle, AS_OF).find(
      (f) => f.code === "ERARING",
    );
    expect(eraring?.statuses).toEqual(["operating", "retired"]);
  });

  it("takes retired/all counts from the lifecycle, not from the shown rows", () => {
    // Only Eraring's retired unit is shown (as if filtered to Retired).
    const shown = all.filter((r) => r.status === "retired");
    const [eraring] = groupByFacility(shown, lifecycle, AS_OF);
    expect(eraring.matchingUnits).toBe(1);
    expect(eraring.retiredUnits).toBe(1);
    expect(eraring.allUnits).toBe(3);
  });

  it("picks the latest key date among matching units, label included", () => {
    const [eraring] = groupByFacility(
      all.filter((r) => r.facilityCode === "ERARING"),
      lifecycle,
      AS_OF,
    );
    // 2023 closure is later than both commencements.
    expect(eraring.keyDate).toMatchObject({ label: "Closed" });
    expect(eraring.keyDate?.date?.iso).toBe("2023-01-01T");
  });
});

describe("sortFacilities", () => {
  const rows = groupByFacility(
    [
      row({ facilityCode: "B", facilityName: "bravo", capacityMw: 50 }),
      row({ facilityCode: "A", facilityName: "Alpha", capacityMw: 100 }),
      row({ facilityCode: "N", facilityName: "Nothing", capacityMw: null }),
      row({ facilityCode: "C", facilityName: "charlie", capacityMw: 50 }),
    ],
    new Map(),
    AS_OF,
  );
  const codes = (r: typeof rows) => r.map((f) => f.code);

  it("defaults to MW descending with nulls last", () => {
    expect(codes(sortFacilities(rows, DEFAULT_SORT))).toEqual([
      "A",
      "B",
      "C",
      "N",
    ]);
  });

  it("keeps nulls last when ascending too, and is stable for ties", () => {
    expect(
      codes(sortFacilities(rows, { key: "mw", direction: "asc" })),
    ).toEqual(["B", "C", "A", "N"]);
  });

  it("sorts names case-insensitively", () => {
    expect(
      codes(sortFacilities(rows, { key: "name", direction: "asc" })),
    ).toEqual(["A", "B", "C", "N"]);
  });

  it("does not mutate the input", () => {
    const before = codes(rows);
    sortFacilities(rows, { key: "name", direction: "desc" });
    expect(codes(rows)).toEqual(before);
  });
});
