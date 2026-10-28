import { useId } from "react";

// Ishihara-plate style disc: a mottled field of small dots in four shades of
// a palette's hue (the shades come from CSS variables set per palette). The
// layout is a jittered grid from a fixed-seed generator, so every plate has
// the same pattern and renders identically on every visit
type Dot = { cx: number; cy: number; r: number; shade: number };

const DOTS: Dot[] = (() => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const cells = 7;
  const cell = 32 / cells;
  const dots: Dot[] = [];
  for (let row = 0; row < cells; row++)
    for (let col = 0; col < cells; col++)
      dots.push({
        cx: (col + 0.5) * cell + (rand() - 0.5) * cell * 0.7,
        cy: (row + 0.5) * cell + (rand() - 0.5) * cell * 0.7,
        r: 1.2 + rand() * 1.5,
        shade: Math.floor(rand() * 4),
      });
  return dots;
})();

export function PaletteDot() {
  const clipId = useId();
  return (
    <svg
      className="plate"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="16" cy="16" r="16" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="16" className="plate-base" />
      <g clipPath={`url(#${clipId})`}>
        {/* Static art: the dots never reorder, so index keys are safe */}
        {DOTS.map((d, i) => (
          <circle
            key={i}
            cx={d.cx.toFixed(2)}
            cy={d.cy.toFixed(2)}
            r={d.r.toFixed(2)}
            className={`plate-dot-${d.shade}`}
          />
        ))}
      </g>
    </svg>
  );
}
