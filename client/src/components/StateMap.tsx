import { useMemo, type KeyboardEvent } from "react";
import { formatCount, formatMw } from "../domain/format";
import { AU_VIEWBOX, stateShapes } from "../domain/geo";
import { type BreakdownGroup, type Measure } from "../domain/types";

type Props = {
  groups: BreakdownGroup[];
  measure: Measure;
  selectedKey: string | null;
  // Shared with the bars so hovering either side lights up the other
  hoverKey: string | null;
  onHover: (key: string | null) => void;
  onSelect: (key: string) => void;
};

// Shading runs from a light tint to the full bar colour; zero stays neutral
// so "a little" and "none" never look alike
const SHADE_FLOOR = 18;

// Choropleth of the state breakdown: the same groups as the bars, shaded by
// the current measure. States with no matching units are drawn in a neutral
// fill. Each state is a focusable button so keyboard users can read its
// value and drill into it like a bar
export function StateMap({
  groups,
  measure,
  selectedKey,
  hoverKey,
  onHover,
  onSelect,
}: Props) {
  const shapes = useMemo(() => stateShapes(), []);
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const value = (g: BreakdownGroup) => (measure === "mw" ? g.mw : g.facilities);
  const max = Math.max(1, ...groups.map(value));
  const text = (g: BreakdownGroup) =>
    measure === "mw"
      ? formatMw(g.mw)
      : `${formatCount(g.facilities)} facilities`;
  const unmapped = groups.filter((g) => !shapes.some((s) => s.state === g.key));

  const describe = (name: string, g: BreakdownGroup | undefined) => {
    if (!g || value(g) === 0) return `${name}: no matching units`;
    const parts = [
      measure === "mw"
        ? `${formatMw(g.mw)}, ${formatCount(g.facilities)} facilities`
        : `${formatCount(g.facilities)} facilities, ${formatCount(g.units)} units`,
    ];
    if (g.segments.length > 0)
      parts.push(
        g.segments
          .map(
            (s) =>
              `${s.label} ${measure === "mw" ? formatMw(s.mw) : formatCount(s.facilities)}`,
          )
          .join(", "),
      );
    if (measure === "mw" && g.unknownMwUnits > 0)
      parts.push(`${formatCount(g.unknownMwUnits)} units without published MW`);
    return `${name}: ${parts.join("; ")}`;
  };

  const pick = (event: KeyboardEvent<SVGPathElement>, key: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(key);
    }
  };

  return (
    <figure className="state-map">
      <svg
        viewBox={`0 0 ${AU_VIEWBOX.width} ${AU_VIEWBOX.height}`}
        role="group"
        aria-label={`${measure === "mw" ? "Registered MW" : "Facilities"} by state`}
      >
        {shapes.map((s) => {
          const g = byKey.get(s.state);
          const v = g ? value(g) : 0;
          const tint =
            v > 0
              ? Math.round(SHADE_FLOOR + (100 - SHADE_FLOOR) * (v / max))
              : 0;
          const classes = [
            s.state === selectedKey && "selected",
            s.state === hoverKey && "hover",
            v === 0 && "empty",
          ]
            .filter(Boolean)
            .join(" ");
          const tip = describe(s.name, g);
          return (
            <path
              key={s.state}
              d={s.d}
              fillRule="evenodd"
              className={classes || undefined}
              style={
                tint > 0
                  ? {
                      fill: `color-mix(in srgb, var(--viz) ${tint}%, var(--paper))`,
                    }
                  : undefined
              }
              role="button"
              tabIndex={0}
              aria-pressed={s.state === selectedKey}
              aria-label={tip}
              onMouseEnter={() => onHover(s.state)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(s.state)}
              onBlur={() => onHover(null)}
              onClick={() => onSelect(s.state)}
              onKeyDown={(e) => pick(e, s.state)}
            >
              <title>{tip}</title>
            </path>
          );
        })}
      </svg>
      <figcaption className="state-map-legend">
        <span className="state-map-scale" aria-hidden="true" />
        <span className="state-map-scale-labels" aria-hidden="true">
          <span>Less</span>
          <span>
            {measure === "mw"
              ? formatMw(max)
              : `${formatCount(max)} ${max === 1 ? "facility" : "facilities"}`}
          </span>
        </span>
        <span className="visually-hidden">
          Darker shading means more{" "}
          {measure === "mw" ? "registered MW" : "facilities"}; the darkest state
          has{" "}
          {measure === "mw" ? formatMw(max) : formatCount(max) + " facilities"}.
        </span>
        <span className="state-map-key">
          <span className="state-map-none" aria-hidden="true" /> No matching
          units
        </span>
        {unmapped.length > 0 && (
          <span className="state-map-key">
            {unmapped.map((g) => `${g.label}: ${text(g)}`).join(" · ")} (not on
            the map)
          </span>
        )}
      </figcaption>
    </figure>
  );
}
