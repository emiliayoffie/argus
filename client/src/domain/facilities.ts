import { dateSortKey, isCalendarDate, yearsAfter } from "./format";
import {
  STATUSES,
  TECH_GROUPS,
  type FacilityRow,
  type KeyDate,
  type Sort,
  type SourceDate,
  type UnitRow,
} from "./types";

// How far out a published expected-closure date still counts as a plan
export const CLOSING_HORIZON_YEARS = 10;

// A unit has up to four dates but only one is meaningful for its status:
// committed → expected start, operating → actual start, retired → closure
// `asOf` is the dataset's `created_at`; a committed unit whose expected date
// is already before it is flagged `past`
export function keyDate(row: UnitRow, asOf: string): KeyDate | null {
  switch (row.status) {
    case "committed": {
      const key = dateSortKey(row.expectedOperation);
      const past = key !== null && key < asOf.slice(0, 10);
      return { label: "Expected", date: row.expectedOperation, past };
    }
    case "commissioning":
      return { label: "Commissioning", date: row.commencement, past: false };
    case "operating":
      return { label: "Online since", date: row.commencement, past: false };
    case "retired":
      return { label: "Closed", date: row.closure, past: false };
    case "other":
      return null;
  }
}

export type Lifecycle = { retiredUnits: number; allUnits: number };

// Per-facility unit counts over ALL rows, ignoring filters and drilldown, so a
// facility reached through a "Retired" filter can still say "2 of 6 units
// retired" instead of looking fully retired
export function facilityLifecycle(allRows: UnitRow[]): Map<string, Lifecycle> {
  const lifecycle = new Map<string, Lifecycle>();
  for (const row of allRows) {
    let entry = lifecycle.get(row.facilityCode);
    if (!entry) {
      entry = { retiredUnits: 0, allUnits: 0 };
      lifecycle.set(row.facilityCode, entry);
    }
    entry.allUnits++;
    if (row.status === "retired") entry.retiredUnits++;
  }
  return lifecycle;
}

// One table row per facility, built from the shown unit rows. Technologies,
// statuses, MW and unit count are "matching" (from the shown rows only);
// retiredUnits/allUnits come from `lifecycle` (all units). The facility's key
// date is the latest key date among its matching units, label included
export function groupByFacility(
  shownRows: UnitRow[],
  lifecycle: Map<string, Lifecycle>,
  asOf: string,
): FacilityRow[] {
  const byFacility = new Map<string, UnitRow[]>();
  for (const row of shownRows) {
    const units = byFacility.get(row.facilityCode);
    if (units) units.push(row);
    else byFacility.set(row.facilityCode, [row]);
  }

  return [...byFacility.entries()].map(([code, units]) => {
    const counted = units.filter((u) => u.mwEligible && u.capacityMw != null);

    let latest: KeyDate | null = null;
    for (const u of units) {
      const kd = keyDate(u, asOf);
      if (!kd) continue;
      const key = dateSortKey(kd.date);
      if (
        latest === null ||
        (key !== null && key > (dateSortKey(latest.date) ?? ""))
      )
        latest = kd;
    }

    // Earliest published closure among operating units, but only within the
    // horizon: most units carry a 30–80-year placeholder date that isn't a
    // real decommissioning plan
    let closing: SourceDate | null = null;
    const asOfDay = asOf.slice(0, 10);
    if (isCalendarDate(asOfDay)) {
      const horizon = yearsAfter(asOfDay, CLOSING_HORIZON_YEARS);
      for (const u of units) {
        if (u.status !== "operating") continue;
        const key = dateSortKey(u.expectedClosure);
        if (
          key !== null &&
          key <= horizon &&
          (closing === null || key < (dateSortKey(closing) ?? "￿"))
        ) {
          closing = u.expectedClosure;
        }
      }
    }

    const life = lifecycle.get(code) ?? {
      retiredUnits: 0,
      allUnits: units.length,
    };
    return {
      code,
      name: units[0].facilityName,
      state: units[0].state,
      region: units[0].region,
      techGroups: [...new Set(units.map((u) => u.techGroup))].sort(
        (a, b) => TECH_GROUPS.indexOf(a) - TECH_GROUPS.indexOf(b),
      ),
      statuses: [...new Set(units.map((u) => u.status))].sort(
        (a, b) => STATUSES.indexOf(a) - STATUSES.indexOf(b),
      ),
      matchingMw: counted.length
        ? counted.reduce((sum, u) => sum + (u.capacityMw ?? 0), 0)
        : null,
      matchingUnits: units.length,
      retiredUnits: life.retiredUnits,
      allUnits: life.allUnits,
      keyDate: latest,
      closing,
      lat: units[0].lat,
      lng: units[0].lng,
    };
  });
}

// Returns a sorted copy; null values (unknown MW, missing dates) go last in
// both directions. Array.sort is stable, so ties keep their original order
export function sortFacilities(rows: FacilityRow[], sort: Sort): FacilityRow[] {
  const value = (row: FacilityRow): string | number | null => {
    switch (sort.key) {
      case "name":
        return row.name.toLowerCase();
      case "state":
        return row.state;
      case "mw":
        return row.matchingMw;
      case "units":
        return row.matchingUnits;
      case "keyDate":
        return row.keyDate ? dateSortKey(row.keyDate.date) : null;
    }
  };
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av === null || bv === null)
      return Number(av === null) - Number(bv === null);
    return av < bv ? -sign : av > bv ? sign : 0;
  });
}
