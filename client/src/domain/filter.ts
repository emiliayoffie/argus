import { dateSortKey, isCalendarDate, monthsBefore } from "./format";
import {
  EMPTY_RANGE,
  type DateRange,
  type Drilldown,
  type Filters,
  type UnitRow,
} from "./types";

export const EMPTY_FILTERS: Filters = {
  states: [],
  techGroups: [],
  statuses: [],
  search: "",
  recentMonths: null,
  commenced: { ...EMPTY_RANGE },
};

// Turns the `recent=N` URL shorthand into an explicit commenced range so the
// rest of the app only ever deals in dates. An explicit `from` wins over the
// shorthand. With nothing to resolve, the same object comes back so memoized
// work isn't invalidated
export function resolveRecent(filters: Filters, asOf: string): Filters {
  const asOfDay = asOf.slice(0, 10);
  if (filters.recentMonths === null || !isCalendarDate(asOfDay)) return filters;
  return {
    ...filters,
    recentMonths: null,
    commenced: {
      from:
        filters.commenced.from ?? monthsBefore(asOfDay, filters.recentMonths),
      to: filters.commenced.to,
    },
  };
}

export const isEmptyRange = (r: DateRange): boolean =>
  r.from === null && r.to === null;

// Inclusive YYYY-MM-DD window; either side may be open, and `from > to`
// simply matches nothing. Only operating and commissioning count as "came
// online"; a missing commencement is out, as is a start on a retired unit.
// Month/year-precision dates compare at the first day of their period
export function commencedWithin(row: UnitRow, range: DateRange): boolean {
  if (row.status !== "operating" && row.status !== "commissioning")
    return false;
  const key = dateSortKey(row.commencement);
  return (
    key !== null &&
    (range.from === null || key >= range.from) &&
    (range.to === null || key <= range.to)
  );
}

// Unit-aware filtering: every facet must match the same unit, so a hybrid
// facility's solar unit can't satisfy a battery filter on its behalf.
// Empty facet = all; OR within a facet; AND across facets. An empty commenced
// range is no constraint at all, so its status rule doesn't apply either
export function applyFilters(rows: UnitRow[], filters: Filters): UnitRow[] {
  const search = filters.search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filters.states.length === 0 || filters.states.includes(row.state)) &&
      (filters.techGroups.length === 0 ||
        filters.techGroups.includes(row.techGroup)) &&
      (filters.statuses.length === 0 ||
        filters.statuses.includes(row.status)) &&
      (search === "" ||
        row.facilityName.toLowerCase().includes(search) ||
        row.facilityCode.toLowerCase().includes(search)) &&
      (isEmptyRange(filters.commenced) ||
        commencedWithin(row, filters.commenced)),
  );
}

// Narrows the already-filtered rows to one breakdown group. The breakdown
// itself is computed from the rows *before* this step, so clicking a bar
// never removes the other bars.
export function applyDrilldown(
  rows: UnitRow[],
  drilldown: Drilldown,
): UnitRow[] {
  return drilldown
    ? rows.filter((row) => row[drilldown.dim] === drilldown.key)
    : rows;
}
