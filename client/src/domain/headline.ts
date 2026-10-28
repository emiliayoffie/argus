import { formatCount, formatMw, formatMwh, formatSourceDate } from "./format";
import { label, type AppState, type DateRange, type Summary } from "./types";

// "a", "a and b", "a, b and c"
const list = (items: string[], conjunction: "and" | "or"): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1) ?? ""}`;

// A run of the sentence; `figure` marks the numbers so the UI can emphasise
// them without parsing the text
export type HeadlinePart = { text: string; figure: boolean };

export const headlineText = (parts: HeadlinePart[]): string =>
  parts.map((p) => p.text).join("");

// One sentence that states what the current view is and what it adds up to,
// built from the same state and summary the cards use, e.g.
// "34 battery facilities in NSW and QLD, operating or commissioning — 8,092 MW registered, 17.2 GWh of battery storage."
// Returned as parts: the facility count, MW and MWh are figures, the rest is
// plain text, and joining the parts gives the sentence above
export function headline(
  state: AppState,
  summary: Summary,
  drilldownLabel: string | null,
): HeadlinePart[] {
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
  // The date range is written out in words; either side may be open
  const day = (iso: string) =>
    formatSourceDate({ iso, precision: "day" }) ?? iso;
  const rangeText = (range: DateRange, verb: string) =>
    range.from !== null && range.to !== null
      ? `, ${verb} ${day(range.from)} – ${day(range.to)}`
      : range.from !== null
        ? `, ${verb} from ${day(range.from)}`
        : range.to !== null
          ? `, ${verb} until ${day(range.to)}`
          : "";
  const dates =
    rangeText(filters.commenced, "came online") +
    rangeText(filters.expected, "expected online") +
    rangeText(filters.closed, "closed");
  const narrowed = drilldownLabel ? ` (showing ${drilldownLabel})` : "";

  // Figures that would be unknown are left out rather than shown as 0
  const tail: HeadlinePart[] = [];
  if (summary.mwUnitCount > 0)
    tail.push(
      { text: formatMw(summary.totalMw), figure: true },
      { text: " registered", figure: false },
    );
  if (summary.batteryUnits > 0 && summary.batteryStorageMwh > 0) {
    if (tail.length) tail.push({ text: ", ", figure: false });
    tail.push(
      { text: formatMwh(summary.batteryStorageMwh), figure: true },
      { text: " of battery storage", figure: false },
    );
  }

  return [
    { text: formatCount(summary.facilityCount), figure: true },
    {
      text: ` ${subject}${where}${statuses}${search}${dates}${narrowed}`,
      figure: false,
    },
    ...(tail.length
      ? [{ text: " — ", figure: false }, ...tail, { text: ".", figure: false }]
      : [{ text: ".", figure: false }]),
  ];
}
