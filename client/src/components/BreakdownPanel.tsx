import { useId } from "react";
import { DIM_ORDER } from "../domain/aggregate";
import { formatCount, formatMw } from "../domain/format";
import {
  DIMENSIONS,
  label,
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
  splitBy: Dimension | null;
  measure: Measure;
  selectedKey: string | null;
  onGroupBy: (dim: Dimension) => void;
  onSplitBy: (dim: Dimension | null) => void;
  onMeasure: (measure: Measure) => void;
  onSelect: (key: string) => void;
};

type SplitOption = Dimension | "none";

const SPLIT_LABELS: Record<SplitOption, string> = {
  none: "None",
  state: "State / region",
  techGroup: "Technology",
  status: "Status",
};

// Segment shade: a lightness ramp over the accent so it reads in every
// palette including greyscale. The ramp spans the segments present in the
// current breakdown (canonical order, same set as the legend), so colours
// spread out instead of all landing near 100%
const segmentShades = (
  splitBy: Dimension,
  groups: BreakdownGroup[],
): Map<string, string> => {
  const present = DIM_ORDER[splitBy].filter((key) =>
    groups.some((g) => g.segments.some((s) => s.key === key)),
  );
  const step = 65 / Math.max(1, present.length - 1);
  return new Map(
    present.map((key, i) => [
      key,
      `color-mix(in srgb, var(--accent) ${Math.round(100 - i * step)}%, var(--paper))`,
    ]),
  );
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
  const id = useId();
  return (
    <div className="toggle-field">
      <span id={id} className="toggle-label">
        {name}
      </span>
      <div className="toggle" role="group" aria-labelledby={id}>
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
    </div>
  );
}

// Bars are computed from the filtered rows only. Clicking one narrows what is
// shown below it without removing the other bars
export function BreakdownPanel({
  groups,
  groupBy,
  splitBy,
  measure,
  selectedKey,
  onGroupBy,
  onSplitBy,
  onMeasure,
  onSelect,
}: Props) {
  const value = (g: BreakdownGroup) => (measure === "mw" ? g.mw : g.facilities);
  const max = Math.max(1, ...groups.map(value));
  const shades =
    splitBy === null
      ? new Map<string, string>()
      : segmentShades(splitBy, groups);
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
        <Toggle<SplitOption>
          name="Split by"
          options={["none", ...DIMENSIONS.filter((d) => d !== groupBy)]}
          labels={SPLIT_LABELS}
          value={splitBy ?? "none"}
          onChange={(next) => onSplitBy(next === "none" ? null : next)}
        />
      </div>
      {groups.length === 0 ? (
        <p className="muted">Nothing to break down.</p>
      ) : (
        <ol className="bars">
          {groups.map((g) => {
            const selected = g.key === selectedKey;
            const unknownNote =
              g.unknownMwUnits > 0
                ? `, ${formatCount(g.unknownMwUnits)} units without published MW`
                : "";
            return (
              <li key={g.key}>
                <button
                  type="button"
                  className={selected ? "bar selected" : "bar"}
                  aria-pressed={selected}
                  onClick={() => onSelect(g.key)}
                  title={`${g.label}: ${formatMw(g.mw)}, ${formatCount(g.facilities)} facilities, ${formatCount(g.units)} units${unknownNote}`}
                >
                  <span className="bar-label">{g.label}</span>
                  <span className="bar-track">
                    {g.segments.length > 0 && splitBy !== null ? (
                      g.segments.map((s) => (
                        <span
                          key={s.key}
                          className="bar-segment"
                          title={`${g.label} · ${s.label}: ${formatMw(s.mw)}, ${formatCount(s.facilities)} facilities`}
                          style={{
                            width: `${(100 * (measure === "mw" ? s.mw : s.facilities)) / max}%`,
                            background: shades.get(s.key),
                          }}
                        />
                      ))
                    ) : (
                      <span
                        className="bar-fill"
                        style={{ width: `${(100 * value(g)) / max}%` }}
                      />
                    )}
                  </span>
                  <span className="bar-value">
                    {text(g)}
                    {measure === "mw" && g.unknownMwUnits > 0 && (
                      <span className="bar-note">
                        {" "}
                        +{g.unknownMwUnits} unknown
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {splitBy !== null && groups.some((g) => g.segments.length > 0) && (
        <ul className="split-legend" aria-label="Segments">
          {DIM_ORDER[splitBy]
            .filter((key) =>
              groups.some((g) => g.segments.some((s) => s.key === key)),
            )
            .map((key) => (
              <li key={key}>
                <span
                  className="split-swatch"
                  style={{ background: shades.get(key) }}
                />
                {label(splitBy, key)}
              </li>
            ))}
        </ul>
      )}
      <p className="muted">
        {measure === "facilities"
          ? "A facility with mixed technologies or statuses is counted in each group it matches, so groups can add up to more than the distinct total."
          : "Registered MW of matching generator units; see “How is this calculated?” above."}
      </p>
    </section>
  );
}
