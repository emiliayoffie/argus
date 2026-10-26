import { describe, expect, it } from "vitest";
import { UpstreamEnvelope, type UnitDto } from "../../../server/src/contract";
import fixture from "./__fixtures__/facilities.sample.json";
import {
  canonicalUnits,
  facilitiesToRows,
  isMwEligible,
  normalizeStatus,
  regionToState,
  techGroup,
  toSourceDate,
} from "./normalize";

// Parsing the fixture through the real schema keeps the test honest: the rows
// are built from exactly what the Worker would forward.
const facilities = UpstreamEnvelope.parse(fixture).data;
const rows = facilitiesToRows(facilities);

describe("regionToState", () => {
  it.each([
    ["NSW1", "NSW"],
    ["QLD1", "QLD"],
    ["VIC1", "VIC"],
    ["SA1", "SA"],
    ["TAS1", "TAS"],
    ["WEM", "WA"],
    ["WEMDE", "WA"],
  ])("maps %s to %s", (region, state) => {
    expect(regionToState(region)).toBe(state);
  });

  it("maps anything unrecognized to OTHER", () => {
    expect(regionToState("NT1")).toBe("OTHER");
    expect(regionToState("")).toBe("OTHER");
  });
});

describe("techGroup", () => {
  it.each([
    ["solar_utility", "solar"],
    ["solar_rooftop", "solar"],
    ["wind", "wind"],
    ["hydro", "hydro"],
    ["pumps", "hydro"],
    ["battery", "battery"],
    ["battery_charging", "battery"],
    ["battery_discharging", "battery"],
    ["bioenergy_biomass", "bioenergy"],
    ["coal_black", "coal"],
    ["coal_brown", "coal"],
    ["gas_ocgt", "gas"],
    ["gas_ccgt", "gas"],
    ["distillate", "distillate"],
  ])("groups %s as %s", (fueltech, group) => {
    expect(techGroup(fueltech)).toBe(group);
  });

  it("groups unknown fueltechs as other", () => {
    expect(techGroup("nuclear")).toBe("other");
    expect(techGroup("")).toBe("other");
  });
});

describe("normalizeStatus", () => {
  it("keeps the four lifecycle statuses and maps the rest to other", () => {
    expect(normalizeStatus("operating")).toBe("operating");
    expect(normalizeStatus("committed")).toBe("committed");
    expect(normalizeStatus("commissioning")).toBe("commissioning");
    expect(normalizeStatus("retired")).toBe("retired");
    expect(normalizeStatus("mothballed")).toBe("other");
    expect(normalizeStatus("")).toBe("other");
  });
});

describe("toSourceDate", () => {
  it("keeps the raw string and the given precision", () => {
    expect(toSourceDate("2019-03-01T00:00:00", "month")).toEqual({
      iso: "2019-03-01T00:00:00",
      precision: "month",
    });
    expect(toSourceDate("2019-03-15T00:00:00", "day")?.precision).toBe("day");
    expect(toSourceDate("2019-01-01T00:00:00", "year")?.precision).toBe("year");
  });

  it("is null when there is no date, whatever the specificity says", () => {
    expect(toSourceDate(null, "day")).toBeNull();
    expect(toSourceDate(undefined, "month")).toBeNull();
  });

  it("falls back to year precision when the specificity is missing or unknown", () => {
    expect(toSourceDate("2019-03-01T00:00:00", null)?.precision).toBe("year");
    expect(toSourceDate("2019-03-01T00:00:00", undefined)?.precision).toBe(
      "year",
    );
    expect(toSourceDate("2019-03-01T00:00:00", "quarter")?.precision).toBe(
      "year",
    );
  });
});

const unitsOf = (code: string) => rows.filter((r) => r.facilityCode === code);

describe("canonicalUnits", () => {
  const unit = (fueltech_id: string, dispatch_type: string): UnitDto => ({
    code: `${fueltech_id}-${dispatch_type}`,
    fueltech_id,
    dispatch_type,
    status_id: "operating",
  });
  const b = unit("battery", "BIDIRECTIONAL");
  const d = unit("battery_discharging", "GENERATOR");
  const c = unit("battery_charging", "LOAD");
  const solar = unit("solar_utility", "GENERATOR");

  it("keeps only battery_discharging when all three representations exist", () => {
    expect(canonicalUnits([b, d, c])).toEqual([d]);
  });

  it("keeps battery_discharging over battery_charging", () => {
    expect(canonicalUnits([d, c])).toEqual([d]);
  });

  it("keeps the bidirectional unit when there is no discharging record", () => {
    expect(canonicalUnits([b, c])).toEqual([b]);
  });

  it("keeps a lone battery_charging so the facility does not vanish", () => {
    expect(canonicalUnits([c])).toEqual([c]);
  });

  it("never touches non-battery units", () => {
    expect(canonicalUnits([solar, b, d, c])).toEqual([solar, d]);
  });
});

