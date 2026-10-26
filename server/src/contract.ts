import { z } from "zod";

/*
 * Schema for the upstream OpenElectricity `/v4/facilities/` response.
 *
 * - Zod drops fields we didn't list → the schema is also our allowlist.
 * - `.passthrough()` would forward untrusted HTML → XSS risk, and bloat.
 * - `.strict()` would break the app when upstream adds a harmless field.
 * - Ids are plain strings so new values don't break the server; the client
 *   maps unknowns to `other`.
 * - Upstream omits missing keys rather than sending `null`, hence `.nullish()`.
 */

// Only the `YYYY-MM-DDT` prefix is checked: the client slices these strings
// and never parses them with `new Date()`, so the prefix is all it relies on.
const sourceDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T/)
  .nullish();

// One generating/storage/load unit inside a facility.
export const Unit = z.object({
  code: z.string(),
  fueltech_id: z.string(),
  status_id: z.string(),
  dispatch_type: z.string(),
  capacity_registered: z.number().nullish(),
  capacity_storage: z.number().nullish(),
  data_first_seen: z.string().nullish(),
  data_last_seen: z.string().nullish(),
  commencement_date: sourceDate,
  commencement_date_specificity: z.string().nullish(),
  closure_date: sourceDate,
  closure_date_specificity: z.string().nullish(),
  expected_operation_date: sourceDate,
  expected_operation_date_specificity: z.string().nullish(),
  expected_closure_date: sourceDate,
  expected_closure_date_specificity: z.string().nullish(),
});

// A site with one or more units. `location` is absent for some facilities.
export const Facility = z.object({
  code: z.string(),
  name: z.string(),
  network_id: z.string(),
  network_region: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }).nullish(),
  units: z.array(Unit),
});

// The whole upstream body. A 200 with `success: false` is a shape error, not
// an empty dataset.
export const UpstreamEnvelope = z.object({
  created_at: z.string(),
  success: z.literal(true),
  data: z.array(Facility),
  total_records: z.number().int().nullish(),
});

// Types are derived from the schemas so they can never drift apart.
export type UnitDto = z.output<typeof Unit>;
export type FacilityDto = z.output<typeof Facility>;

// What the Worker returns to the client on success.
export type FacilitiesResponse = {
  facilities: FacilityDto[];
  /** When the Worker fetched upstream (ISO instant). */
  fetchedAt: string;
  /** Upstream `created_at`: when OpenElectricity generated the dataset. */
  sourceCreatedAt: string;
};

// Closed set of error codes the Worker can return. Grows as handlers are added.
export type ErrorCode =
  | "missing_token"
  | "upstream_auth"
  | "upstream_rate_limited"
  | "upstream_network"
  | "upstream_non_2xx"
  | "upstream_invalid_json"
  | "upstream_bad_shape"
  | "not_found"
  | "internal_error";

// What the Worker returns to the client on any failure.
export type ErrorResponse = { error: { code: ErrorCode; message: string } };
