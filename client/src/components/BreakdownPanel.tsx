import { formatCount, formatMw } from "../domain/format";
import {
  DIMENSIONS,
  MEASURES,
  type BreakdownGroup,
  type Dimension,
  type Measure,
} from "../domain/types";

const DIMENSION_LABELS: Record<Dimension, string> = {
  state: "State / region",
  techGroup: "Technology",
  status: "Status",
};
const MEASURE_LABELS: Record<Measure, string> = {
  mw: "MW",
  facilities: "Facilities",
};

type Props = {
  groups: BreakdownGroup[];
  groupBy: Dimension;
  measure: Measure;
  selectedKey: string | null;
  onGroupBy: (dim: Dimension) => void;
  onMeasure: (measure: Measure) => void;
  onSelect: (key: string) => void;
};

// A row of buttons where exactly one is pressed
function Toggle<T extends string>({
  name,
  options,
  labels,
  value,
  onChange,
}: {
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="toggle" role="group" aria-label={name}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

// Bars are computed from the filtered rows only. Clicking one narrows what is
// shown below it without removing the other bars
export function BreakdownPanel({
  groups,
  groupBy,
  measure,
  selectedKey,
  onGroupBy,
  onMeasure,
  onSelect,
}: Props) {
  const value = (g: BreakdownGroup) => (measure === "mw" ? g.mw : g.facilities);
  const max = Math.max(1, ...groups.map(value));
  const text = (g: BreakdownGroup) =>
    measure === "mw"
      ? g.mw === 0
        ? "—"
        : formatMw(g.mw)
      : formatCount(g.facilities);

  return (
    <section className="breakdown" aria-labelledby="breakdown-heading">
      <div className="breakdown-header">
        <h2 id="breakdown-heading">
          Breakdown by {DIMENSION_LABELS[groupBy].toLowerCase()}
        </h2>
        <Toggle
          name="Group by"
          options={DIMENSIONS}
          labels={DIMENSION_LABELS}
          value={groupBy}
          onChange={onGroupBy}
        />
        <Toggle
          name="Measure"
          options={MEASURES}
          labels={MEASURE_LABELS}
          value={measure}
          onChange={onMeasure}
        />
      </div>
      {groups.length === 0 ? (
        <p className="muted">Nothing to break down.</p>
      ) : (
        <ol className="bars">
          {groups.map((g) => {
            const selected = g.key === selectedKey;
            return (
              <li key={g.key}>
                <button
                  type="button"
                  className={selected ? "bar selected" : "bar"}
                  aria-pressed={selected}
                  onClick={() => onSelect(g.key)}
                  title={`${g.label}: ${formatMw(g.mw)}, ${formatCount(g.facilities)} facilities, ${formatCount(g.units)} units`}
                >
                  <span className="bar-label">{g.label}</span>
                  <span className="bar-track">
                    <span
                      className="bar-fill"
                      style={{ width: `${(100 * value(g)) / max}%` }}
                    />
                  </span>
                  <span className="bar-value">{text(g)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="muted">
        {measure === "facilities"
          ? "A facility with mixed technologies or statuses is counted in each group it matches, so groups can add up to more than the distinct total."
          : "Registered MW of matching generator units; see “How is this calculated?” above."}
      </p>
    </section>
  );
}
