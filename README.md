# Argus

_See beyond the numbers._

Argus is a prototype that uses the [OpenElectricity](https://openelectricity.org.au) Facilities API to answer questions about Australia's generation and storage fleet: what's operating, what's coming, what's closing, and how much capacity that adds up to.

The name comes from Argus Panoptes, the many-eyed watchman in Greek myth. The goal is to help people see the whole fleet at once and then look closely at the facilities behind any number. Monitoring changes over time is the natural next step.

## Approach

RenewMap already implements a map really well, so I didn't want to rebuild it. Reading the three customer questions, none of them is really "where is it?". They're asking how much, of what, and when:

- A battery developer wants a list of batteries in NSW and QLD that recently came online.
- An analyst wants the total committed wind, solar and battery capacity by state.
- A government team wants to know how much of the fossil fleet has retired and what's left.

These are analysis questions, and the tricky parts are in the data, not the geography. A facility is made up of units with different technologies and statuses. Most batteries are listed three times. Some pumped-hydro pumps are tagged as generators. Some capacities are missing. Dates come with different levels of precision. If any of that is handled wrong, the totals look plausible but are wrong.

So I built Argus around the numbers. It's one explorer rather than three separate pages, since each question is just a combination of filters and a grouping. The map is still there, but it shows the same selection as the table.

The page works top to bottom:

1. **Filters.** State, technology and status menus plus a search box. Filters match units: a facility shows up if one of its units matches every filter. Three links under the toolbar set up each customer question.
2. **Summary.** A one-line headline, then distinct facilities, matching units, registered MW and battery storage MWh. The MW card explains what it counted, what it excluded and what it couldn't count.
3. **Breakdown.** Group by state, technology or status and show MW or facility counts. Clicking a bar narrows the summary and the table to that group. The other bars stay visible.
4. **Map and table.** One marker and one row per facility. Click markers or rows to highlight facilities (this doesn't change the totals). A facility with some retired units is labelled "Some units retired (n of m)", so it never looks fully closed.
5. **Sharing.** The whole view is stored in the URL, including the map position and highlighted facilities.

### Assumptions

- "Recently came online" means commissioning or operating, sorted by the published commencement date. Telemetry dates aren't used.
- "Committed" is the registry's `committed` status. Capacity is the registered MW of generating units. Battery storage (MWh) is shown separately.
- "Offline" means the registry's `retired` status, not live output. A facility with any unit still running counts as remaining.
- Regions are labelled by state, but they're market regions: NSW1 includes the ACT, and WEM covers only the south-west grid of WA.

### The three questions

With the app running:

| Question                                   | URL                                                           | Try                                                                 |
| ------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Batteries recently online in NSW and QLD   | `/?state=NSW,QLD&tech=battery&status=commissioning,operating` | Sort by Key date. Click the Commissioning bar.                      |
| Committed wind, solar and battery by state | `/?tech=solar,wind,battery&status=committed&by=state`         | The bars add up to the MW card. Click QLD to list the projects.     |
| Fossil fleet: retired vs remaining         | `/?tech=coal,gas,distillate&by=status&measure=facilities`     | Click Retired. Facilities that still have running units are marked. |

## Running it

You need Node 22 and Yarn. The repo pins Yarn 3.4.1, so any global `yarn` will use it. Run commands from `rm-challenge/`.

```bash
cp server/.dev.vars.example server/.dev.vars   # add OPEN_ELECTRICITY_API_TOKEN
yarn install
yarn dev     # http://localhost:5173 (the Worker runs on :8787)
yarn check   # lint, format check, typecheck, tests, build
```

The token stays in the Worker. It isn't in the client bundle, the logs or any response.

## How it's built

- `server/` is a Cloudflare Worker using Hono. It holds the token, fetches `/v4/facilities/` once per request, validates the response with Zod and passes on only the fields the client needs.
- `client/` is React and TypeScript using Vite. The dataset is small (633 facilities, about 540 KB after trimming), so the client fetches it once and does all filtering and aggregation in the browser.
- `client/src/domain/` contains plain functions with no React, tested against a trimmed real API response. Normalising, filtering, aggregating, dates and URL parsing all live here.
- `App.tsx` holds the view state, keeps it in sync with the URL, and derives everything else.

### Decisions

- **Client-side filtering, no cache.** With this much data every interaction is instant, and the Worker only has two jobs. I'd move filtering to the server if the data grew about 10×. I'd add a cache before any public deployment, or if the upstream API started rate limiting.
- **No TanStack Query, Hono RPC or Tailwind.** There's one endpoint, fetched once. The client imports the response type from the Worker directly. The CSS is a single file. Each tool would earn its place on a bigger app, but here it would mostly add setup.
- **Leaflet, not MapLibre.** The map is secondary here. MapLibre would make sense if the map became the main view.
- **Battery representations.** I use the discharging unit as-is, or the bidirectional one if there's no discharging unit. A test checks that the discharging unit is never missing a field the other two have. The three sometimes disagree, so I pick one rather than merge them.
- **Dates are sliced, never parsed.** The source dates have fixed +10:00 and +08:00 offsets, so parsing them would shift the day for anyone further west. The tests also run in a US timezone to catch this.
- **All-or-nothing validation.** If the upstream response doesn't match the schema, the app shows an error rather than a partial dataset with quietly wrong totals.

## API

`GET /api/facilities` returns `{ facilities, fetchedAt, sourceCreatedAt }`. Each facility includes its units, capacities, dates with precision, and location. Unused fields such as the HTML description are dropped.

Errors return `{ error: { code, message } }` with `Cache-Control: no-store`:

| Code                    | HTTP | When                                      |
| ----------------------- | ---- | ----------------------------------------- |
| `missing_token`         | 500  | no token configured                       |
| `upstream_auth`         | 502  | upstream 401 or 403                       |
| `upstream_rate_limited` | 503  | upstream 429                              |
| `upstream_network`      | 502  | the request failed or took more than 15 s |
| `upstream_non_2xx`      | 502  | any other upstream error                  |
| `upstream_invalid_json` | 502  | the body isn't JSON                       |
| `upstream_bad_shape`    | 502  | schema check failed                       |
| `not_found`             | 404  | unknown route                             |
| `internal_error`        | 500  | unexpected error                          |

## Data rules

- MW is power and MWh is energy, and they're never added together. MW counts generating units only. Loads, battery charging and pumps are left out and counted in the explanation.
- Each battery is counted once.
- Missing capacity is shown as "—", left out of totals, and counted as unknown.
- Grouped facility counts can add up to more than the total, because a hybrid facility appears in more than one group. The UI notes this.
- Dates keep their precision. Year or month dates are shown with a `~`. Expected closure dates aren't shown: most are decades-out placeholders.
- Facilities without coordinates still appear in the table and in every total.

## Limitations and next steps

- Back/forward don't step through views (the URL is replaced, not pushed). Map markers overlap at low zoom. Browser testing is manual.
- Before deploying: a 15-minute edge cache, a rate limit, the token in `wrangler secret`, and a licence check. The endpoint is unauthenticated and uses my API quota.
- Observability is one structured log line per Worker request (status, duration, counts, error code; never the token or bodies). Deploying would add metrics, alerting and client error reporting.
- Stretch: expandable unit rows, a date-range filter, side-by-side portfolio comparison, data-completeness indicators (e.g. share of committed MW with a published expected date), CSV export, a Playwright smoke test.
- Later: saved views and portfolios; ingesting public project announcements and linking them to facilities, keeping reported claims distinct from registry facts; and historical snapshots, below.

### Historical snapshots and change detection

Capture OpenElectricity data periodically to answer questions the current snapshot alone can't:

- Which battery projects became operational this month?
- Which projects changed their expected commissioning dates?
- How much capacity moved from committed to operating?
- Which facilities changed registered capacity?

This could grow into a facility change feed and customer alerts.
