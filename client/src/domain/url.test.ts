import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, type AppState } from "./types";
import {
  DEFAULT_STATE,
  MAX_SELECTED,
  parseSelected,
  parseState,
  parseView,
  SEARCH_MAX_LENGTH,
  serializeState,
  toggleSelected,
} from "./url";

const parse = (query: string) => parseState(new URLSearchParams(query));

describe("parseState / serializeState", () => {
  it("round-trips a full state and omits defaults", () => {
    const state: AppState = {
      filters: {
        states: ["NSW", "QLD"],
        techGroups: ["battery"],
        statuses: ["operating", "commissioning"],
        search: "bess",
        recentMonths: 12,
      },
      groupBy: "state",
      measure: "facilities",
      drilldown: { dim: "state", key: "NSW" },
      view: { lat: -33.0864, lng: 138.5187, zoom: 9 },
      selected: ["HORNSDPR", "NESBESS2"],
      sort: { key: "keyDate", direction: "desc" },
    };
    const query = serializeState(state);
    expect(query).toBe(
      "state=NSW%2CQLD&tech=battery&status=operating%2Ccommissioning&q=bess&recent=12&by=state&measure=facilities&drill=state%3ANSW&view=-33.0864%2C138.5187%2C9&sel=HORNSDPR%2CNESBESS2&sort=keyDate%3Adesc",
    );
    expect(parse(query)).toEqual(state);
  });

  it("the default view is an empty query, both ways", () => {
    expect(serializeState(DEFAULT_STATE)).toBe("");
    expect(parse("")).toEqual(DEFAULT_STATE);
  });

  it("drops unknown values and duplicates", () => {
    const state = parse(
      "state=NSW,XX,NSW,QLD&tech=battery,nuclear&status=operating,bogus&by=nope&measure=huge",
    );
    expect(state.filters.states).toEqual(["NSW", "QLD"]);
    expect(state.filters.techGroups).toEqual(["battery"]);
    expect(state.filters.statuses).toEqual(["operating"]);
    expect(state.groupBy).toBe(DEFAULT_STATE.groupBy);
    expect(state.measure).toBe(DEFAULT_STATE.measure);
  });

  it("trims and caps the search", () => {
    expect(parse("q=%20%20bess%20").filters.search).toBe("bess");
    expect(parse(`q=${"x".repeat(500)}`).filters.search).toHaveLength(
      SEARCH_MAX_LENGTH,
    );
    expect(
      serializeState({
        ...DEFAULT_STATE,
        filters: { ...DEFAULT_STATE.filters, search: "   " },
      }),
    ).toBe("");
  });

  it("only keeps a drilldown on the grouped dimension with a known key", () => {
    expect(parse("by=state&drill=state:NSW").drilldown).toEqual({
      dim: "state",
      key: "NSW",
    });
    expect(parse("by=state&drill=techGroup:battery").drilldown).toBeNull();
    expect(parse("drill=techGroup:nuclear").drilldown).toBeNull();
    expect(parse("drill=garbage").drilldown).toBeNull();
    expect(parse("drill=:battery").drilldown).toBeNull();
  });

  it("round-trips a sort, omits the default, and rejects bad values", () => {
    expect(
      serializeState({
        ...DEFAULT_STATE,
        sort: { key: "keyDate", direction: "desc" },
      }),
    ).toBe("sort=keyDate%3Adesc");
    expect(parse("sort=keyDate:desc").sort).toEqual({
      key: "keyDate",
      direction: "desc",
    });
    expect(serializeState({ ...DEFAULT_STATE, sort: DEFAULT_SORT })).toBe("");
    expect(parse("sort=keyDate:sideways").sort).toEqual(DEFAULT_SORT);
    expect(parse("sort=bogus:desc").sort).toEqual(DEFAULT_SORT);
    expect(parse("sort=keyDate").sort).toEqual(DEFAULT_SORT);
  });

  it("round-trips the recent window and rejects other values", () => {
    const state = {
      ...DEFAULT_STATE,
      filters: { ...DEFAULT_STATE.filters, recentMonths: 12 as const },
    };
    expect(serializeState(state)).toBe("recent=12");
    expect(parse("recent=12").filters.recentMonths).toBe(12);
    expect(parse("recent=24").filters.recentMonths).toBe(24);
    expect(parse("recent=7").filters.recentMonths).toBeNull();
    expect(parse("recent=").filters.recentMonths).toBeNull();
  });
});

describe("parseView", () => {
  it("accepts a bounded lat,lng,zoom triple and rejects anything else", () => {
    expect(parseView("-33.1,138.5,9")).toEqual({
      lat: -33.1,
      lng: 138.5,
      zoom: 9,
    });
    expect(parseView("0,0,5.5")).toEqual({ lat: 0, lng: 0, zoom: 5.5 });
    expect(parseView(null)).toBeNull();
    expect(parseView("1,2")).toBeNull();
    expect(parseView("91,0,5")).toBeNull();
    expect(parseView("0,181,5")).toBeNull();
    expect(parseView("0,0,21")).toBeNull();
    expect(parseView("0,0,-1")).toBeNull();
    expect(parseView("a,b,c")).toBeNull();
  });

  it("writes a fractional zoom to two decimals", () => {
    expect(
      serializeState({
        ...DEFAULT_STATE,
        view: { lat: -33, lng: 138, zoom: 7.123 },
      }),
    ).toBe("view=-33.0000%2C138.0000%2C7.12");
  });
});

describe("parseSelected / toggleSelected", () => {
  it("accepts plain facility codes, drops junk and duplicates, caps the list", () => {
    expect(parseSelected("KINGS_ROCK_WF,MUJA,MUJA,<img src=x>")).toEqual([
      "KINGS_ROCK_WF",
      "MUJA",
    ]);
    expect(parseSelected("x".repeat(41))).toEqual([]);
    expect(parseSelected(null)).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => `F${i}`).join(",");
    expect(parseSelected(many)).toHaveLength(MAX_SELECTED);
  });

  it("toggles membership and keeps the most recent when over the cap", () => {
    expect(toggleSelected([], "A")).toEqual(["A"]);
    expect(toggleSelected(["A", "B"], "A")).toEqual(["B"]);
    const full = Array.from({ length: MAX_SELECTED }, (_, i) => `F${i}`);
    const next = toggleSelected(full, "NEW");
    expect(next).toHaveLength(MAX_SELECTED);
    expect(next.at(-1)).toBe("NEW");
    expect(next).not.toContain("F0");
  });
});
