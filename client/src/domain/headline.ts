import { formatCount, formatMw, formatMwh } from "./format";
import { label, type AppState, type Summary } from "./types";

// "a", "a and b", "a, b and c"
const list = (items: string[], conjunction: "and" | "or"): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1) ?? ""}`;

// One sentence that states what the current view is and what it adds up to,
// built from the same state and summary the cards use, e.g.
// "34 battery facilities in NSW and QLD, operating or commissioning — 8,092 MW registered, 17.2 GWh of battery storage."
export function headline(
  state: AppState,
  summary: Summary,
  drilldownLabel: string | null,
): string {
  const { filters } = state;
  const techs = filters.techGroups.map((t) =>
    label("techGroup", t).toLowerCase(),
  );
  const noun = summary.facilityCount === 1 ? "facility" : "facilities";
  const subject = techs.length
    ? `${list(techs, "and")} ${noun}`
    : `energy ${noun}`;
  const where = filters.states.length
    ? ` in ${list(
        filters.states.map((s) => label("state", s)),
        "and",
      )}`
    : " across Australia";
  const statuses = filters.statuses.length
    ? `, ${list(
        filters.statuses.map((s) => label("status", s).toLowerCase()),
        "or",
      )}`
    : "";
  const search = filters.search.trim()
    ? `, matching “${filters.search.trim()}”`
    : "";
  const narrowed = drilldownLabel ? ` (showing ${drilldownLabel})` : "";

  // Figures that would be unknown are left out rather than shown as 0
  const figures: string[] = [];
  if (summary.mwUnitCount > 0)
    figures.push(`${formatMw(summary.totalMw)} registered`);
  if (summary.batteryUnits > 0 && summary.batteryStorageMwh > 0)
    figures.push(`${formatMwh(summary.batteryStorageMwh)} of battery storage`);
  const tail = figures.length ? ` — ${figures.join(", ")}.` : ".";

  return `${formatCount(summary.facilityCount)} ${subject}${where}${statuses}${search}${narrowed}${tail}`;
}
