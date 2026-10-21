import { describe, expect, it } from "vitest";
import {
  dateSortKey,
  formatCount,
  formatMw,
  formatMwh,
  formatSourceDate,
  isApproximate,
} from "./format";

describe("formatSourceDate", () => {
  it("formats by slicing the ISO prefix, per precision", () => {
    expect(
      formatSourceDate({ iso: "2021-05-18T00:00:00+10:00", precision: "day" }),
    ).toBe("18 May 2021");
    expect(
      formatSourceDate({
        iso: "2026-06-01T00:00:00+10:00",
        precision: "month",
      }),
    ).toBe("Jun 2026");
    expect(
      formatSourceDate({ iso: "2022-01-01T00:00:00+10:00", precision: "year" }),
    ).toBe("2022");
    expect(formatSourceDate(null)).toBeNull();
  });

  it("keeps a WEM +08:00 day-precision date on its own calendar day in any timezone", () => {
    // new Date("2021-05-18T00:00:00+08:00") is 17 May in the Americas.
    expect(
      formatSourceDate({ iso: "2021-05-18T00:00:00+08:00", precision: "day" }),
    ).toBe("18 May 2021");
  });

  it("keeps a year-precision 1 January date in its own year", () => {
    // Parsed, this would be 31 Dec 2021 anywhere west of +10:00.
    expect(
      formatSourceDate({ iso: "2022-01-01T00:00:00+10:00", precision: "year" }),
    ).toBe("2022");
  });
});

describe("dateSortKey", () => {
  it("is the calendar prefix, or null", () => {
    expect(
      dateSortKey({ iso: "2021-05-18T00:00:00+10:00", precision: "day" }),
    ).toBe("2021-05-18");
    expect(dateSortKey(null)).toBeNull();
  });
});

describe("isApproximate", () => {
  it("is true for month and year precision only", () => {
    expect(isApproximate({ iso: "2021-05-18T", precision: "day" })).toBe(false);
    expect(isApproximate({ iso: "2021-05-01T", precision: "month" })).toBe(
      true,
    );
    expect(isApproximate({ iso: "2021-01-01T", precision: "year" })).toBe(true);
    expect(isApproximate(null)).toBe(false);
  });
});

describe("formatMw", () => {
  it("switches to GW at 10 GW and keeps small values readable", () => {
    expect(formatMw(12_345)).toBe("12.3 GW");
    expect(formatMw(10_000)).toBe("10.0 GW");
    expect(formatMw(1_234.56)).toBe("1,235 MW");
    expect(formatMw(150)).toBe("150 MW");
    expect(formatMw(7.76)).toBe("7.8 MW");
    expect(formatMw(5)).toBe("5 MW");
    expect(formatMw(0)).toBe("0 MW");
  });
});

describe("formatMwh and formatCount", () => {
  it("format storage and counts with en-AU grouping", () => {
    expect(formatMwh(194)).toBe("194 MWh");
    expect(formatMwh(12_000)).toBe("12.0 GWh");
    expect(formatCount(1146)).toBe("1,146");
  });
});