describe("isMwEligible", () => {
  const unit = (fueltech_id: string, dispatch_type: string): UnitDto => ({
    code: "x",
    fueltech_id,
    dispatch_type,
    status_id: "operating",
  });

  it("counts generators", () => {
    expect(isMwEligible(unit("solar_utility", "GENERATOR"))).toBe(true);
    expect(isMwEligible(unit("coal_black", "GENERATOR"))).toBe(true);
    expect(isMwEligible(unit("battery_discharging", "GENERATOR"))).toBe(true);
  });

  it("counts a bidirectional battery unit", () => {
    expect(isMwEligible(unit("battery", "BIDIRECTIONAL"))).toBe(true);
  });

  it("never counts pumps, even when tagged GENERATOR upstream", () => {
    expect(isMwEligible(unit("pumps", "GENERATOR"))).toBe(false);
    expect(isMwEligible(unit("pumps", "LOAD"))).toBe(false);
  });

  it("never counts loads", () => {
    expect(isMwEligible(unit("battery_charging", "LOAD"))).toBe(false);
  });
});

describe("facilitiesToRows", () => {
  it("produces one row per canonical unit, fewer than upstream units", () => {
    const upstreamUnits = facilities.reduce((n, f) => n + f.units.length, 0);
    const canonical = facilities.reduce(
      (n, f) => n + canonicalUnits(f.units).length,
      0,
    );
    expect(rows).toHaveLength(canonical);
    expect(rows.length).toBeLessThan(upstreamUnits);
  });

  it("leaves one battery unit per battery facility", () => {
    const batteryFacilities = facilities.filter((f) =>
      f.units.some((u) => u.fueltech_id.startsWith("battery")),
    );
    expect(batteryFacilities.length).toBeGreaterThan(1);
    for (const f of batteryFacilities) {
      const batteryRows = unitsOf(f.code).filter(
        (r) => r.techGroup === "battery",
      );
      expect(batteryRows).toHaveLength(1);
    }
  });

  it("collapses Hornsdale to its discharging record, counted toward MW", () => {
    const [hpr, ...rest] = unitsOf("HORNSDPR");
    expect(rest).toHaveLength(0);
    expect(hpr.fueltech).toBe("battery_discharging");
    expect(hpr.mwEligible).toBe(true);
    expect(hpr.storageMwh).toBe(194);
  });

  it("keeps pumps rows under hydro but never MW-eligible", () => {
    const pumps = rows.filter((r) => r.fueltech === "pumps");
    expect(pumps.length).toBeGreaterThan(0);
    for (const p of pumps) {
      expect(p.techGroup).toBe("hydro");
      expect(p.mwEligible).toBe(false);
    }
    // The fixture's reason for the rule: a GENERATOR-tagged pump.
    expect(pumps.some((p) => p.dispatchType === "GENERATOR")).toBe(true);
  });

  it("copies facility fields onto every unit row", () => {
    const facility = facilities[0];
    const its = unitsOf(facility.code);
    expect(its).toHaveLength(canonicalUnits(facility.units).length);
    for (const row of its) {
      expect(row.facilityName).toBe(facility.name);
      expect(row.region).toBe(facility.network_region);
      expect(row.state).toBe(regionToState(facility.network_region));
    }
  });

  it("keeps raw ids alongside the normalized ones", () => {
    const row = rows.find((r) => r.fueltech === "coal_black");
    expect(row).toBeDefined();
    expect(row?.techGroup).toBe("coal");
    expect(row?.rawStatus).toBe(row?.status);
  });

  it("represents unknown capacity as null, never 0", () => {
    const missing = facilities
      .flatMap((f) => f.units)
      .filter((u) => u.capacity_registered == null);
    expect(missing.length).toBeGreaterThan(0);
    for (const u of missing) {
      const row = rows.find((r) => r.unitCode === u.code);
      expect(row?.capacityMw).toBeNull();
    }
    expect(rows.some((r) => r.capacityMw === 0)).toBe(false);
  });

  it("keeps rows for facilities without coordinates", () => {
    const noLocation = facilities.filter((f) => f.location == null);
    expect(noLocation.length).toBeGreaterThan(0);
    for (const f of noLocation) {
      const its = unitsOf(f.code);
      expect(its.length).toBe(canonicalUnits(f.units).length);
      expect(its.every((r) => r.lat === null && r.lng === null)).toBe(true);
    }
  });

  it("preserves date precision from the fixture", () => {
    const precisions = new Set(
      rows.map((r) => r.commencement?.precision).filter(Boolean),
    );
    // The sample carries more than one level of precision, so the UI can't
    // get away with assuming day-level dates.
    expect(precisions.size).toBeGreaterThan(1);
  });
});
