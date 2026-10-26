import {
  label,
  type BreakdownGroup,
  type Dimension,
  type Measure,
  type Status,
  type StatusMw,
  type Summary,
  type UnitRow,
} from "./types";

// Totals for the current selection. MW sums only eligible units with a known
// capacity; every other unit is *counted* as excluded or unknown rather than
// silently treated as 0. Facility count is distinct facility codes.
export function summarize(rows: UnitRow[]): Summary {
  const facilities = new Set<string>();
  const byStatus = new Map<Status, StatusMw>();
  const summary: Summary = {
    facilityCount: 0,
    unitCount: rows.length,
    totalMw: 0,
    mwByStatus: [],
    batteryStorageMwh: 0,
    batteryUnits: 0,
    batteryStorageUnknownUnits: 0,
    mwUnitCount: 0,
    excludedUnits: 0,
    unknownCapacityUnits: 0,
  };

  for (const row of rows) {
    facilities.add(row.facilityCode);

    let status = byStatus.get(row.status);
    if (!status) {
      status = { status: row.status, mw: 0, unknownCapacityUnits: 0 };
      byStatus.set(row.status, status);
    }

    if (!row.mwEligible) {
      summary.excludedUnits++;
    } else if (row.capacityMw == null) {
      summary.unknownCapacityUnits++;
      status.unknownCapacityUnits++;
    } else {
      summary.totalMw += row.capacityMw;
      summary.mwUnitCount++;
      status.mw += row.capacityMw;
    }

    if (row.techGroup === "battery") {
      summary.batteryUnits++;
      if (row.storageMwh == null) summary.batteryStorageUnknownUnits++;
      else summary.batteryStorageMwh += row.storageMwh;
    }
  }

  summary.facilityCount = facilities.size;
  summary.mwByStatus = [...byStatus.values()].sort((a, b) => b.mw - a.mw);
  return summary;
}

// One group per distinct value of `dim`, sorted by `measure` descending.
// A facility with units in two groups is counted in both, so adding up the
// groups can give more than the real number of facilities.
export function groupBy(
  rows: UnitRow[],
  dim: Dimension,
  measure: Measure,
): BreakdownGroup[] {
  const groups = new Map<
    string,
    { mw: number; facilities: Set<string>; units: number }
  >();
  for (const row of rows) {
    const key = row[dim];
    let group = groups.get(key);
    if (!group) {
      group = { mw: 0, facilities: new Set(), units: 0 };
      groups.set(key, group);
    }
    group.units++;
    group.facilities.add(row.facilityCode);
    if (row.mwEligible && row.capacityMw != null) group.mw += row.capacityMw;
  }
  return [...groups]
    .map(([key, g]) => ({
      key,
      label: label(dim, key),
      mw: g.mw,
      facilities: g.facilities.size,
      units: g.units,
    }))
    .sort((a, b) =>
      measure === "mw" ? b.mw - a.mw : b.facilities - a.facilities,
    );
}
