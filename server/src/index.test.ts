import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "./index";
import fixture from "../../client/src/domain/__fixtures__/facilities.sample.json";

// The only thing we mock is the network boundary: global `fetch`.
const env = { OPEN_ELECTRICITY_API_TOKEN: "test-token-value" };
const fetchMock = vi.fn<typeof fetch>();
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

// Everything the Worker logged during a test, as one string, for leak checks.
const loggedText = () =>
  logSpy.mock.calls.map((call) => call.join(" ")).join("\n");

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// `app.request` runs the route in-process; the third argument is the Worker bindings.
const get = (bindings: Record<string, string> = env) =>
  app.request("/api/facilities", {}, bindings);

// Every error must be the same envelope; returns the raw text for leak checks.
async function expectErrorEnvelope(
  res: Response,
  status: number,
  code: string,
) {
  expect(res.status).toBe(status);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const text = await res.text();
  expect(JSON.parse(text)).toEqual({
    error: { code, message: expect.any(String) as string },
  });
  return text;
}

describe("GET /api/facilities", () => {
  it("returns the validated envelope on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse(fixture));

    const res = await get();
    const body: unknown = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      sourceCreatedAt: fixture.created_at,
    });
    expect(body).toHaveProperty("fetchedAt");
    expect(body).toHaveProperty("facilities");
    const { facilities } = body as { facilities: unknown[] };
    expect(facilities).toHaveLength(fixture.data.length);
  });

  it("sends the token upstream as a bearer header", async () => {
    fetchMock.mockResolvedValue(jsonResponse(fixture));

    await get();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openelectricity.org.au/v4/facilities/");
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${env.OPEN_ELECTRICITY_API_TOKEN}`,
    });
    expect(loggedText()).not.toContain(env.OPEN_ELECTRICITY_API_TOKEN);
  });

  it("logs one line with status, duration and counts on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse(fixture));

    await get();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line: unknown = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(line).toMatchObject({
      route: "/api/facilities",
      upstreamStatus: 200,
      facilities: fixture.data.length,
    });
    expect(line).toHaveProperty("durationMs");
    expect(line).toHaveProperty("units");
  });

  it("strips upstream fields that are not in the schema", async () => {
    fetchMock.mockResolvedValue(jsonResponse(fixture));

    const res = await get();
    const text = await res.text();

    // The fixture carries the real `description` HTML; none of it may reach the client.
    expect(fixture.data[0]).toHaveProperty("description");
    expect(text).not.toContain("description");
    expect(text).not.toContain("<p>");
  });

  it("returns 500 missing_token when the binding is absent, without calling upstream", async () => {
    await expectErrorEnvelope(await get({}), 500, "missing_token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 upstream_network when fetch itself rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed: ECONNRESET"));

    const text = await expectErrorEnvelope(
      await get(),
      502,
      "upstream_network",
    );
    expect(text).not.toContain("ECONNRESET");
  });

  it("returns 502 upstream_network when the request is aborted by the timeout", async () => {
    // Same exception `AbortSignal.timeout` produces, without waiting 15 s.
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    await expectErrorEnvelope(await get(), 502, "upstream_network");
  });

  it("returns 502 upstream_invalid_json for a 200 with a non-JSON body", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Gateway busy</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const text = await expectErrorEnvelope(
      await get(),
      502,
      "upstream_invalid_json",
    );
    expect(text).not.toContain("Gateway busy");
  });

  it("passes a timeout signal to fetch", async () => {
    fetchMock.mockResolvedValue(jsonResponse(fixture));

    await get();

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [401, 502, "upstream_auth"],
    [403, 502, "upstream_auth"],
    [429, 503, "upstream_rate_limited"],
    [500, 502, "upstream_non_2xx"],
    [404, 502, "upstream_non_2xx"],
  ])(
    "maps upstream %i to our %i %s without echoing the upstream body",
    async (upstreamStatus, ourStatus, code) => {
      fetchMock.mockResolvedValue(
        jsonResponse({ detail: "SECRET-UPSTREAM-TEXT" }, upstreamStatus),
      );

      const text = await expectErrorEnvelope(await get(), ourStatus, code);
      expect(text).not.toContain("SECRET-UPSTREAM-TEXT");
    },
  );

  it("returns 502 upstream_bad_shape when the body fails validation", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, data: [] }));

    await expectErrorEnvelope(await get(), 502, "upstream_bad_shape");
  });

  it("returns 502 upstream_bad_shape when a nested unit field has the wrong type", async () => {
    const [first, ...rest] = fixture.data;
    const broken = {
      ...fixture,
      data: [
        {
          ...first,
          units: [{ ...first.units[0], capacity_registered: "lots" }],
        },
        ...rest,
      ],
    };
    fetchMock.mockResolvedValue(jsonResponse(broken));

    const text = await expectErrorEnvelope(
      await get(),
      502,
      "upstream_bad_shape",
    );
    expect(text).not.toContain("lots");
    // The log names the broken path, but never the value.
    const logged = loggedText();
    expect(logged).toContain("capacity_registered");
    expect(logged).not.toContain("lots");
  });
});

describe("fallback handlers", () => {
  it("returns 404 not_found for unknown routes", async () => {
    const res = await app.request("/api/nope", {}, env);

    await expectErrorEnvelope(res, 404, "not_found");
  });

  it("returns 500 internal_error without leaking the exception when a handler throws", async () => {
    // No bindings object at all: `c.env` is undefined, so reading the token throws a TypeError.
    const res = await app.request("/api/facilities");

    const text = await expectErrorEnvelope(res, 500, "internal_error");
    expect(text).not.toContain("TypeError");
    expect(text).not.toContain("Cannot read");
    expect(text).not.toContain("stack");
    // The exception is still recorded server-side.
    expect(loggedText()).toContain("TypeError");
  });
});
