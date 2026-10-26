import { describe, expect, it } from "vitest";
import { UpstreamEnvelope } from "../../../server/src/contract";
import fixture from "./__fixtures__/facilities.sample.json";
import { summarize } from "./aggregate";
import { applyFilters } from "./filter";
import { headline } from "./headline";
import { facilitiesToRows } from "./normalize";
import type { AppState } from "./types";
import { DEFAULT_STATE } from "./url";

const rows = facilitiesToRows(UpstreamEnvelope.parse(fixture).data);
const sentence = (state: AppState, drill: string | null = null) =>
  headline(state, summarize(applyFilters(rows, state.filters)), drill);

describe("headline", () => {
  it("describes the default view", () => {
    expect(sentence(DEFAULT_STATE)).toMatch(
      /^\d+ energy facilities across Australia — [\d,.]+ (MW|GW) registered, [\d,.]+ (MWh|GWh) of battery storage\.$/,
    );
  });

  it("names technologies, states, statuses and a drilldown", () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      filters: {
        states: ["NSW", "QLD"],
        techGroups: ["battery"],
        statuses: ["operating", "commissioning"],
        search: "",
      },
    };
    expect(sentence(state, "Commissioning")).toMatch(
      /^\d+ battery facilit(y|ies) in NSW and QLD, operating or commissioning \(showing Commissioning\) — /,
    );
  });

  it("lists three technologies with a serial 'and' and mentions a search", () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      filters: {
        states: [],
        techGroups: ["solar", "wind", "battery"],
        statuses: ["committed"],
        search: "bogg",
      },
    };
    expect(sentence(state)).toContain("solar, wind and battery facilit");
    expect(sentence(state)).toContain(
      "across Australia, committed, matching “bogg”",
    );
  });

  it("omits figures that would be unknown", () => {
    const state: AppState = {
      ...DEFAULT_STATE,
      filters: { ...DEFAULT_STATE.filters, search: "SLDCBLK" },
    };
    expect(sentence(state)).toBe(
      "1 energy facility across Australia, matching “SLDCBLK”.",
    );
  });
});
