import { formatCount, formatMw, formatMwh } from "../domain/format";
import { label, type Summary } from "../domain/types";

// Totals for the current selection
export function SummaryStrip({ summary }: { summary: Summary }) {
  const noMw = summary.mwUnitCount === 0;
  return (
    <section className="summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="visually-hidden">
        Summary of the current selection
      </h2>
      <div className="card">
        <h3>Distinct facilities</h3>
        <p className="value">{formatCount(summary.facilityCount)}</p>
      </div>
      <div className="card">
        <h3>Matching units</h3>
        <p className="value">{formatCount(summary.unitCount)}</p>
      </div>
      <div className="card card-mw">
        <h3>Matching registered MW</h3>
        <p className="value">{noMw ? "—" : formatMw(summary.totalMw)}</p>
        {summary.mwByStatus.length > 1 && (
          <p className="split">
            {summary.mwByStatus.map((s, i) => (
              <span key={s.status}>
                {i > 0 && " · "}
                {label("status", s.status)}{" "}
                {s.mw === 0 && s.unknownCapacityUnits > 0
                  ? "—"
                  : formatMw(s.mw)}
              </span>
            ))}
          </p>
        )}
        <details>
          <summary>How is this calculated?</summary>
          <p>
            Registered capacity of matching generator units:{" "}
            <strong>
              {formatCount(summary.mwUnitCount)} counted ·{" "}
              {formatCount(summary.excludedUnits)} excluded (loads, pumps) ·{" "}
              {formatCount(summary.unknownCapacityUnits)} with unknown capacity,
              not counted.
            </strong>{" "}
            Each battery is counted once, using its discharging unit. Retired MW
            is the sum of retired unit registrations and may include capacity
            re-registered under a newer unit.
          </p>
        </details>
      </div>
      {summary.batteryUnits > 0 && (
        <div className="card">
          <h3>Battery storage (MWh)</h3>
          <p className="value">{formatMwh(summary.batteryStorageMwh)}</p>
          <p className="muted">
            {formatCount(summary.batteryUnits)}{" "}
            {summary.batteryUnits === 1 ? "battery" : "batteries"}
            {summary.batteryStorageUnknownUnits > 0 &&
              `, ${formatCount(summary.batteryStorageUnknownUnits)} without a published MWh`}
            ; hydro storage not included
          </p>
        </div>
      )}
    </section>
  );
}
