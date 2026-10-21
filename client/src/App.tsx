import { useState } from "react";
import "./App.css";
import { ERROR_COPY, useFacilities } from "./api/useFacilities";
import { BreakdownPanel } from "./components/BreakdownPanel";
import { FacilityTable } from "./components/FacilityTable";
import { FilterBar } from "./components/FilterBar";
import { SummaryStrip } from "./components/SummaryStrip";
import { groupBy, summarize } from "./domain/aggregate";
import {
  DEFAULT_SORT,
  facilityLifecycle,
  groupByFacility,
  sortFacilities,
  type Sort,
} from "./domain/facilities";
import { applyDrilldown, applyFilters } from "./domain/filter";
import { formatCount, formatInstant } from "./domain/format";
import {
  label,
  type AppState,
  type Dimension,
  type Drilldown,
  type Filters,
} from "./domain/types";
import { parseState, serializeState } from "./domain/url";

export default function App() {
  const { result, retry } = useFacilities();
  // The view is read from the URL once, on mount, and written back from the
  // event handlers below. There is no effect watching either side
  const [state, setState] = useState<AppState>(() =>
    parseState(new URLSearchParams(window.location.search)),
  );
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [page, setPage] = useState(0);
  const { filters, groupBy: dim, measure, drilldown } = state;

  // Everything below is derived from the state above; no second copy of the
  // data is kept. `base` feeds the bars; `shown` is base narrowed by a bar
  const data = result.status === "ready" ? result.data : null;
  const base = data ? applyFilters(data.rows, filters) : [];
  const shown = applyDrilldown(base, drilldown);
  const summary = summarize(shown);
  const groups = groupBy(base, dim, measure);
  const facilities = data
    ? sortFacilities(
        groupByFacility(
          shown,
          facilityLifecycle(data.rows),
          data.sourceCreatedAt,
        ),
        sort,
      )
    : [];

  // Every view change goes through here so the URL always matches the screen.
  // replaceState, not pushState: Back should leave the app, not undo a click
  const update = (next: AppState) => {
    setState(next);
    setPage(0);
    const query = serializeState(next);
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : location.pathname,
    );
  };

  // A drilldown only makes sense against the bars it was clicked on, so any
  // change to the filters or grouping clears it
  const changeFilters = (next: Filters) =>
    update({ ...state, filters: next, drilldown: null });
  const changeDim = (next: Dimension) =>
    update({ ...state, groupBy: next, drilldown: null });
  const changeDrilldown = (next: Drilldown) =>
    update({ ...state, drilldown: next });
  const changeSort = (next: Sort) => {
    setSort(next);
    setPage(0);
  };

  return (
    <main>
      <header className="masthead">
        <h1>Argus</h1>
        <p className="muted">
          Australian energy facilities, from OpenElectricity
        </p>
      </header>

      <FilterBar
        filters={filters}
        onChange={changeFilters}
        disabled={result.status === "loading"}
      />

      {result.status === "loading" && (
        <p className="status" role="status" aria-live="polite">
          Loading facilities from OpenElectricity…
        </p>
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
        <>
          <BreakdownPanel
            groups={groups}
            groupBy={dim}
            measure={measure}
            selectedKey={drilldown?.key ?? null}
            onGroupBy={changeDim}
            onMeasure={(next) => update({ ...state, measure: next })}
            onSelect={(key) =>
              changeDrilldown(drilldown?.key === key ? null : { dim, key })
            }
          />
          {drilldown && (
            <p className="drilldown-note">
              Showing <strong>{label(drilldown.dim, drilldown.key)}</strong>{" "}
              only.{" "}
              <button type="button" onClick={() => changeDrilldown(null)}>
                Clear
              </button>
            </p>
          )}
          <SummaryStrip summary={summary} />
          {facilities.length === 0 ? (
            <p className="status">
              No units match these filters. Try removing one.
            </p>
          ) : (
            <FacilityTable
              facilities={facilities}
              sort={sort}
              onSort={changeSort}
              page={page}
              onPage={setPage}
            />
          )}
          <p className="muted">
            {formatCount(data.rows.length)} units in the full dataset · fetched{" "}
            {formatInstant(data.fetchedAt)} · source dated{" "}
            {formatInstant(data.sourceCreatedAt)}
          </p>
        </>
      )}
    </main>
  );
}
