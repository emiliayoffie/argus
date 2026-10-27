import { isCalendarDate } from "./format";
import { EMPTY_FILTERS } from "./filter";
import {
  DEFAULT_SORT,
  DIMENSIONS,
  MEASURES,
  RECENT_MONTHS,
  SORT_KEYS,
  STATES,
  STATUSES,
  TECH_GROUPS,
  type AppState,
  type Dimension,
  type Drilldown,
  type MapView,
  type RecentMonths,
  EMPTY_RANGE,
  type DateRange,
  type Sort,
} from "./types";

export const SEARCH_MAX_LENGTH = 100;

export const DEFAULT_STATE: AppState = {
  filters: EMPTY_FILTERS,
  groupBy: "techGroup",
  splitBy: null,
  measure: "mw",
  drilldown: null,
  view: null,
  selected: [],
  sort: DEFAULT_SORT,
};

// Facility codes are short upstream identifiers; anything else is ignored
const FACILITY_CODE = /^[A-Za-z0-9_-]{1,40}$/;
export const MAX_SELECTED = 20;

// sel=A,B,C: valid, deduplicated codes, capped at MAX_SELECTED
export function parseSelected(value: string | null): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const code of value.split(",")) {
    if (FACILITY_CODE.test(code) && !out.includes(code)) out.push(code);
    if (out.length === MAX_SELECTED) break;
  }
  return out;
}

// Adds or removes one facility from the highlight set, dropping the oldest
// when over the cap
export function toggleSelected(selected: string[], code: string): string[] {
  return selected.includes(code)
    ? selected.filter((c) => c !== code)
    : [...selected, code].slice(-MAX_SELECTED);
}

const MAX_ZOOM = 20;

// view=lat,lng,zoom. Out of range or malformed means "fit to selection"
export function parseView(value: string | null): MapView {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;
  const [lat, lng, zoom] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (zoom < 0 || zoom > MAX_ZOOM) return null;
  return { lat, lng, zoom };
}

export const serializeView = (view: NonNullable<MapView>): string =>
  `${view.lat.toFixed(4)},${view.lng.toFixed(4)},${Number(view.zoom.toFixed(2))}`;

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

// sort=key:asc|desc. Anything malformed falls back to the default order
function parseSort(value: string | null): Sort {
  const separator = value?.indexOf(":") ?? -1;
  if (!value || separator <= 0) return DEFAULT_SORT;
  const key = parseOne(value.slice(0, separator), SORT_KEYS);
  const direction = value.slice(separator + 1);
  if (!key || (direction !== "asc" && direction !== "desc"))
    return DEFAULT_SORT;
  return { key, direction };
}

// recent=6|12|24, the only windows offered. Input-only: resolved into
// `commenced` before use and never serialised back out
function parseRecent(value: string | null): RecentMonths {
  if (!value) return null;
  return RECENT_MONTHS.find((m) => String(m) === value) ?? null;
}

// commenced=FROM..TO, either side may be empty. Without `..` the whole value
// is a one-sided `from`. Non-calendar dates on either side are open ends
function parseCommenced(value: string | null): DateRange {
  if (!value) return { ...EMPTY_RANGE };
  const separator = value.indexOf("..");
  const rawFrom = separator >= 0 ? value.slice(0, separator) : value;
  const rawTo = separator >= 0 ? value.slice(separator + 2) : "";
  return {
    from: isCalendarDate(rawFrom) ? rawFrom : null,
    to: isCalendarDate(rawTo) ? rawTo : null,
  };
}

// Reads ?state=NSW,QLD&tech=battery&status=operating&q=bess&by=state&measure=mw&drill=state:NSW&sort=keyDate:desc&recent=12
// Everything is untrusted: bad values fall back to defaults rather than erroring
export function parseState(params: URLSearchParams): AppState {
  const groupBy =
    parseOne(params.get("by"), DIMENSIONS) ?? DEFAULT_STATE.groupBy;
  // A split that mirrors the group dimension is redundant: drop it
  const splitBy =
    parseOne(params.get("split"), DIMENSIONS) === groupBy
      ? null
      : (parseOne(params.get("split"), DIMENSIONS) ?? null);
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
      recentMonths: parseRecent(params.get("recent")),
      commenced: parseCommenced(params.get("commenced")),
    },
    groupBy,
    splitBy,
    measure,
    drilldown,
    view: parseView(params.get("view")),
    selected: parseSelected(params.get("sel")),
    sort: parseSort(params.get("sort")),
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
  if (filters.commenced.from !== null || filters.commenced.to !== null)
    params.set(
      "commenced",
      `${filters.commenced.from ?? ""}..${filters.commenced.to ?? ""}`,
    );
  if (state.groupBy !== DEFAULT_STATE.groupBy) params.set("by", state.groupBy);
  if (state.splitBy !== null) params.set("split", state.splitBy);
  if (state.measure !== DEFAULT_STATE.measure)
    params.set("measure", state.measure);
  if (state.drilldown)
    params.set("drill", `${state.drilldown.dim}:${state.drilldown.key}`);
  if (state.view) params.set("view", serializeView(state.view));
  if (state.selected.length) params.set("sel", state.selected.join(","));
  if (
    state.sort.key !== DEFAULT_SORT.key ||
    state.sort.direction !== DEFAULT_SORT.direction
  )
    params.set("sort", `${state.sort.key}:${state.sort.direction}`);
  return params.toString();
}
