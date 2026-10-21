import { EMPTY_FILTERS } from "./filter";
import {
  DIMENSIONS,
  MEASURES,
  STATES,
  STATUSES,
  TECH_GROUPS,
  type AppState,
  type Dimension,
  type Drilldown,
} from "./types";

export const SEARCH_MAX_LENGTH = 100;

export const DEFAULT_STATE: AppState = {
  filters: EMPTY_FILTERS,
  groupBy: "techGroup",
  measure: "mw",
  drilldown: null,
};

// Which keys a drilldown may use for each dimension
const DRILL_KEYS: Record<Dimension, readonly string[]> = {
  state: STATES,
  techGroup: TECH_GROUPS,
  status: STATUSES,
};

function parseOne<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  return allowed.find((a) => a === value) ?? null;
}

// Unknown values are dropped and duplicates removed, so a list can never
// contain anything outside its enum
function parseList<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T[] {
  if (!value) return [];
  const out: T[] = [];
  for (const part of value.split(",")) {
    const match = parseOne(part, allowed);
    if (match && !out.includes(match)) out.push(match);
  }
  return out;
}

// Reads ?state=NSW,QLD&tech=battery&status=operating&q=bess&by=state&measure=mw&drill=state:NSW
// Everything is untrusted: bad values fall back to defaults rather than erroring
export function parseState(params: URLSearchParams): AppState {
  const groupBy =
    parseOne(params.get("by"), DIMENSIONS) ?? DEFAULT_STATE.groupBy;
  const measure =
    parseOne(params.get("measure"), MEASURES) ?? DEFAULT_STATE.measure;

  // A drilldown only makes sense on the dimension the bars are grouped by
  let drilldown: Drilldown = null;
  const drill = params.get("drill");
  const separator = drill?.indexOf(":") ?? -1;
  if (drill && separator > 0) {
    const dim = parseOne(drill.slice(0, separator), DIMENSIONS);
    const key = drill.slice(separator + 1);
    if (dim === groupBy && DRILL_KEYS[dim].includes(key))
      drilldown = { dim, key };
  }

  return {
    filters: {
      states: parseList(params.get("state"), STATES),
      techGroups: parseList(params.get("tech"), TECH_GROUPS),
      statuses: parseList(params.get("status"), STATUSES),
      search: (params.get("q") ?? "").trim().slice(0, SEARCH_MAX_LENGTH),
    },
    groupBy,
    measure,
    drilldown,
  };
}

// Query string without the "?". Defaults are omitted, so the default view is ""
export function serializeState(state: AppState): string {
  const params = new URLSearchParams();
  const { filters } = state;
  if (filters.states.length) params.set("state", filters.states.join(","));
  if (filters.techGroups.length)
    params.set("tech", filters.techGroups.join(","));
  if (filters.statuses.length) params.set("status", filters.statuses.join(","));
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (state.groupBy !== DEFAULT_STATE.groupBy) params.set("by", state.groupBy);
  if (state.measure !== DEFAULT_STATE.measure)
    params.set("measure", state.measure);
  if (state.drilldown)
    params.set("drill", `${state.drilldown.dim}:${state.drilldown.key}`);
  return params.toString();
}
