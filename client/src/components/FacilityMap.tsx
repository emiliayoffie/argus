import {
  latLngBounds,
  type CircleMarker as LeafletCircleMarker,
  type LatLngTuple,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import {
  label,
  type FacilityRow,
  type MapView,
  type Status,
} from "../domain/types";

type Located = FacilityRow & { lat: number; lng: number };

const hasCoordinates = (f: FacilityRow): f is Located =>
  f.lat !== null && f.lng !== null;

// Australia, for an empty selection
const DEFAULT_BOUNDS: LatLngTuple[] = [
  [-44, 112],
  [-10, 154],
];

// Matches the status badge palette; mixed matching statuses are lavender
const STATUS_COLOR: Record<Status, string> = {
  operating: "#3f9d8a",
  commissioning: "#d99a2b",
  committed: "#5b86c4",
  retired: "#8d8079",
  other: "#8d8079",
};
const MIXED_COLOR = "#7f6bb0";
const SELECTED_COLOR = "#d8432b";

const color = (f: FacilityRow) =>
  f.statuses.length === 1 ? STATUS_COLOR[f.statuses[0]] : MIXED_COLOR;

// Marker area tracks matching MW; unknown MW gets the minimum size
const radius = (f: FacilityRow) =>
  f.matchingMw === null ? 4 : Math.min(18, 4 + Math.sqrt(f.matchingMw) / 3);

// Viewport rules: a saved view (from the URL) wins on mount; otherwise, and
// whenever the selection or resetRequest changes, fit to the selection. The
// user's own pans and zooms are reported upward so they can go in the URL
function Viewport({
  facilities,
  initialView,
  resetRequest,
  onViewChange,
  initialPopup,
  markers,
}: {
  facilities: Located[];
  initialView: MapView;
  resetRequest: number;
  onViewChange: (view: NonNullable<MapView>) => void;
  initialPopup: string | null;
  markers: RefObject<Map<string, LeafletCircleMarker>>;
}) {
  const map = useMap();
  const restored = useRef(false);

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
    const bounds = facilities.length
      ? latLngBounds(facilities.map((f) => [f.lat, f.lng]))
      : latLngBounds(DEFAULT_BOUNDS);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 9 });
  }, [map, facilities, initialView, resetRequest]);

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
        className="map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((f) => {
          const isSelected = selected.includes(f.code);
          const fill = isSelected ? SELECTED_COLOR : color(f);
          return (
            <CircleMarker
              key={f.code}
              ref={(marker) => {
                if (marker) markers.current.set(f.code, marker);
                else markers.current.delete(f.code);
              }}
              center={[f.lat, f.lng]}
              radius={radius(f)}
              eventHandlers={{ click: () => onToggle(f.code) }}
              pathOptions={{
                color: fill,
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
                    {f.keyDate.label}: {formatSourceDate(f.keyDate.date) ?? "—"}
                  </>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
        <Viewport
          facilities={located}
          initialView={initialView}
          resetRequest={resetRequest}
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
        . Marker size follows matching MW; color follows status (teal operating,
        amber commissioning, blue committed, grey retired, lavender mixed);
        highlighted facilities are red. Drag to pan; pinch or ⌘/Ctrl + scroll to
        zoom.
      </figcaption>
    </figure>
  );
}
