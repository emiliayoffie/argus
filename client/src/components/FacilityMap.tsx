import {
  latLngBounds,
  type CircleMarker as LeafletCircleMarker,
  type LatLngTuple,
  type Map as LeafletMap,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { formatCount, formatMw, formatSourceDate } from "../domain/format";
import { label, type FacilityRow, type MapView } from "../domain/types";
import { usePaletteColors, type PaletteColors } from "../theme";

type Located = FacilityRow & { lat: number; lng: number };

const hasCoordinates = (f: FacilityRow): f is Located =>
  f.lat !== null && f.lng !== null;

// Australia, for an empty selection
const DEFAULT_BOUNDS: LatLngTuple[] = [
  [-44, 112],
  [-10, 154],
];

// Marker colours come from CSS variables so theme and palette changes
// retint existing markers on the next render
const statusColor = (colors: PaletteColors, f: FacilityRow) =>
  f.statuses.length === 1 ? colors.status[f.statuses[0]] : colors.mixed;

const fitTo = (map: LeafletMap, located: Located[]) =>
  map.fitBounds(
    located.length
      ? latLngBounds(located.map((f) => [f.lat, f.lng]))
      : latLngBounds(DEFAULT_BOUNDS),
    { padding: [24, 24], maxZoom: 9 },
  );

// Marker area tracks matching MW; unknown MW gets the minimum size
const radius = (f: FacilityRow) =>
  f.matchingMw === null ? 4 : Math.min(18, 4 + Math.sqrt(f.matchingMw) / 3);

// Viewport rules: a saved view (from the URL) wins on mount; otherwise, and
// whenever the selection or resetRequest changes, fit to the selection. The
// user's own pans and zooms are reported upward so they can go in the URL.
// While the map is collapsed (display: none) Leaflet has no size, so a fit
// is deferred until it is shown again; showing it also re-measures the
// container, and nothing else moves the view
function Viewport({
  facilities,
  initialView,
  resetRequest,
  visible,
  onViewChange,
  initialPopup,
  markers,
}: {
  facilities: Located[];
  initialView: MapView;
  resetRequest: number;
  visible: boolean;
  onViewChange: (view: NonNullable<MapView>) => void;
  initialPopup: string | null;
  markers: RefObject<Map<string, LeafletCircleMarker>>;
}) {
  const map = useMap();
  const restored = useRef(false);
  const shown = useRef(visible);
  const pendingFit = useRef(false);

  // Reopen the most recently selected facility's popup on mount (after a
  // reload). This component renders after the markers, so they exist by now
  useEffect(() => {
    if (initialPopup) markers.current.get(initialPopup)?.openPopup();
  }, [initialPopup, markers]);

  useEffect(() => {
    if (!restored.current && initialView) {
      restored.current = true;
      map.setView([initialView.lat, initialView.lng], initialView.zoom);
      return;
    }
    restored.current = true;
    if (!shown.current) {
      pendingFit.current = true;
      return;
    }
    fitTo(map, facilities);
  }, [map, facilities, initialView, resetRequest]);

  // Runs after the fit effect above in the same commit. Re-measures the
  // container whenever the map is visible, and performs any fit that was
  // deferred while it was hidden
  useEffect(() => {
    shown.current = visible;
    if (!visible) return;
    map.invalidateSize();
    if (pendingFit.current) {
      pendingFit.current = false;
      fitTo(map, facilities);
    }
  }, [map, visible, facilities]);

  // Trackpad pinch (and Cmd/Ctrl + scroll) zooms the map around the pointer
  // and never the page; a plain two-finger scroll still scrolls the page
  useEffect(() => {
    const container = map.getContainer();
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const step = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 0.8 : 0.1;
      map.setZoomAround(
        map.mouseEventToContainerPoint(event),
        map.getZoom() - event.deltaY * step,
      );
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [map]);

  useMapEvents({
    moveend: () => {
      const { lat, lng } = map.getCenter();
      onViewChange({ lat, lng, zoom: map.getZoom() });
    },
  });
  return null;
}

type Props = {
  facilities: FacilityRow[];
  // Viewport to restore on mount; null fits the selection
  view: MapView;
  // Bumped by Reset: refit even though the selection may be unchanged
  resetRequest: number;
  // False while the section is collapsed; the map stays mounted but hidden
  visible: boolean;
  onViewChange: (view: NonNullable<MapView>) => void;
  selected: string[];
  // Marker clicked: toggle the facility in the highlight set
  onToggle: (code: string) => void;
  // "More info" in the popup clicked: take the user to the row
  onLocate: (code: string) => void;
};

// One marker per facility in the current selection: the same rows as the
// table, so totals never depend on the map. Facilities without coordinates
// are counted in the caption rather than silently dropped
export default function FacilityMap({
  facilities,
  view,
  resetRequest,
  visible,
  onViewChange,
  selected,
  onToggle,
  onLocate,
}: Props) {
  // Only the view and selection present at mount matter for restoring; later
  // changes come from this map itself
  const [initialView] = useState(view);
  const [initialPopup] = useState(selected.at(-1) ?? null);
  const markers = useRef(new Map<string, LeafletCircleMarker>());
  // Stable identity matters: the fit-to-bounds effect runs when this changes
  const located = useMemo(
    () => facilities.filter(hasCoordinates),
    [facilities],
  );
  const missing = facilities.length - located.length;
  const colors = usePaletteColors();

  return (
    <figure
      className="map"
      aria-label="Map of the facilities in the current selection"
    >
      <MapContainer
        bounds={DEFAULT_BOUNDS}
        scrollWheelZoom={false}
        zoomSnap={0}
        zoomDelta={0.5}
        // One canvas instead of one SVG element per marker; much lighter with hundreds of facilities
        preferCanvas
        className="map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((f) => {
          const isSelected = selected.includes(f.code);
          const halo = isSelected ? (
            <CircleMarker
              key={`${f.code}-halo`}
              center={[f.lat, f.lng]}
              radius={radius(f) + 4}
              interactive={false}
              pathOptions={{
                color: colors.selected,
                weight: 2,
                fill: false,
                dashArray: "3 3",
              }}
            />
          ) : null;
          const fill = isSelected ? colors.selected : statusColor(colors, f);
          return (
            <Fragment key={f.code}>
              {halo}
              <CircleMarker
                ref={(marker) => {
                  if (marker) markers.current.set(f.code, marker);
                  else markers.current.delete(f.code);
                }}
                center={[f.lat, f.lng]}
                radius={radius(f)}
                eventHandlers={{ click: () => onToggle(f.code) }}
                pathOptions={{
                  color: colors.stroke,
                  fillColor: fill,
                  fillOpacity: isSelected ? 0.85 : 0.55,
                  weight: isSelected ? 3 : 1.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  {f.name} ·{" "}
                  {f.matchingMw === null ? "—" : formatMw(f.matchingMw)}
                </Tooltip>
                <Popup>
                  <strong>{f.name}</strong>{" "}
                  <span className="muted">{f.code}</span>
                  <br />
                  <button
                    type="button"
                    className="popup-locate"
                    onClick={() => onLocate(f.code)}
                  >
                    More info <span aria-hidden="true">→</span>
                  </button>
                  <br />
                  {label("state", f.state)} ·{" "}
                  {f.techGroups.map((t) => label("techGroup", t)).join(", ")}
                  <br />
                  {f.statuses.map((s) => label("status", s)).join(", ")}
                  {f.retiredUnits > 0 && f.retiredUnits < f.allUnits && (
                    <>
                      {" "}
                      · some units retired ({f.retiredUnits} of {f.allUnits})
                    </>
                  )}
                  <br />
                  Matching MW:{" "}
                  {f.matchingMw === null ? "—" : formatMw(f.matchingMw)} ·{" "}
                  {f.matchingUnits === f.allUnits
                    ? `${formatCount(f.allUnits)} units`
                    : `${formatCount(f.matchingUnits)} of ${formatCount(f.allUnits)} units match`}
                  {f.keyDate && (
                    <>
                      <br />
                      {f.keyDate.label}:{" "}
                      {formatSourceDate(f.keyDate.date) ?? "—"}
                    </>
                  )}
                </Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
        <Viewport
          facilities={located}
          initialView={initialView}
          resetRequest={resetRequest}
          visible={visible}
          onViewChange={onViewChange}
          initialPopup={initialPopup}
          markers={markers}
        />
      </MapContainer>
      <figcaption className="muted">
        {formatCount(located.length)} of {formatCount(facilities.length)}{" "}
        facilities mapped
        {missing > 0 && (
          <>
            ; {formatCount(missing)} without coordinates are listed in the table
            only
          </>
        )}
        .{" "}
        <ul className="map-legend" aria-label="Marker colours">
          <li>
            <span
              className="legend-dot"
              style={{ background: "var(--status-operating)" }}
            />
            Operating
          </li>
          <li>
            <span
              className="legend-dot"
              style={{ background: "var(--status-commissioning)" }}
            />
            Commissioning
          </li>
          <li>
            <span
              className="legend-dot"
              style={{ background: "var(--status-committed)" }}
            />
            Committed
          </li>
          <li>
            <span
              className="legend-dot"
              style={{ background: "var(--status-retired)" }}
            />
            Retired
          </li>
          <li>
            <span
              className="legend-dot"
              style={{ background: "var(--status-mixed)" }}
            />
            Mixed
          </li>
          <li>
            <span className="legend-dot legend-halo" />
            Highlighted
          </li>
        </ul>
        Marker size follows matching MW; colour follows status (legend above).
        Drag to pan; pinch or ⌘/Ctrl + scroll to zoom.
      </figcaption>
    </figure>
  );
}
