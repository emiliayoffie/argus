import { dateSortKey } from "./format";
import { label, type FacilityRow } from "./types";

// RFC-4180 quoting: a field is wrapped only when it would break parsing
const cell = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (/[,"\n\r]|^\s|\s$/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

const HEADER =
  "code,name,state,region,technologies,statuses,matching_mw,matching_units,all_units,retired_units,key_date_label,key_date,key_date_precision,closing_date,closing_date_precision,lat,lng";

// The filtered facility list as CSV: one row per facility, matching the
// columns the table shows plus codes and coordinates for reuse elsewhere
export function facilitiesToCsv(rows: FacilityRow[]): string {
  const lines = rows.map((f) =>
    [
      f.code,
      f.name,
      label("state", f.state),
      f.region,
      f.techGroups.map((t) => label("techGroup", t)).join("; "),
      f.statuses.map((s) => label("status", s)).join("; "),
      f.matchingMw === null ? "" : String(f.matchingMw),
      String(f.matchingUnits),
      String(f.allUnits),
      String(f.retiredUnits),
      f.keyDate?.label ?? "",
      f.keyDate?.date ? (dateSortKey(f.keyDate.date) ?? "") : "",
      f.keyDate?.date?.precision ?? "",
      f.closing ? (dateSortKey(f.closing) ?? "") : "",
      f.closing?.precision ?? "",
      f.lat === null ? "" : String(f.lat),
      f.lng === null ? "" : String(f.lng),
    ]
      .map(cell)
      .join(","),
  );
  return [HEADER, ...lines].join("\r\n") + "\r\n";
}

// The anchor must be in the document for Firefox and Safari to honour the
// click, and the object URL must outlive the click for the download to start
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
