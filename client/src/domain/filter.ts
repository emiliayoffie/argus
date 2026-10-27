import { dateSortKey, monthsBefore } from "./format";
import type { Drilldown, Filters, UnitRow } from "./types";

export const EMPTY_FILTERS: Filters = {
  states: [],
  techGroups: [],
  statuses: [],
  search: "",
  recentMonths: null,
};

// `from`/`to` are inclusive YYYY-MM-DD strings, so a range picker can reuse
// this later. Only operating and commissioning count as "came online";
// a missing commencement is out, as is a recent start on a retired unit.
// Month/year-precision dates compare at the first day of their period
export function commencedWithin(
  row: UnitRow,
  from: string,
  to: string,
): boolean {
  if (row.status !== "operating" && row.status !== "commissioning")
    return false;
  const key = dateSortKey(row.commencement);
  return key !== null && from <= key && key <= to;
}

// Unit-aware filtering: every facet must match the same unit, so a hybrid
// facility's solar unit can't satisfy a battery filter on its behalf.
// Empty facet = all; OR within a facet; AND across facets.
// `asOf` is the dataset's `created_at`: the "recent" window is measured from
// it, not from today, so a shared link keeps meaning the same thing
export function applyFilters(
  rows: UnitRow[],
  filters: Filters,
  asOf: string,
): UnitRow[] {
  const search = filters.search.trim().toLowerCase();
  const to = asOf.slice(0, 10);
  const recentFrom =
    filters.recentMonths !== null && to.length === 10
      ? monthsBefore(to, filters.recentMonths)
      : null;
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
      (recentFrom === null || commencedWithin(row, recentFrom, to)),
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
