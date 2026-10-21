import { Hono } from "hono";
import {
  UpstreamEnvelope,
  type ErrorResponse,
  type FacilitiesResponse,
} from "./contract";

type Env = {
  // Optional on purpose: a missing binding must be a handled error, not a type lie.
  OPEN_ELECTRICITY_API_TOKEN?: string;
};

const UPSTREAM_URL = "https://api.openelectricity.org.au/v4/facilities/";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/facilities", async (c) => {
  // The token comes from the Worker binding (server/.dev.vars locally).
  // It never leaves this function.
  const token = c.env.OPEN_ELECTRICITY_API_TOKEN;
  if (!token) {
    return c.json<ErrorResponse>(
      {
        error: {
          code: "missing_token",
          message: "Server is missing its upstream API token.",
        },
      },
      500,
    );
  }

  const res = await fetch(UPSTREAM_URL, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const json: unknown = await res.json();

  // Validate before trusting: a TypeScript type says nothing about real JSON.
  const parsed = UpstreamEnvelope.safeParse(json);
  if (!parsed.success) {
    return c.json<ErrorResponse>(
      {
        error: {
          code: "upstream_bad_shape",
          message: "Upstream returned an unexpected response shape.",
        },
      },
      502,
    );
  }

  const body: FacilitiesResponse = {
    facilities: parsed.data.data,
    fetchedAt: new Date().toISOString(),
    sourceCreatedAt: parsed.data.created_at,
  };
  return c.json(body);
});

export default app;
