# RenewMap — Energy Facilities Explorer

An explorer for Australia's energy facilities, built with React and TypeScript on top of the [OpenElectricity](https://openelectricity.org.au) v4 Facilities API. A Cloudflare Worker (Hono) holds the API token and proxies the data; the client filters and aggregates it.

> **Status: in development.** This README currently covers setup only. Usage, architecture, data rules, the API contract, limitations, and verification results will be documented when the build is complete.

## Prerequisites

- **Node 22.** The repo pins it in `.nvmrc`. With [fnm](https://github.com/Schniz/fnm): `fnm use` (or `fnm install 22 && fnm use 22`).
- **Yarn.** The repo pins Yarn 3.4.1 in `.yarn/releases/` (referenced by `.yarnrc.yml`), so any global `yarn` delegates to it. If you don't have one: `npm install --global yarn`.

Run all commands from this directory (`rm-challenge/`). Check the version first:

```bash
yarn --version   # should print 3.4.1
```

## Configuration

The Worker reads the OpenElectricity API token from a local, gitignored file:

```bash
cp server/.dev.vars.example server/.dev.vars
```

Then set `OPEN_ELECTRICITY_API_TOKEN` in `server/.dev.vars` to a key from [platform.openelectricity.org.au](https://platform.openelectricity.org.au/sign-in). The token stays server-side: never commit it or expose it to the client.

## Run locally

```bash
yarn install   # install dependencies
yarn dev       # start the client and the Worker together
```

Open http://localhost:5173. Vite serves the client and proxies `/api` to the Worker.

## Tests

No tests exist yet; they arrive with the server proxy and domain logic. Once they do:

```bash
yarn test --run   # run the Vitest suite once (plain `yarn test` watches)
```

## Layout

```
rm-challenge/
├── client/   React + TypeScript + Vite (config: client/vite.config.ts)
└── server/   Cloudflare Worker + Hono (config: server/wrangler.toml)
```

## Data source

Facility data © [OpenElectricity](https://openelectricity.org.au). Data from the Community API plan is licensed for non-commercial use only.
