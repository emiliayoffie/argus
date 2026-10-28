# Argus

Argus is a prototype that uses the [OpenElectricity](https://openelectricity.org.au) Facilities API to answer questions about Australia's generation and storage fleet: what's operating, what's coming, what's closing, and how much capacity that adds up to.

**Live:** https://argus.arcane-dev.workers.dev/

The name comes from Argus Panoptes, the many-eyed watchman in Greek myth. The goal is to help people see the whole fleet at once and then look closely at the facilities behind any number. Monitoring changes over time is the natural next step.

## Approach

RenewMap already implements a map really well, so I didn't want to rebuild it. Reading the three customer questions, none of them is really "where is it?". They're asking how much, of what, and when:

- A battery developer wants a list of batteries in NSW and QLD that recently came online.
- An analyst wants the total committed wind, solar and battery capacity by state.
- A government team wants to know how much of the fossil fleet has retired and what's left.

These are analysis questions, and the tricky parts are in the data, not the geography. A facility is made up of units with different technologies and statuses. Most batteries are listed three times. Some pumped-hydro pumps are tagged as generators. Some capacities are missing. Dates come with different levels of precision. If any of that is handled wrong, the totals look plausible but are wrong.

So I built Argus around the numbers. It's one explorer rather than three separate pages, since each question is just a combination of filters and a grouping. The map is still there, but it shows the same selection as the table.

### Assumptions

- "Recently came online" means commissioning or operating, sorted by the published commencement date. Telemetry dates aren't used.
- "Committed" is the registry's `committed` status. Capacity is the registered MW of generating units. Battery storage (MWh) is shown separately.
- "Offline" means the registry's `retired` status, not live output. A facility with any unit still running counts as remaining.
- Regions are labelled by state, but they're market regions: NSW1 includes the ACT, and WEM covers only the south-west grid of WA.

## Running it locally

Prerequisites: Node 22 (see `.nvmrc`) and Yarn 3.4.1. The repo pins Yarn through `.yarn/releases`, so any Yarn 1.22 or later picks it up; run `yarn --version` to confirm it prints `3.4.1`. You also need an [OpenElectricity API key](https://platform.openelectricity.org.au).

```bash
cp server/.dev.vars.example server/.dev.vars   # set OPEN_ELECTRICITY_API_TOKEN
yarn install
yarn dev                                        # http://localhost:5173
```

The token is read only by the Worker, from `server/.dev.vars`, which is git-ignored. It is never sent to the browser. Run every command from the repo root.

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `yarn dev`       | Vite client and Worker together; Vite proxies `/api`    |
| `yarn test`      | Vitest, once (`yarn vitest` to watch)                   |
| `yarn lint`      | ESLint                                                  |
| `yarn typecheck` | `tsc` for the client and the Worker                     |
| `yarn build`     | Production client build into `client/dist`              |
| `yarn check`     | lint, format check, typecheck, test and build, in order |

## Using it

Everything on the page describes one selection, and the URL always matches the screen, so any view can be shared by copying the address.

- **Filters** sit in the toolbar: state/region, technology, status, a search box, and a Dates menu with three ranges (came online, expected online, closed). Each range is tied to the status it belongs to, so filling in several shows units in any of them; every other filter must match the same unit.
- **Examples** in the toolbar opens the three customer questions as starting points. They're ordinary filter states:
  - Batteries recently online in NSW and QLD → `?state=NSW,QLD&tech=battery&status=commissioning,operating&by=status&sort=keyDate:desc&recent=12`
  - Committed wind, solar and battery by state → `?tech=solar,wind,battery&status=committed&by=state&split=techGroup`
  - The fossil fleet, retired and remaining → `?tech=coal,gas,distillate&by=status&measure=mw&split=techGroup`
- **The headline and four cards** sum the selection: facilities, units, registered capacity (with a stacked bar by status) and battery storage. Each card's ⓘ explains how the number is calculated and what was left out.
- **Capacity breakdown** groups the selection by state, technology or status, in MW or facilities, optionally split by a second dimension. Grouped by state, a small shaded map of Australia sits beside the bars, and hovering a state highlights its bar and vice versa. Clicking a bar or a state narrows the cards, map and table without hiding the other bars.
- **Map** plots one marker per facility in the selection; it collapses without losing its position. **Facilities** lists the same selection in a sortable, paginated table. Click rows or markers to highlight facilities for comparison; totals never change. **Export CSV** writes every listed facility (all pages, after filters and drilldown) with dates and their precision.
- The eye next to the wordmark switches light and dark mode; the dots at the top right switch to deuteranopia, tritanopia or greyscale palettes, which recolour the charts, state map, markers, legends and map tiles. Text, badges and input outlines meet WCAG AA contrast in both themes and every palette.

## How it's built

- `server/` is a Cloudflare Worker using Hono. It holds the token, fetches `/v4/facilities/` once per request, validates the response with Zod and passes on only the fields the client needs.
- `client/` is React and TypeScript using Vite. The dataset is small (633 facilities, about 540 KB after trimming), so the client fetches it once and does all filtering and aggregation in the browser.
- `client/src/domain/` contains plain functions with no React, tested against a trimmed real API response. Normalising, filtering, aggregating, dates and URL parsing all live here.
- `App.tsx` holds the view state, keeps it in sync with the URL, and derives everything else.

## API

`GET /api/facilities` returns `{ facilities, fetchedAt, sourceCreatedAt }`. Each facility includes its units, capacities, dates with precision, and location. Unused fields such as the HTML description are dropped.

This is the only endpoint. The client fetches the full dataset once and does all filtering, grouping and aggregation in the browser. Errors come back as `{ error: { code, message } }` with a fixed set of codes that the client maps to its own messages.

## Data rules

- MW is power and MWh is energy, and they're never added together. MW counts generating units only. Loads, battery charging and pumps are left out and counted in the explanation.
- Each battery is counted once.
- Missing capacity is shown as "—", left out of totals, and counted as unknown.
- Grouped facility counts can add up to more than the total, because a hybrid facility appears in more than one group. The UI notes this.
- Dates keep their precision. Year or month dates are shown with a `~`, and the CSV carries a precision column beside each date. Expected closure dates are shown only when they fall within ten years of the dataset date; the rest are decades-out placeholders.
- Statuses are registry classifications. "Retired" MW can include capacity re-registered under a newer unit, so the status split is labelled as registry data rather than physical capacity lost.
- Facilities without coordinates still appear in the table and in every total.

## Limitations

- Map markers can overlap at low zoom, and browser back/forward navigation doesn't step through previous views.
- Browser testing is currently manual, with automated tests covering domain logic and API behavior.
- Argus uses a current snapshot of facility data, so it can't show how projects have changed over time.
- This is a prototype for local use. See Data use and deployment below before exposing it publicly.

## Data use and deployment

The data comes from the [OpenElectricity](https://openelectricity.org.au) API and is shown with a link to it in the page footer. Unless stated otherwise, OpenElectricity data is licensed [CC BY-NC 4.0](https://platform.openelectricity.org.au/license): you must credit OpenElectricity and say if you changed the data (Argus normalises, filters and aggregates it). Community and Academic plans are for non-commercial use only; commercial use needs an Enterprise licence from OpenElectricity.

Before this is put in front of the public:

- **Licence:** confirm the plan and terms cover the intended use.
- **Edge cache:** cache `/api/facilities` for 15 minutes, matching the upstream `max-age=900`. Today every page load makes one upstream request.
- **Rate limiting:** add a Cloudflare rate-limit rule on `/api/facilities`, so visitors cannot exhaust the API quota.
- **Token:** store it with `wrangler secret put OPEN_ELECTRICITY_API_TOKEN`, never in `wrangler.toml`.

## Verification

Run on 2026-10-28 with Node 22.23.3 and Yarn 3.4.1:

- `yarn check` passed: ESLint, Prettier, typecheck, 193 tests in 13 files (domain logic, URL state, API route and error mapping, client fetch states), and the production client build.
- Checked in headless Chrome against the running app:
  - The default view `/` keeps a clean URL and a disabled Reset button after the map fits itself. Dragging the map writes `view=`; pressing Reset returns to `/` with Reset disabled again. A shared `view=` link restores its position.
  - There is no horizontal scrolling at 320, 360, 390 or 1280 px, nor at 390 px with the WCAG text-spacing overrides applied. No visible text is under 12 px.
  - Text, badge and input-outline contrast meets WCAG AA in light and dark with all three palettes (measured, not estimated).
- Not covered: automated browser tests, Safari and Firefox, and screen-reader testing.

## Next steps

### Stretch goals

- Expand facilities to show individual units and their details.
- Add data-completeness indicators per group, beyond the current unknown-MW counts.
- Compare portfolios side by side.
- Add Playwright tests for key user workflows.

### Longer term

Argus could evolve into a monitoring tool with saved portfolios, historical data, and alerts when facility statuses, capacities, or commissioning dates change.

It could also bring in news and announcements about energy projects to help users understand what's happening at each facility.
