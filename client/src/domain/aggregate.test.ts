import { describe, expect, it } from "vitest";
import { UpstreamEnvelope } from "../../../server/src/contract";
import fixture from "./__fixtures__/facilities.sample.json";
import { groupBy, summarize } from "./aggregate";
import { facilitiesToRows } from "./normalize";
import type { UnitRow } from "./types";

const row = (over: Partial<UnitRow>): UnitRow => ({
  facilityCode: "F",
  facilityName: "Facility",
  unitCode: "U",
  state: "NSW",
  region: "NSW1",
  fueltech: "solar_utility",
  techGroup: "solar",
  status: "operating",
  rawStatus: "operating",
  dispatchType: "GENERATOR",
  mwEligible: true,
  capacityMw: 10,
  storageMwh: null,
  commencement: null,
  closure: null,
  expectedOperation: null,
  expectedClosure: null,
  lat: null,
  lng: null,
  dataFirstSeen: null,
  dataLastSeen: null,
  ...over,
});

describe("summarize", () => {
  it("returns zeros for no rows", () => {
    expect(summarize([])).toEqual({
      facilityCount: 0,
      unitCount: 0,
      totalMw: 0,
      mwByStatus: [],
      batteryStorageMwh: 0,
      batteryUnits: 0,
      batteryStorageUnknownUnits: 0,
      mwUnitCount: 0,
      excludedUnits: 0,
      unknownCapacityUnits: 0,
    });
  });

  it("counts distinct facilities, not units", () => {
    const s = summarize([
      row({ facilityCode: "A", unitCode: "A1" }),
      row({ facilityCode: "A", unitCode: "A2" }),
      row({ facilityCode: "B", unitCode: "B1" }),
    ]);
    expect(s.facilityCount).toBe(2);
    expect(s.unitCount).toBe(3);
  });

  it("sums MW only from eligible units with a known capacity", () => {
    const s = summarize([
      row({ unitCode: "a", capacityMw: 100 }),
      row({ unitCode: "b", capacityMw: null }), // eligible, unknown
      row({ unitCode: "c", capacityMw: 50, mwEligible: false }), // excluded
      row({ unitCode: "d", capacityMw: 25 }),
    ]);
    expect(s.totalMw).toBe(125);
    expect(s.mwUnitCount).toBe(2);
    expect(s.unknownCapacityUnits).toBe(1);
    expect(s.excludedUnits).toBe(1);
  });

  it("breaks MW down by status, highest first, carrying unknowns per status", () => {
    const s = summarize([
      row({ unitCode: "a", status: "operating", capacityMw: 10 }),
      row({ unitCode: "b", status: "committed", capacityMw: 30 }),
      row({ unitCode: "c", status: "operating", capacityMw: null }),
    ]);
    expect(s.mwByStatus).toEqual([
      { status: "committed", mw: 30, unknownCapacityUnits: 0 },
      { status: "operating", mw: 10, unknownCapacityUnits: 1 },
    ]);
  });

  it("sums battery storage only where published, counting the rest", () => {
    const s = summarize([
      row({ unitCode: "a", techGroup: "battery", storageMwh: 194 }),
      row({ unitCode: "b", techGroup: "battery", storageMwh: null }),
      row({ unitCode: "c", techGroup: "solar", storageMwh: 999 }), // not a battery
    ]);
    expect(s.batteryUnits).toBe(2);
    expect(s.batteryStorageMwh).toBe(194);
    expect(s.batteryStorageUnknownUnits).toBe(1);
  });
});

describe("groupBy", () => {
  const rows = [
    row({
      facilityCode: "HYB",
      unitCode: "s",
      techGroup: "solar",
      capacityMw: 40,
    }),
    row({
      facilityCode: "HYB",
      unitCode: "b",
      techGroup: "battery",
      capacityMw: 20,
    }),
    row({
      facilityCode: "W",
      unitCode: "w",
      techGroup: "wind",
      capacityMw: 100,
    }),
    row({
      facilityCode: "P",
      unitCode: "p",
      techGroup: "hydro",
      capacityMw: 240,
      mwEligible: false,
    }),
  ];

  it("makes one group per distinct key with a display label", () => {
    const groups = groupBy(rows, "techGroup", "mw");
    expect(groups.map((g) => g.key)).toEqual([
      "wind",
      "solar",
      "battery",
      "hydro",
    ]);
    expect(groups.find((g) => g.key === "wind")?.label).toBe("Wind");
  });

  it("sorts by the chosen measure, descending", () => {
    expect(groupBy(rows, "techGroup", "mw").map((g) => g.mw)).toEqual([
      100, 40, 20, 0,
    ]);
    const byFacilities = groupBy(rows, "techGroup", "facilities");
    expect(byFacilities.every((g) => g.facilities === 1)).toBe(true);
  });

  it("applies the MW rule inside each group", () => {
    const hydro = groupBy(rows, "techGroup", "mw").find(
      (g) => g.key === "hydro",
    );
    expect(hydro).toMatchObject({ units: 1, mw: 0 });
  });

  it("counts facilities per group non-additively", () => {
    const groups = groupBy(rows, "techGroup", "facilities");
    const summed = groups.reduce((n, g) => n + g.facilities, 0);
    // HYB appears under both solar and battery, so groups sum to 4 while
    // there are only 3 distinct facilities.
    expect(summed).toBe(4);
    expect(summarize(rows).facilityCount).toBe(3);
  });
});

describe("against the fixture", () => {
  const rows = facilitiesToRows(UpstreamEnvelope.parse(fixture).data);
  const s = summarize(rows);

  it("every unit is counted exactly once across the three MW buckets", () => {
    expect(s.mwUnitCount + s.unknownCapacityUnits + s.excludedUnits).toBe(
      s.unitCount,
    );
  });

  it("status MW adds up to the total", () => {
    const byStatus = s.mwByStatus.reduce((n, x) => n + x.mw, 0);
    expect(byStatus).toBeCloseTo(s.totalMw, 6);
  });

  it("the state breakdown's MW adds up to the total too", () => {
    const byState = groupBy(rows, "state", "mw").reduce((n, g) => n + g.mw, 0);
    expect(byState).toBeCloseTo(s.totalMw, 6);
  });

  it("pumps are excluded from MW, not unknown", () => {
    expect(s.excludedUnits).toBeGreaterThan(0);
  });
});
