import type { Drilldown, Filters, UnitRow } from "./types";

export const EMPTY_FILTERS: Filters = {
  states: [],
  techGroups: [],
  statuses: [],
  search: "",
};

// Unit-aware filtering: every facet must match the same unit, so a hybrid
// facility's solar unit can't satisfy a battery filter on its behalf.
// Empty facet = all; OR within a facet; AND across facets.
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
        row.facilityCode.toLowerCase().includes(search)),
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
