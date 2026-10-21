import { useState } from "react";
import "./App.css";
import { ERROR_COPY, useFacilities } from "./api/useFacilities";
import { EMPTY_FILTERS, FilterBar } from "./components/FilterBar";
import { SummaryStrip } from "./components/SummaryStrip";
import { summarize } from "./domain/aggregate";
import { applyFilters } from "./domain/filter";
import { formatCount, formatInstant } from "./domain/format";
import type { Filters } from "./domain/types";

export default function App() {
  const { result, retry } = useFacilities();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  // Everything below is derived from `result` and `filters`; no second copy
  // of the data is kept in state
  const data = result.status === "ready" ? result.data : null;
  const base = data ? applyFilters(data.rows, filters) : [];
  const summary = summarize(base);

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
        onChange={setFilters}
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
