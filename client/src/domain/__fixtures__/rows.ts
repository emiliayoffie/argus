import type { UnitRow } from "../types";

// A complete UnitRow with sensible defaults; tests override only what matters.
export const row = (overrides: Partial<UnitRow> = {}): UnitRow => ({
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
  ...overrides,
});
