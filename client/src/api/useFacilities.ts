import { useEffect, useState } from "react";
import type {
  ErrorCode,
  FacilitiesResponse,
} from "../../../server/src/contract";
import { facilitiesToRows } from "../domain/normalize";
import type { UnitRow } from "../domain/types";

export type Dataset = {
  rows: UnitRow[];
  fetchedAt: string;
  sourceCreatedAt: string;
};

export type FacilitiesResult =
  | { status: "loading" }
  | { status: "error"; code: ErrorCode }
  | { status: "ready"; data: Dataset };

// Client-owned text per server error code; the server's message is never rendered
export const ERROR_COPY: Record<
  ErrorCode,
  { text: string; retryable: boolean }
> = {
  missing_token: {
    text: "The server has no OpenElectricity API token configured. Set it in server/.dev.vars and restart.",
    retryable: false,
  },
  upstream_auth: {
    text: "OpenElectricity rejected the server's API token.",
    retryable: false,
  },
  upstream_rate_limited: {
    text: "OpenElectricity is rate-limiting requests. Try again in a minute.",
    retryable: true,
  },
  upstream_network: {
    text: "The server could not reach OpenElectricity.",
    retryable: true,
  },
  upstream_non_2xx: {
    text: "OpenElectricity returned an error.",
    retryable: true,
  },
  upstream_invalid_json: {
    text: "OpenElectricity returned an unreadable response.",
    retryable: true,
  },
  upstream_bad_shape: {
    text: "OpenElectricity returned data in an unexpected shape, so nothing is shown rather than a guess.",
    retryable: true,
  },
  not_found: {
    text: "The facilities endpoint was not found.",
    retryable: false,
  },
  internal_error: {
    text: "Something went wrong talking to the server.",
    retryable: true,
  },
};

const isErrorCode = (code: unknown): code is ErrorCode =>
  typeof code === "string" && Object.hasOwn(ERROR_COPY, code);

// The Worker is our own code, so this is a sanity check on the envelope, not a schema
export function isFacilitiesResponse(
  body: unknown,
): body is FacilitiesResponse {
  if (typeof body !== "object" || body === null) return false;
  if (!("facilities" in body) || !Array.isArray(body.facilities)) return false;
  if (!("fetchedAt" in body) || typeof body.fetchedAt !== "string")
    return false;
  if (!("sourceCreatedAt" in body) || typeof body.sourceCreatedAt !== "string")
    return false;
  return true;
}

export function errorCode(body: unknown): ErrorCode {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      isErrorCode(error.code)
    )
      return error.code;
  }
  return "internal_error";
}

async function load(signal: AbortSignal): Promise<FacilitiesResult> {
  const res = await fetch("/api/facilities", { signal });
  // Non-JSON bodies (e.g. the Vite proxy's own error page when the Worker is down) end up as internal_error
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return { status: "error", code: errorCode(body) };
  if (!isFacilitiesResponse(body))
    return { status: "error", code: "internal_error" };
  return {
    status: "ready",
    data: {
      rows: facilitiesToRows(body.facilities),
      fetchedAt: body.fetchedAt,
      sourceCreatedAt: body.sourceCreatedAt,
    },
  };
}

// Fetches the whole dataset once (and again on retry); all filtering is client-side
export function useFacilities(): {
  result: FacilitiesResult;
  retry: () => void;
} {
  const [result, setResult] = useState<FacilitiesResult>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController(); // handles race conditions
    void (async () => {
      const next = await load(controller.signal).catch(
        (): FacilitiesResult => ({ status: "error", code: "internal_error" }),
      );
      // A response that arrives after unmount or retry is simply dropped
      if (!controller.signal.aborted) setResult(next);
    })();
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setResult({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  return { result, retry };
}
