import { describe, expect, it } from "vitest";
import { facilitiesToCsv } from "./export";
import type { FacilityRow } from "./types";

const base: FacilityRow = {
  code: "F1",
  name: "Wind Farm",
  state: "NSW",
  region: "NSW1",
  techGroups: ["wind"],
  statuses: ["operating"],
  matchingMw: 100,
  matchingUnits: 2,
  allUnits: 2,
  retiredUnits: 0,
  keyDate: {
    label: "Online since",
    date: { iso: "2020-03", precision: "month" },
    past: false,
  },
  closing: null,
  lat: -33.5,
  lng: 149.2,
};

describe("facilitiesToCsv", () => {
  it("emits the exact header and one row per facility", () => {
    const csv = facilitiesToCsv([base]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "code,name,state,region,technologies,statuses,matching_mw,matching_units,all_units,retired_units,key_date_label,key_date,key_date_precision,closing_date,closing_date_precision,lat,lng",
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      "F1,Wind Farm,NSW,NSW1,Wind,Operating,100,2,2,0,Online since,2020-03,month,,,-33.5,149.2",
    );
  });

  it("quotes fields containing commas and quotes", () => {
    const row = facilitiesToCsv([
      { ...base, name: 'Kogan "North", Phase 2', techGroups: ["coal", "gas"] },
    ]);
    expect(row).toContain('"Kogan ""North"", Phase 2"');
    expect(row).toContain("Coal; Gas");
  });

  it("leaves null MW and dates empty", () => {
    const row = facilitiesToCsv([
      { ...base, matchingMw: null, keyDate: null, closing: null },
    ]);
    const fields = row.split("\r\n")[1].split(",");
    expect(fields[6]).toBe("");
    expect(fields[10]).toBe("");
    expect(fields[13]).toBe("");
    expect(fields[14]).toBe("");
  });

  it("keeps row order", () => {
    const csv = facilitiesToCsv([
      { ...base, code: "B" },
      { ...base, code: "A" },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toMatch(/^B,/);
    expect(lines[2]).toMatch(/^A,/);
  });
});
