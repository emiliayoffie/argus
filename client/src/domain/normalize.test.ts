import { describe, expect, it } from "vitest";
import { UpstreamEnvelope } from "../../../server/src/contract";
import fixture from "./__fixtures__/facilities.sample.json";
import {
  facilitiesToRows,
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

  it("maps anything unrecognised to OTHER", () => {
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

describe("facilitiesToRows", () => {
  it("produces one row per upstream unit", () => {
    const unitCount = facilities.reduce((n, f) => n + f.units.length, 0);
    expect(rows).toHaveLength(unitCount);
  });

  it("copies facility fields onto every unit row", () => {
    const facility = facilities[0];
    const its = rows.filter((r) => r.facilityCode === facility.code);
    expect(its).toHaveLength(facility.units.length);
    for (const row of its) {
      expect(row.facilityName).toBe(facility.name);
      expect(row.region).toBe(facility.network_region);
      expect(row.state).toBe(regionToState(facility.network_region));
    }
  });

  it("keeps raw ids alongside the normalised ones", () => {
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
      const its = rows.filter((r) => r.facilityCode === f.code);
      expect(its.length).toBe(f.units.length);
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
