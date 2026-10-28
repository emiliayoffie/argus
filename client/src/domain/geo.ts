import outlines from "../data/australia-states.json";
import { STATES, type State } from "./types";

// Australian state outlines as SVG paths, for the choropleth in the
// breakdown. The source is Natural Earth (public domain), simplified to a
// few hundred points and stored as [lon, lat] rings; the ACT is folded into
// NSW because the NSW1 market region includes it, so the map matches the
// data's own notion of a state. Everything here is derived from the file:
// no coordinates, bounds or scales are hardcoded

export type StateShape = {
  state: State;
  name: string;
  // SVG path data in the AU_VIEWBOX coordinate space
  d: string;
};

type Ring = [number, number][];

export const AU_VIEWBOX = { width: 320, height: 280 } as const;

const isState = (value: string): value is State =>
  (STATES as readonly string[]).includes(value);

// Equirectangular projection scaled by the cosine of the middle latitude, so
// the continent isn't stretched east–west, then fitted into the viewBox
function projector(rings: Ring[]) {
  const lons = rings.flatMap((r) => r.map((p) => p[0]));
  const lats = rings.flatMap((r) => r.map((p) => p[1]));
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const squeeze = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const pad = 6;
  const scale = Math.min(
    (AU_VIEWBOX.width - 2 * pad) / ((maxLon - minLon) * squeeze),
    (AU_VIEWBOX.height - 2 * pad) / (maxLat - minLat),
  );
  const offsetX = (AU_VIEWBOX.width - (maxLon - minLon) * squeeze * scale) / 2;
  const offsetY = (AU_VIEWBOX.height - (maxLat - minLat) * scale) / 2;
  return ([lon, lat]: [number, number]): [number, number] => [
    offsetX + (lon - minLon) * squeeze * scale,
    offsetY + (maxLat - lat) * scale,
  ];
}

const pathData = (
  rings: Ring[],
  project: (p: [number, number]) => [number, number],
): string =>
  rings
    .map(
      (ring) =>
        ring
          .map((p, i) => {
            const [x, y] = project(p);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join("") + "Z",
    )
    .join("");

// The JSON is typed as number[][][]; keep only well-formed [lon, lat] pairs
const toRing = (raw: number[][]): Ring =>
  raw.flatMap((p): Ring => {
    const [lon, lat] = p;
    return lon !== undefined && lat !== undefined ? [[lon, lat]] : [];
  });

// All rings of all states share one projection so the pieces line up
export function stateShapes(): StateShape[] {
  const features = outlines.features.flatMap((f) =>
    isState(f.state)
      ? [{ state: f.state, name: f.name, rings: f.rings.map(toRing) }]
      : [],
  );
  const project = projector(features.flatMap((f) => f.rings));
  return features.map((f) => ({
    state: f.state,
    name: f.name,
    d: pathData(f.rings, project),
  }));
}
