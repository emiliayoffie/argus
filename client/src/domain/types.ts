// App-owned vocabulary. Each list is `as const` so the union type is derived
// from the array and the two can never disagree.

export const STATES = [
  "QLD",
  "NSW",
  "VIC",
  "SA",
  "TAS",
  "WA",
  "NT",
  "OTHER",
] as const;
export type State = (typeof STATES)[number];

export const TECH_GROUPS = [
  "solar",
  "wind",
  "hydro",
  "battery",
  "bioenergy",
  "coal",
  "gas",
  "distillate",
  "other",
] as const;
export type TechGroup = (typeof TECH_GROUPS)[number];

// Lifecycle order. These are registry classifications, not live availability.
export const STATUSES = [
  "committed",
  "commissioning",
  "operating",
  "retired",
  "other",
] as const;
export type Status = (typeof STATUSES)[number];

export type DatePrecision = "day" | "month" | "year";

// `iso` is the raw upstream string. It is sliced for display and sorting,
// never parsed with `new Date()`, so the calendar day can't shift by timezone.
export type SourceDate = { iso: string; precision: DatePrecision } | null;

// One row per unit, with its facility's fields copied on. The whole client
// works on a flat `UnitRow[]` and never walks the nested upstream shape.
export type UnitRow = {
  facilityCode: string;
  facilityName: string;
  unitCode: string;
  state: State;
  // Raw `network_region`, kept because regions are not state boundaries.
  region: string;
  // Raw `fueltech_id`.
  fueltech: string;
  techGroup: TechGroup;
  status: Status;
  // Raw `status_id`.
  rawStatus: string;
  dispatchType: string;
  // `capacity_registered`; `null` means unknown, never 0.
  capacityMw: number | null;
  // `capacity_storage` in MWh (batteries).
  storageMwh: number | null;
  commencement: SourceDate;
  closure: SourceDate;
  expectedOperation: SourceDate;
  expectedClosure: SourceDate;
  lat: number | null;
  lng: number | null;
  // Telemetry: when data was first/last observed. Not a commissioning date.
  dataFirstSeen: string | null;
  dataLastSeen: string | null;
};
