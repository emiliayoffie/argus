// App-owned vocabulary

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

// The three row fields a breakdown can group by. Each is a key of `UnitRow`.
export const DIMENSIONS = ["state", "techGroup", "status"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

// What a breakdown bar measures: summed MW or distinct facilities.
export const MEASURES = ["mw", "facilities"] as const;
export type Measure = (typeof MEASURES)[number];

// Display labels for group keys. Anything not listed is shown as its key.
export const LABELS: Record<Dimension, Record<string, string>> = {
  state: { OTHER: "Other" },
  techGroup: {
    solar: "Solar",
    wind: "Wind",
    hydro: "Hydro",
    battery: "Battery",
    bioenergy: "Bioenergy",
    coal: "Coal",
    gas: "Gas",
    distillate: "Distillate",
    other: "Other",
  },
  status: {
    committed: "Committed",
    commissioning: "Commissioning",
    operating: "Operating",
    retired: "Retired",
    other: "Other",
  },
};

export const label = (dim: Dimension, key: string): string =>
  LABELS[dim][key] ?? key;

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
  // Whether this unit's registered capacity counts toward MW totals; see
  // `isMwEligible` in normalize.ts. Independent of whether capacity is known.
  mwEligible: boolean;
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

// Base filters. Empty list = no constraint. OR within a facet, AND across.
export type Filters = {
  states: State[];
  techGroups: TechGroup[];
  statuses: Status[];
  // Facility name or code, case-insensitive.
  search: string;
};

// Clicking a bar in the breakdown. Filters the rows one step further, after
// the main filters, without changing the breakdown itself.
export type Drilldown = { dim: Dimension; key: string } | null;

export type StatusMw = {
  status: Status;
  mw: number;
  unknownCapacityUnits: number;
};

// Totals for the current selection.
export type Summary = {
  facilityCount: number;
  unitCount: number;
  totalMw: number;
  // One entry per status present in the rows, highest MW first.
  mwByStatus: StatusMw[];
  // Sum of `storageMwh` over battery rows with a published value.
  batteryStorageMwh: number;
  batteryUnits: number;
  // Battery rows without `capacity_storage`; not in the sum.
  batteryStorageUnknownUnits: number;
  // MW-eligible units with a known capacity (the ones summed).
  mwUnitCount: number;
  // Units that never count toward MW (loads, pumps).
  excludedUnits: number;
  // MW-eligible units whose capacity is absent upstream.
  unknownCapacityUnits: number;
};

// One bar of a breakdown.
export type BreakdownGroup = {
  key: string;
  label: string;
  mw: number;
  facilities: number;
  units: number;
};
