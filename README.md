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

```bash
cp server/.dev.vars.example server/.dev.vars   # add your OpenElectricity API token
yarn install
yarn dev                                        # http://localhost:5173
```

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
- Dates keep their precision. Year or month dates are shown with a `~`. Expected closure dates aren't shown: most are decades-out placeholders.
- Facilities without coordinates still appear in the table and in every total.

## Limitations

- Map markers can overlap at low zoom, and browser back/forward navigation doesn't step through previous views.
- Browser testing is currently manual, with automated tests covering domain logic and API behavior.
- Argus uses a current snapshot of facility data, so it can't show how projects have changed over time.
- A public deployment would need additional API quota protection and a review of data licensing.

## Next steps

### Stretch goals

- Expand facilities to show individual units and their details.
- Add date-range filters and data-completeness indicators.
- Compare portfolios side by side and export results to CSV.
- Add Playwright tests for key user workflows.

### Longer term

Argus could evolve into a monitoring tool with saved portfolios, historical data, and alerts when facility statuses, capacities, or commissioning dates change.

It could also bring in news and announcements about energy projects to help users understand what's happening at each facility.
