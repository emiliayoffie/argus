import type { ReactNode } from "react";
import { formatCount, formatMw, formatMwh } from "../domain/format";
import { label, type Summary } from "../domain/types";
import { useDropdown } from "../useDropdown";

// The (i) in a card's corner: opens a floating explanation anchored to the
// card, so it never stretches the row or runs off the viewport
function CardInfo({ name, children }: { name: string; children: ReactNode }) {
  const { open, detailsProps } = useDropdown();
  return (
    <details className="info" {...detailsProps}>
      <summary
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={name}
        data-tip="How is this calculated?"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 7.5h.01" />
        </svg>
      </summary>
      <div className="info-panel">{children}</div>
    </details>
  );
}

// Totals for the current selection. Always four cards so the layout doesn't
// jump when a selection has no batteries or no published MW
export function SummaryStrip({
  summary,
  hasDateFilter,
}: {
  summary: Summary;
  hasDateFilter: boolean;
}) {
  const noMw = summary.mwUnitCount === 0;
  const noStorage =
    summary.batteryUnits === 0 ||
    (summary.batteryStorageMwh === 0 && summary.batteryStorageUnknownUnits > 0);
  const unknownStorage = summary.batteryStorageUnknownUnits;
  return (
    <section className="summary" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="visually-hidden">
        Summary of the current selection
      </h2>

      <div className="card">
        <div className="card-head">
          <h3>Facilities</h3>
          <CardInfo name="About the facilities count">
            <p>
              Distinct sites with at least one unit matching every active
              filter. A site is counted once here even if it spans several
              technologies or statuses, so the breakdown&rsquo;s per-group
              facility counts can add up to more than this.
            </p>
          </CardInfo>
        </div>
        <p className="value">{formatCount(summary.facilityCount)}</p>
        <p className="card-detail">Distinct matching facilities</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Units</h3>
          <CardInfo name="About the units count">
            <p>
              Registered units matching every active filter &mdash; the same
              unit must match the technology, status and date filters together.
              Each battery counts once: its charging, discharging and combined
              registrations are merged. Loads and pumps are included in this
              count but never in MW.
            </p>
          </CardInfo>
        </div>
        <p className="value">{formatCount(summary.unitCount)}</p>
        <p className="card-detail">Matching registered units</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Registered capacity</h3>
          <CardInfo name="How registered capacity is calculated">
            <p>
              Registered capacity of matching generator units:{" "}
              <strong>
                {formatCount(summary.mwUnitCount)} counted ·{" "}
                {formatCount(summary.excludedUnits)} excluded (loads, pumps) ·{" "}
                {formatCount(summary.unknownCapacityUnits)} with unknown
                capacity, not counted.
              </strong>{" "}
              Each battery is counted once, using its discharging unit.
            </p>
            <p>
              Statuses are registry classifications, not live availability.
              Retired MW is the sum of retired unit registrations and may
              include capacity re-registered under a newer unit, so the segments
              can overstate unique physical capacity; it says nothing about
              mothballing.
            </p>
            {hasDateFilter && (
              <p className="muted">
                Date filters: month- and year-only dates count from the start of
                their period.
              </p>
            )}
          </CardInfo>
        </div>
        <p className="value accent">{noMw ? "—" : formatMw(summary.totalMw)}</p>
        {summary.mwByStatus.length > 0 && summary.totalMw > 0 && (
          <>
            <div className="status-bar" aria-hidden="true">
              {summary.mwByStatus.map((s) => (
                <span
                  key={s.status}
                  className={`status-${s.status}`}
                  style={{ flexGrow: s.mw }}
                />
              ))}
            </div>
            <ul className="status-legend" aria-label="Registered MW by status">
              {summary.mwByStatus.map((s) => (
                <li key={s.status}>
                  <span
                    className={`legend-dot status-${s.status}`}
                    aria-hidden="true"
                  />
                  <span>{label("status", s.status)}</span>{" "}
                  <span className="num">
                    {s.mw === 0 && s.unknownCapacityUnits > 0
                      ? "—"
                      : formatMw(s.mw)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {noMw && (
          <p className="card-detail">No published MW in this selection</p>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Battery storage</h3>
          <CardInfo name="How battery storage is calculated">
            <p>
              Published energy capacity (MWh) of matching batteries, each
              counted once.{" "}
              {unknownStorage > 0 &&
                `${formatCount(unknownStorage)} without a published figure ${unknownStorage === 1 ? "is" : "are"} left out, not counted as zero. `}
              Pumped hydro stores energy too, but only batteries are included
              here. MWh is stored energy; the capacity card&rsquo;s MW is power.
            </p>
          </CardInfo>
        </div>
        <p className="value accent">
          {noStorage ? "—" : formatMwh(summary.batteryStorageMwh)}
        </p>
        <p className="card-detail">
          {summary.batteryUnits === 0
            ? "No batteries in this selection"
            : `${formatCount(summary.batteryUnits)} ${summary.batteryUnits === 1 ? "battery" : "batteries"}${
                unknownStorage > 0
                  ? ` · ${formatCount(unknownStorage)} without published MWh`
                  : ""
              }`}
        </p>
        <p className="card-note">Pumped-hydro storage not included</p>
      </div>
    </section>
  );
}
