import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import "./App.css";
import { ERROR_COPY, useFacilities } from "./api/useFacilities";
import { BackToTop } from "./components/BackToTop";
import { BreakdownPanel } from "./components/BreakdownPanel";
import { FacilityTable, PAGE_SIZE } from "./components/FacilityTable";
import type { Example } from "./components/ExamplesMenu";
import { FilterBar } from "./components/FilterBar";
import { PageSkeleton } from "./components/PageSkeleton";
import { SectionHeading } from "./components/SectionHeading";
import { SummaryStrip } from "./components/SummaryStrip";
import { groupBy, summarize } from "./domain/aggregate";
import {
  facilityLifecycle,
  groupByFacility,
  sortFacilities,
} from "./domain/facilities";
import {
  applyDrilldown,
  applyFilters,
  isEmptyRange,
  resolveRecent,
} from "./domain/filter";
import { formatCount, formatInstant, formatMw } from "./domain/format";
import { downloadCsv, facilitiesToCsv } from "./domain/export";
import { headline } from "./domain/headline";
import {
  DIMENSION_LABELS,
  label,
  type AppState,
  type Dimension,
  type Drilldown,
  type Filters,
  type Sort,
  type UnitRow,
} from "./domain/types";
import {
  DEFAULT_STATE,
  MAX_SELECTED,
  parseState,
  serializeState,
  toggleSelected,
} from "./domain/url";
import { PALETTES, usePalette, useTheme, type Palette } from "./theme";

// Leaflet is only downloaded when the map is first shown
const FacilityMap = lazy(() => import("./components/FacilityMap"));

const PALETTE_NAMES: Record<NonNullable<Palette>, string> = {
  deutan: "deuteranopia (red-green)",
  tritan: "tritanopia (blue-yellow)",
  mono: "achromatopsia (greyscale)",
};

// A stable empty array so memoized derivations don't rerun while loading
const NO_ROWS: UnitRow[] = [];

// Must match the lid-down / lid-up animation durations in App.css
const LID_DOWN_MS = 130;
const LID_UP_MS = 380;

// The three customer questions as plain URL states: a starting point, not a mode
const EXAMPLES: Example[] = [
  {
    question: "Batteries recently online in NSW and QLD",
    hint: "Battery · NSW, QLD · online in the last 12 months",
    query:
      "state=NSW,QLD&tech=battery&status=commissioning,operating&by=status&sort=keyDate:desc&recent=12",
  },
  {
    question: "Committed wind, solar and battery capacity, state by state",
    hint: "Solar, wind, battery · committed · MW by state",
    query: "tech=solar,wind,battery&status=committed&by=state&split=techGroup",
  },
  {
    question: "The fossil fleet: what has retired and what still runs",
    hint: "Coal, gas, distillate · MW by status",
    query: "tech=coal,gas,distillate&by=status&measure=mw&split=techGroup",
  },
];

