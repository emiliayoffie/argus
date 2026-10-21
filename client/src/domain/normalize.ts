import type { FacilityDto } from "../../../server/src/contract";
import type {
  DatePrecision,
  SourceDate,
  State,
  Status,
  TechGroup,
  UnitRow,
} from "./types";

// Market regions are labelled by state for usability, but they are not state
// boundaries: NSW1 includes the ACT and WEM covers only the south-west of WA.
// The raw region stays on every row for that reason.
const REGION_TO_STATE: Record<string, State> = {
  QLD1: "QLD",
  NSW1: "NSW",
  VIC1: "VIC",
  SA1: "SA",
  TAS1: "TAS",
  WEM: "WA",
  WEMDE: "WA",
};

export const regionToState = (region: string): State =>
  REGION_TO_STATE[region] ?? "OTHER";

// Upstream fueltech ids are specific (`solar_utility`, `gas_ocgt`, `coal_black`);
// the UI groups them by prefix. `pumps` sits with hydro so a pumped-hydro
// facility stays whole under one group.
const TECH_PREFIXES: [string, TechGroup][] = [
  ["solar", "solar"],
  ["wind", "wind"],
  ["hydro", "hydro"],
  ["pumps", "hydro"],
  ["battery", "battery"],
  ["bioenergy", "bioenergy"],
  ["coal", "coal"],
  ["gas", "gas"],
  ["distillate", "distillate"],
];

export const techGroup = (fueltechId: string): TechGroup =>
  TECH_PREFIXES.find(([prefix]) => fueltechId.startsWith(prefix))?.[1] ??
  "other";

const KNOWN_STATUSES: readonly string[] = [
  "committed",
  "commissioning",
  "operating",
  "retired",
];

// The server lets any `status_id` through; here an unknown one becomes `other`
// instead of breaking the app.
export function normalizeStatus(statusId: string): Status {
  const isKnown = (s: string): s is Exclude<Status, "other"> =>
    KNOWN_STATUSES.includes(s);
  return isKnown(statusId) ? statusId : "other";
}

const PRECISIONS: readonly string[] = ["day", "month", "year"];

// A specificity without a date is no date. A date without a recognised
// specificity is treated as year precision, the most conservative reading.
export function toSourceDate(
  iso: string | null | undefined,
  specificity: string | null | undefined,
): SourceDate {
  if (iso == null) return null;
  const isPrecision = (s: string): s is DatePrecision => PRECISIONS.includes(s);
  return {
    iso,
    precision:
      specificity != null && isPrecision(specificity) ? specificity : "year",
  };
}

// Flattens facilities into one row per unit. Runs once after fetch.
export function facilitiesToRows(facilities: FacilityDto[]): UnitRow[] {
  return facilities.flatMap((facility) =>
    facility.units.map((unit): UnitRow => ({
      facilityCode: facility.code,
      facilityName: facility.name,
      unitCode: unit.code,
      state: regionToState(facility.network_region),
      region: facility.network_region,
      fueltech: unit.fueltech_id,
      techGroup: techGroup(unit.fueltech_id),
      status: normalizeStatus(unit.status_id),
      rawStatus: unit.status_id,
      dispatchType: unit.dispatch_type,
      capacityMw: unit.capacity_registered ?? null,
      storageMwh: unit.capacity_storage ?? null,
      commencement: toSourceDate(
        unit.commencement_date,
        unit.commencement_date_specificity,
      ),
      closure: toSourceDate(unit.closure_date, unit.closure_date_specificity),
      expectedOperation: toSourceDate(
        unit.expected_operation_date,
        unit.expected_operation_date_specificity,
      ),
      expectedClosure: toSourceDate(
        unit.expected_closure_date,
        unit.expected_closure_date_specificity,
      ),
      lat: facility.location?.lat ?? null,
      lng: facility.location?.lng ?? null,
      dataFirstSeen: unit.data_first_seen ?? null,
      dataLastSeen: unit.data_last_seen ?? null,
    })),
  );
}
