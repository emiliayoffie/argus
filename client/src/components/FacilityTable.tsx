import { useEffect, useRef } from "react";
import type { Sort, SortKey } from "../domain/facilities";
import {
  formatCount,
  formatMw,
  formatSourceDate,
  isApproximate,
} from "../domain/format";
import { label, type FacilityRow, type SourceDate } from "../domain/types";

export const PAGE_SIZE = 50;

type Props = {
  facilities: FacilityRow[];
  sort: Sort;
  onSort: (sort: Sort) => void;
  page: number;
  onPage: (page: number) => void;
  // Highlighted facilities: click a row to toggle, shift+click to add a range
  selected: string[];
  onToggle: (code: string) => void;
  onSelectRange: (codes: string[]) => void;
  // The row to scroll into view when `locateRequest` changes ("More info" on the map)
  locateCode: string | null;
  locateRequest: number;
};

// Month- and year-precision dates get a ~ so they are not read as exact days
function SourceDateText({ date }: { date: SourceDate }) {
  const text = formatSourceDate(date);
  if (text === null) return <>—</>;
  return isApproximate(date) ? (
    <span title={`Source precision: ${date?.precision}`}>~{text}</span>
  ) : (
    <>{text}</>
  );
}

const COLUMNS: { key: SortKey | null; title: string }[] = [
  { key: "name", title: "Facility" },
  { key: "state", title: "State / region" },
  { key: null, title: "Technology" },
  { key: null, title: "Status" },
  { key: "mw", title: "Matching MW" },
  { key: "units", title: "Units" },
  { key: "keyDate", title: "Key date" },
];

// One row per facility in the current selection. Badges show matching units
// only; the "some units retired" note uses all units. Rows can be highlighted
// here and on the map; highlighting never changes the totals
export function FacilityTable({
  facilities,
  sort,
  onSort,
  page,
  onPage,
  selected,
  onToggle,
  onSelectRange,
  locateCode,
  locateRequest,
}: Props) {
  const locateRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (locateRequest > 0)
      locateRow.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
  }, [locateRequest]);

  // Anchor for shift+click ranges, in the current sort order
  const anchor = useRef<string | null>(null);
  const clickRow = (code: string, shift: boolean) => {
    const from = facilities.findIndex((f) => f.code === anchor.current);
    const to = facilities.findIndex((f) => f.code === code);
    if (shift && from >= 0 && to >= 0) {
      const [lo, hi] = from < to ? [from, to] : [to, from];
      onSelectRange(facilities.slice(lo, hi + 1).map((f) => f.code));
    } else {
      onToggle(code);
    }
    anchor.current = code;
  };

  const pageCount = Math.max(1, Math.ceil(facilities.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const visible = facilities.slice(start, start + PAGE_SIZE);

  // Clicking the active column flips direction; a new column starts descending
  const toggleSort = (key: SortKey) =>
    onSort({
      key,
      direction: sort.key === key && sort.direction === "desc" ? "asc" : "desc",
    });

  return (
    <section aria-labelledby="table-heading">
      <h2 id="table-heading" className="visually-hidden">
        Facilities
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map(({ key, title }) => (
                <th
                  key={title}
                  scope="col"
                  aria-sort={
                    key === sort.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {key ? (
                    <button
                      type="button"
                      className="sort"
                      onClick={() => toggleSort(key)}
                    >
                      {title}
                      {key === sort.key && (
                        <span aria-hidden="true">
                          {sort.direction === "asc" ? " ▲" : " ▼"}
                        </span>
                      )}
                    </button>
                  ) : (
                    title
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((f) => (
              <tr
                key={f.code}
                ref={f.code === locateCode ? locateRow : undefined}
                className={selected.includes(f.code) ? "selected" : undefined}
                aria-selected={selected.includes(f.code)}
                tabIndex={0}
                onClick={(e) => clickRow(f.code, e.shiftKey)}
                onMouseDown={(e) => {
                  // No text selection on shift+click
                  if (e.shiftKey) e.preventDefault();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    clickRow(f.code, e.shiftKey);
                  }
                }}
              >
                <td>
                  <span className="name">{f.name}</span>
                  <span className="muted code">{f.code}</span>
                </td>
                <td title={`Region ${f.region}`}>{label("state", f.state)}</td>
                <td>
                  {f.techGroups.map((t) => (
                    <span key={t} className="badge">
                      {label("techGroup", t)}
                    </span>
                  ))}
                </td>
                <td>
                  {f.statuses.map((s) => (
                    <span key={s} className={`badge status-${s}`}>
                      {label("status", s)}
                    </span>
                  ))}
                  {f.retiredUnits > 0 && f.retiredUnits < f.allUnits && (
                    <span className="muted note">
                      Some units retired ({f.retiredUnits} of {f.allUnits})
                    </span>
                  )}
                </td>
                <td className="num">
                  {f.matchingMw === null ? "—" : formatMw(f.matchingMw)}
                </td>
                <td className="num">
                  {f.matchingUnits === f.allUnits
                    ? formatCount(f.allUnits)
                    : `${formatCount(f.matchingUnits)} of ${formatCount(f.allUnits)} match`}
                </td>
                <td>
                  {f.keyDate ? (
                    <>
                      <span className="muted">
                        {f.keyDate.label}
                        {f.keyDate.past && " (past)"}:
                      </span>{" "}
                      <SourceDateText date={f.keyDate.date} />
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="pagination" aria-label="Pagination">
        <button
          type="button"
          onClick={() => onPage(current - 1)}
          disabled={current === 0}
        >
          Previous
        </button>
        <span>
          {formatCount(start + 1)}–{formatCount(start + visible.length)} of{" "}
          {formatCount(facilities.length)}
        </span>
        <button
          type="button"
          onClick={() => onPage(current + 1)}
          disabled={current >= pageCount - 1}
        >
          Next
        </button>
      </nav>
    </section>
  );
}
