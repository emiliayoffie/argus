import { useState } from "react";
import "./App.css";
import { ERROR_COPY, useFacilities } from "./api/useFacilities";
import { BreakdownPanel } from "./components/BreakdownPanel";
import { EMPTY_FILTERS, FilterBar } from "./components/FilterBar";
import { SummaryStrip } from "./components/SummaryStrip";
import { groupBy, summarize } from "./domain/aggregate";
import { applyDrilldown, applyFilters } from "./domain/filter";
import { formatCount, formatInstant } from "./domain/format";
import {
  label,
  type Dimension,
  type Drilldown,
  type Filters,
  type Measure,
} from "./domain/types";

export default function App() {
  const { result, retry } = useFacilities();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [dim, setDim] = useState<Dimension>("techGroup");
  const [measure, setMeasure] = useState<Measure>("mw");
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

  // Everything below is derived from the state above; no second copy of the
  // data is kept. `base` feeds the bars; `shown` is base narrowed by a bar
  const data = result.status === "ready" ? result.data : null;
  const base = data ? applyFilters(data.rows, filters) : [];
  const shown = applyDrilldown(base, drilldown);
  const summary = summarize(shown);
  const groups = groupBy(base, dim, measure);

  // A drilldown only makes sense against the bars it was clicked on, so any
  // change to the filters or grouping clears it
  const changeFilters = (next: Filters) => {
    setFilters(next);
    setDrilldown(null);
  };
  const changeDim = (next: Dimension) => {
    setDim(next);
    setDrilldown(null);
  };
  const toggleDrilldown = (key: string) =>
    setDrilldown(drilldown?.key === key ? null : { dim, key });

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
            onMeasure={setMeasure}
            onSelect={toggleDrilldown}
          />
          {drilldown && (
            <p className="drilldown-note">
              Showing <strong>{label(drilldown.dim, drilldown.key)}</strong>{" "}
              only.{" "}
              <button type="button" onClick={() => setDrilldown(null)}>
                Clear
              </button>
            </p>
          )}
          <SummaryStrip summary={summary} />
          {base.length === 0 && (
            <p className="status">
              No units match these filters. Try removing one.
            </p>
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
