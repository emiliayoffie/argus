import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "./index";
import fixture from "../../client/src/domain/__fixtures__/facilities.sample.json";

// The only thing we mock is the network boundary: global `fetch`.
const env = { OPEN_ELECTRICITY_API_TOKEN: "test-token-value" };
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// `app.request` runs the route in-process; the third argument is the Worker bindings.
const get = (bindings: Record<string, string> = env) =>
  app.request("/api/facilities", {}, bindings);

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
    const res = await get({});

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "missing_token", message: expect.any(String) as string },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 upstream_bad_shape when the body fails validation", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, data: [] }));

    const res = await get();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "upstream_bad_shape",
        message: expect.any(String) as string,
      },
    });
  });
});
