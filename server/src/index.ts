import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  UpstreamEnvelope,
  type ErrorCode,
  type ErrorResponse,
  type FacilitiesResponse,
} from "./contract";

type Env = {
  // Optional so that a missing token is a handled error, not a type lie
  OPEN_ELECTRICITY_API_TOKEN?: string;
};

const UPSTREAM_URL = "https://api.openelectricity.org.au/v4/facilities/";
// Give up after 15s so a stalled upstream becomes an error, not an endless wait
const UPSTREAM_TIMEOUT_MS = 15_000;

const ERRORS: Record<
  ErrorCode,
  { status: ContentfulStatusCode; message: string }
> = {
  missing_token: {
    status: 500,
    message: "Server is missing its upstream API token.",
  },
  upstream_auth: {
    status: 502,
    message: "Upstream rejected the server's credentials.",
  },
  upstream_rate_limited: {
    status: 503,
    message: "Upstream rate limit reached; try again shortly.",
  },
  upstream_network: { status: 502, message: "Could not reach upstream." },
  upstream_non_2xx: { status: 502, message: "Upstream returned an error." },
  upstream_invalid_json: {
    status: 502,
    message: "Upstream returned a non-JSON body.",
  },
  upstream_bad_shape: {
    status: 502,
    message: "Upstream returned an unexpected response shape.",
  },
  not_found: { status: 404, message: "No such route." },
  internal_error: { status: 500, message: "Unexpected server error." },
};

function log(fields: Record<string, unknown>) {
  console.log(JSON.stringify(fields));
}

function fail(
  c: Context<{ Bindings: Env }>,
  code: ErrorCode,
  fields: Record<string, unknown> = {},
) {
  // Every error passes through here, so the status, message, log line and
  // headers are decided once per code (ERRORS table) instead of at each call site
  const { status, message } = ERRORS[code];
  // Structured log: route, error code and whatever the caller measured
  // (upstream status, duration). Never the token, upstream body or Zod messages
  log({ route: c.req.path, error: code, ...fields });
  // no-store tells browsers, proxies and Cloudflare's edge not to keep a copy.
  // Some error statuses are cacheable by default, so without this a transient
  // upstream 429 could be replayed for minutes and "Retry" would never reach
  // upstream again. Success responses are left cacheable for a future edge cache
  c.header("Cache-Control", "no-store");
  // Fixed message from the table, not the upstream text: the client maps the
  // code to its own copy and nothing from upstream reaches the browser
  return c.json<ErrorResponse>({ error: { code, message } }, status);
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/facilities", async (c) => {
  const started = Date.now();
  const durationMs = () => Date.now() - started;
  const token = c.env.OPEN_ELECTRICITY_API_TOKEN;
  if (!token) return fail(c, "missing_token");

  let res: Response;
  try {
    res = await fetch(UPSTREAM_URL, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return fail(c, "upstream_network", { durationMs: durationMs() });
  }

  const upstreamStatus = res.status;
  if (!res.ok) {
    const code: ErrorCode =
      upstreamStatus === 401 || upstreamStatus === 403
        ? "upstream_auth"
        : upstreamStatus === 429
          ? "upstream_rate_limited"
          : "upstream_non_2xx";
    return fail(c, code, { upstreamStatus, durationMs: durationMs() });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return fail(c, "upstream_invalid_json", {
      upstreamStatus,
      durationMs: durationMs(),
    });
  }

  // Validate before trusting
  const parsed = UpstreamEnvelope.safeParse(json);
  if (!parsed.success) {
    return fail(c, "upstream_bad_shape", {
      upstreamStatus,
      durationMs: durationMs(),
      issueCount: parsed.error.issues.length,
      issues: parsed.error.issues
        .slice(0, 5)
        .map((i) => ({ path: i.path.map(String).join("."), code: i.code })),
    });
  }

  const { data, created_at } = parsed.data;
  log({
    route: c.req.path,
    upstreamStatus,
    durationMs: durationMs(),
    facilities: data.length,
    units: data.reduce((n, f) => n + f.units.length, 0),
  });
  const body: FacilitiesResponse = {
    facilities: data,
    fetchedAt: new Date().toISOString(),
    sourceCreatedAt: created_at,
  };
  return c.json(body);
});

// Fallbacks
app.notFound((c) => fail(c, "not_found"));
app.onError((err, c) =>
  fail(c, "internal_error", { name: err.name, message: err.message }),
);

export default app;
