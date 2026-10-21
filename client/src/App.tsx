import "./App.css";
import { ERROR_COPY, useFacilities, type Dataset } from "./api/useFacilities";
import { summarize } from "./domain/aggregate";
import { formatCount, formatInstant, formatMw } from "./domain/format";

function Headline({ data }: { data: Dataset }) {
  const summary = summarize(data.rows);
  return (
    <section>
      <p>
        {formatCount(summary.facilityCount)} facilities ·{" "}
        {formatCount(summary.unitCount)} units · {formatMw(summary.totalMw)}{" "}
        registered
      </p>
      <p className="muted">Fetched {formatInstant(data.fetchedAt)}</p>
    </section>
  );
}

export default function App() {
  const { result, retry } = useFacilities();
  return (
    <main>
      <header>
        <h1>Argus</h1>
        <p>Australian energy facilities, from OpenElectricity</p>
      </header>
      {result.status === "loading" && (
        <p role="status" aria-live="polite">
          Loading facilities from OpenElectricity…
        </p>
      )}
      {result.status === "error" && (
        <div role="alert">
          <p>{ERROR_COPY[result.code].text}</p>
          {ERROR_COPY[result.code].retryable && (
            <button type="button" onClick={retry}>
              Retry
            </button>
          )}
        </div>
      )}
      {result.status === "ready" && <Headline data={result.data} />}
    </main>
  );
}