export default function App() {
  const { result, retry } = useFacilities();
  const { theme, toggle: toggleTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const [blink, setBlink] = useState<"closing" | "opening" | null>(null);
  // Timers, not animationend, finish the blink: the durations mirror
  // lid-down / lid-up in App.css, and a hover animation on the same element
  // can't strand the button mid-blink
  useEffect(() => {
    if (blink === null) return;
    const timer = setTimeout(
      () => {
        if (blink === "closing") toggleTheme();
        setBlink(null);
      },
      blink === "closing" ? LID_DOWN_MS : LID_UP_MS,
    );
    return () => clearTimeout(timer);
  }, [blink, toggleTheme]);
  const eyeClipId = useId();
  const paletteLabelId = useId();
  const exportHintId = useId();
  const mapRegionId = useId();
  // The view is read from the URL once, on mount, and written back from the
  // event handlers below; there's no effect watching either side
  const [state, setState] = useState<AppState>(() =>
    parseState(new URLSearchParams(window.location.search)),
  );
  const [page, setPage] = useState(0);
  const [showMap, setShowMap] = useState(true);
  // "More info" in a map popup: which row to scroll to, and a counter so the
  // same row can be located twice
  const [locate, setLocate] = useState({ code: "", request: 0 });
  // Bumped by Reset so the map refits even if the facilities didn't change
  const [resetRequest, setResetRequest] = useState(0);
  const { groupBy: dim, splitBy, measure, drilldown, sort } = state;

  // Everything below is derived from the state above; no second copy of the
  // data is kept. `base` feeds the bars; `shown` is base narrowed by a bar.
  // Memoized for stable identity, not speed: the map refits whenever the
  // `facilities` array changes, so it must not be a new array every render
  const data = result.status === "ready" ? result.data : null;
  const rows = data?.rows ?? NO_ROWS;
  const asOf = data?.sourceCreatedAt ?? "";
  const asOfDay = asOf.slice(0, 10) || "unknown-date";
  // The `recent=N` shorthand resolves to a date range here; this resolved
  // `filters` is what every downstream consumer sees (same reference when
  // nothing needed resolving, so memo identities survive)
  const filters = useMemo(
    () => resolveRecent(state.filters, asOf),
    [state.filters, asOf],
  );
  const lifecycle = useMemo(() => facilityLifecycle(rows), [rows]);
  const base = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const shown = useMemo(
    () => applyDrilldown(base, drilldown),
    [base, drilldown],
  );
  const summary = summarize(shown);
  const groups = groupBy(base, dim, measure, splitBy);
  const facilities = useMemo(
    () => sortFacilities(groupByFacility(shown, lifecycle, asOf), sort),
    [shown, lifecycle, asOf, sort],
  );
  const exportHint =
    facilities.length === 0
      ? "No facilities to export"
      : `Export all ${formatCount(facilities.length)} matching facilities as CSV`;

  // Every view change goes through here so the URL always matches the screen.
  // replaceState, not pushState: Back should leave the app, not undo a click
  const writeUrl = (next: AppState) => {
    const query = serializeState(next);
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : location.pathname,
    );
  };
  const update = (next: AppState) => {
    setState(next);
    setPage(0);
    writeUrl(next);
  };
  // Map pans and highlighting don't change what's listed, so the page stays
  const patch = (
    partial: Pick<AppState, "view"> | Pick<AppState, "selected">,
  ) => {
    const next = { ...state, ...partial };
    setState(next);
    writeUrl(next);
  };

  // A drilldown only makes sense against the bars it was clicked on, so any
  // change to the filters or grouping clears it
  const changeFilters = (next: Filters) =>
    update({ ...state, filters: next, drilldown: null });
  const changeDim = (next: Dimension) =>
    update({
      ...state,
      groupBy: next,
      // Splitting by the dimension just grouped by would be redundant
      splitBy: next === state.splitBy ? null : state.splitBy,
      drilldown: null,
    });
  const changeSplitBy = (next: Dimension | null) =>
    update({ ...state, splitBy: next, drilldown: null });
  const changeDrilldown = (next: Drilldown) =>
    update({ ...state, drilldown: next });
  // Sort is part of the URL state like the filters, so a shared link lands
  // on the same order; `update` also resets the page
  const changeSort = (next: Sort) => update({ ...state, sort: next });
  const resetAll = () => {
    update(DEFAULT_STATE);
    setShowMap(true);
    setResetRequest((n) => n + 1);
  };
  const isDefault = serializeState({ ...state, filters }) === "";

  // The recent= shorthand resolves to a date range here so the URL stays a
  // faithful copy of the view (a recent= URL loaded directly keeps the
  // shorthand until the first interaction, and re-resolves on each visit)
  const pickExample = (query: string) => {
    const next = parseState(new URLSearchParams(query));
    update({ ...next, filters: resolveRecent(next.filters, asOf) });
    setResetRequest((n) => n + 1);
  };

  // Highlight set: a comparison aid shared via the URL, never a filter
  const toggle = (code: string) =>
    patch({ selected: toggleSelected(state.selected, code) });
  const selectRange = (codes: string[]) =>
    patch({
      selected: [...new Set([...state.selected, ...codes])].slice(
        -MAX_SELECTED,
      ),
    });
  const selectedShown = facilities.filter((f) =>
    state.selected.includes(f.code),
  );
  const selectedMw = selectedShown.reduce(
    (sum, f) => sum + (f.matchingMw ?? 0),
    0,
  );

  return (
    <main aria-busy={result.status === "loading"}>
      <header className="masthead">
        <div>
          <h1>
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault();
                resetAll();
              }}
            >
              Argus
            </a>
            <button
              type="button"
              className={blink ? `theme-toggle ${blink}` : "theme-toggle"}
              data-state={theme === "dark" ? "closed" : "open"}
              onClick={() => {
                // The lid drops over the pupil, the theme flips while it's shut
                if (blink !== null) return;
                if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
                  toggleTheme();
                  return;
                }
                if (theme === "dark") {
                  toggleTheme();
                  setBlink("opening");
                } else {
                  setBlink("closing");
                }
              }}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              data-tip={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              <svg
                className="eye"
                viewBox="0 0 24 20"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <clipPath id={eyeClipId}>
                    <path d="M2.5 10 C2.5 5 6.5 2 12 2 C17.5 2 21.5 5 21.5 10 C21.5 15 17.5 18 12 18 C6.5 18 2.5 15 2.5 10 Z" />
                  </clipPath>
                </defs>
                <g className="eye-shapes">
                  <path
                    className="eye-open"
                    d="M2.5 10 C2.5 5 6.5 2 12 2 C17.5 2 21.5 5 21.5 10 C21.5 15 17.5 18 12 18 C6.5 18 2.5 15 2.5 10 Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinejoin="round"
                  />
                  <ellipse
                    className="eye-open"
                    cx="12"
                    cy="11"
                    rx="5.5"
                    ry="5"
                    fill="currentColor"
                  />
                  <circle
                    className="eye-open"
                    cx="9.8"
                    cy="8.8"
                    r="1.4"
                    fill="var(--paper)"
                  />
                  {/* The clip sits on an untransformed group: a clip-path on
                    the rect itself would scale with it and lose the eye shape */}
                  <g className="eye-open" clipPath={`url(#${eyeClipId})`}>
                    <rect
                      className="lid"
                      x="0"
                      y="-2"
                      width="24"
                      height="22"
                      fill="currentColor"
                    />
                  </g>
                  <path
                    className="eye-closed"
                    d="M3.5 9 Q12 16 20.5 9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </g>
              </svg>
            </button>
          </h1>
          <p className="tagline">
            Australian energy facilities, from OpenElectricity
          </p>
        </div>
        <div
          className="palette-switch"
          role="group"
          aria-labelledby={paletteLabelId}
        >
          <span id={paletteLabelId} className="palette-label">
            Colour-blind palette
          </span>
          {PALETTES.map((p) => {
            // The name states what a click does, so it follows the state
            const tip =
              palette === p
                ? "Return to standard colours"
                : `Enable ${PALETTE_NAMES[p]} palette`;
            return (
              <button
                key={p}
                type="button"
                className="swatch"
                data-palette={p}
                aria-pressed={palette === p}
                aria-label={tip}
                data-tip={tip}
                onClick={() => setPalette(palette === p ? null : p)}
              />
            );
          })}
        </div>
      </header>

      <FilterBar
        filters={filters}
        onChange={changeFilters}
        onReset={resetAll}
        canReset={!isDefault}
        disabled={result.status === "loading"}
        asOf={asOf}
        examples={EXAMPLES}
        onPickExample={pickExample}
      />

      {result.status === "loading" && (
        <>
          <p className="visually-hidden" role="status" aria-live="polite">
            Loading facilities from OpenElectricity…
          </p>
          <PageSkeleton />
        </>
      )}

      {result.status === "error" && (
        <div className="banner-error" role="alert">
          <p>{ERROR_COPY[result.code].text}</p>
          {ERROR_COPY[result.code].retryable && (
            <button type="button" onClick={retry}>
              Retry
            </button>
          )}
        </div>
      )}

      {data && (
        <div className="fade-in content">
          <p className="headline">
            {headline(
              { ...state, filters },
              summary,
              drilldown ? label(drilldown.dim, drilldown.key) : null,
            ).map((part, i) =>
              // Index keys are safe: the parts are a fixed-shape sequence with
              // no per-item state. The sweep is pure CSS on .figure and
              // repeats on a timer, so filter changes don't restart it
              part.figure ? (
                <strong key={i} className="figure">
                  {part.text}
                </strong>
              ) : (
                <Fragment key={i}>{part.text}</Fragment>
              ),
            )}
          </p>
          <SummaryStrip
            summary={summary}
            hasDateFilter={
              !isEmptyRange(filters.commenced) ||
              !isEmptyRange(filters.expected) ||
              !isEmptyRange(filters.closed)
            }
          />

          <SectionHeading
            number="01"
            id="breakdown-heading"
            title="Capacity breakdown"
          >
            {measure === "mw" ? "Registered MW" : "Distinct facilities"} by{" "}
            {DIMENSION_LABELS[dim].toLowerCase()}. Click a bar to narrow
            everything below it.
          </SectionHeading>
          <BreakdownPanel
            groups={groups}
            groupBy={dim}
            measure={measure}
            selectedKey={drilldown?.key ?? null}
            onGroupBy={changeDim}
            splitBy={splitBy}
            onSplitBy={changeSplitBy}
            onMeasure={(next) => update({ ...state, measure: next })}
            onSelect={(key) =>
              changeDrilldown(drilldown?.key === key ? null : { dim, key })
            }
          />

          <section className="results" aria-labelledby="map-heading">
            <SectionHeading
              number="02"
              id="map-heading"
              title="Map"
              actions={
                <button
                  type="button"
                  className="map-toggle"
                  aria-expanded={showMap}
                  aria-controls={mapRegionId}
                  disabled={facilities.length === 0}
                  onClick={() => setShowMap((on) => !on)}
                >
                  {showMap ? "Collapse" : "Expand"}
                  <svg
                    className="chevron"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="m6 15 6-6 6 6" />
                  </svg>
                </button>
              }
            >
              Every facility in the current view, sized by matching MW and
              coloured by status. Click a marker to highlight it here and in the
              table.
            </SectionHeading>
            {(drilldown || state.selected.length > 0) && (
              <div className="results-header">
                {drilldown && (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => changeDrilldown(null)}
                    aria-label={`Clear selection ${label(drilldown.dim, drilldown.key)}`}
                  >
                    Showing: {label(drilldown.dim, drilldown.key)}{" "}
                    <span aria-hidden="true">×</span>
                  </button>
                )}
                {state.selected.length > 0 && (
                  <button
                    type="button"
                    className="chip chip-selected"
                    onClick={() => patch({ selected: [] })}
                    aria-label={`Clear ${state.selected.length} highlighted facilities`}
                    title="Highlighted facilities are marked on the map and in the table; totals are unaffected"
                  >
                    {formatCount(state.selected.length)} highlighted
                    {selectedShown.length > 0 && ` · ${formatMw(selectedMw)}`}
                    {selectedShown.length < state.selected.length &&
                      ` (${formatCount(selectedShown.length)} in view)`}{" "}
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
            )}

            {/* The map stays mounted while collapsed so its viewport, markers
                and open popup survive; it is only hidden */}
            {facilities.length > 0 ? (
              <div id={mapRegionId} hidden={!showMap}>
                <Suspense
                  fallback={
                    <>
                      <p className="visually-hidden" role="status">
                        Loading map…
                      </p>
                      <div className="bone map-canvas" aria-hidden="true" />
                    </>
                  }
                >
                  <FacilityMap
                    facilities={facilities}
                    view={state.view}
                    resetRequest={resetRequest}
                    visible={showMap}
                    onViewChange={(view) => patch({ view })}
                    selected={state.selected}
                    onToggle={toggle}
                    onLocate={(code) => {
                      if (!state.selected.includes(code)) toggle(code);
                      const index = facilities.findIndex(
                        (f) => f.code === code,
                      );
                      if (index >= 0) setPage(Math.floor(index / PAGE_SIZE));
                      setLocate((l) => ({ code, request: l.request + 1 }));
                    }}
                  />
                </Suspense>
              </div>
            ) : (
              <p className="muted">No facilities to map.</p>
            )}
          </section>

          <section className="results" aria-labelledby="results-heading">
            <SectionHeading
              number="03"
              id="results-heading"
              title="Facilities"
              actions={
                <>
                  <button
                    type="button"
                    className="export"
                    onClick={() =>
                      downloadCsv(
                        `argus-facilities-${asOfDay}.csv`,
                        facilitiesToCsv(facilities),
                      )
                    }
                    disabled={facilities.length === 0}
                    aria-describedby={exportHintId}
                    data-tip={exportHint}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M12 3v12" />
                      <path d="m6 10 6 6 6-6" />
                      <path d="M4 21h16" />
                    </svg>
                    Export CSV
                  </button>
                  <span id={exportHintId} className="visually-hidden">
                    {exportHint}
                  </span>
                </>
              }
            >
              The same facilities as a sortable table. Highlight rows to compare
              them with the map; export the full list as CSV.
            </SectionHeading>

            {facilities.length === 0 ? (
              <div className="status">
                <p>
                  No units match the current filters
                  {filters.search && ` and search “${filters.search}”`}.
                </p>
                {!isDefault && (
                  <button type="button" onClick={resetAll}>
                    Reset
                  </button>
                )}
              </div>
            ) : (
              <FacilityTable
                facilities={facilities}
                sort={sort}
                onSort={changeSort}
                page={page}
                onPage={setPage}
                selected={state.selected}
                onToggle={toggle}
                onSelectRange={selectRange}
                locateCode={locate.code}
                locateRequest={locate.request}
              />
            )}
          </section>
        </div>
      )}

      <footer className="muted">
        Source: <a href="https://openelectricity.org.au">OpenElectricity</a>
        {data && (
          <>
            {" "}
            · {formatCount(data.rows.length)} units in the full dataset · data
            as of {formatInstant(data.sourceCreatedAt)} · fetched{" "}
            {formatInstant(data.fetchedAt)}
          </>
        )}
        . Statuses are registry classifications, not live availability.
      </footer>

      <BackToTop />
    </main>
  );
}
