import { describe, expect, it } from "vitest";
import type { AppState } from "./types";
import {
  DEFAULT_STATE,
  parseState,
  SEARCH_MAX_LENGTH,
  serializeState,
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
      },
      groupBy: "state",
      measure: "facilities",
      drilldown: { dim: "state", key: "NSW" },
    };
    const query = serializeState(state);
    expect(query).toBe(
      "state=NSW%2CQLD&tech=battery&status=operating%2Ccommissioning&q=bess&by=state&measure=facilities&drill=state%3ANSW",
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
});
