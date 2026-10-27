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

// "Came online in the last N months" choices. An input-only shorthand:
// `recent=N` in a URL is resolved into `commenced` (as `asOf − N months`)
// before use and is never written back to the URL
export const RECENT_MONTHS = [6, 12, 24] as const;
export type RecentMonths = (typeof RECENT_MONTHS)[number] | null;

// An inclusive YYYY-MM-DD window for a unit's commencement date; either side
// may be open. `from > to` is valid input and matches nothing
export type DateRange = { from: string | null; to: string | null };
export const EMPTY_RANGE: DateRange = { from: null, to: null };

// Base filters. Empty list = no constraint. OR within a facet, AND across.
export type Filters = {
  states: State[];
  techGroups: TechGroup[];
  statuses: Status[];
  // Facility name or code, case-insensitive.
  search: string;
  recentMonths: RecentMonths;
  // Only units that came online in this range
  commenced: DateRange;
  // Only committed units expected to start in this range
  expected: DateRange;
  // Only retired units that closed in this range
  closed: DateRange;
};

// Clicking a bar in the breakdown. Filters the rows one step further, after
// the main filters, without changing the breakdown itself.
export type Drilldown = { dim: Dimension; key: string } | null;

// Where the map is looking; null means "fit to the current selection"
export type MapView = { lat: number; lng: number; zoom: number } | null;

// Table sort order; part of AppState so a shared URL lands on the same order
export const SORT_KEYS = ["name", "state", "mw", "units", "keyDate"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type Sort = { key: SortKey; direction: "asc" | "desc" };
export const DEFAULT_SORT: Sort = { key: "mw", direction: "desc" };

// Everything that defines a view and belongs in the URL. The page index is
// deliberately not here: it is how you look at a result, not what it is
export type AppState = {
  filters: Filters;
  groupBy: Dimension;
  // Secondary dimension shown as stacked segments inside each bar
  splitBy: Dimension | null;
  measure: Measure;
  drilldown: Drilldown;
  view: MapView;
  // Facility codes highlighted on the map and in the table. A highlight, not
  // a filter: totals never change
  selected: string[];
  sort: Sort;
};

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

// One segment of a split-by breakdown bar, always in the split dimension's
// canonical order so a segment key keeps the same colour on every bar
export type BreakdownSegment = {
  key: string;
  label: string;
  mw: number;
  facilities: number;
  units: number;
};

// One bar of a breakdown.
export type BreakdownGroup = {
  key: string;
  label: string;
  mw: number;
  facilities: number;
  units: number;
  // MW-eligible units whose capacity is absent upstream
  unknownMwUnits: number;
  segments: BreakdownSegment[];
};

// The one date worth showing for a unit, chosen by its status.
export type KeyDate = {
  label: string;
  date: SourceDate;
  // `committed` only: the expected date is already before the dataset date.
  past: boolean;
};

// One table row per facility, built from the shown unit rows.
export type FacilityRow = {
  code: string;
  name: string;
  state: State;
  region: string;
  // From matching units only.
  techGroups: TechGroup[];
  statuses: Status[];
  // Sum over matching MW-eligible units with known capacity; `null` when none.
  matchingMw: number | null;
  matchingUnits: number;
  // From ALL of the facility's units, ignoring filters and drilldown.
  retiredUnits: number;
  allUnits: number;
  keyDate: KeyDate | null;
  // Earliest expected closure among operating units within the horizon;
  // `null` when none is published
  closing: SourceDate | null;
  // Facility coordinates; `null` when upstream has none. The row still counts.
  lat: number | null;
  lng: number | null;
};
