# Morphi

A phone-first puzzle game with seeded Block placement and Memory rounds, four fixed themes, sound, and per-game best scores saved in the browser. Play and Next alternate the games, starting with Block.

Built with SvelteKit, Svelte 5, TypeScript, and Bun. Hosted on Cloudflare Workers at [morphi.one](https://morphi.one).

## Local development

```sh
bun install
bun run dev --host 0.0.0.0
```

## Checks

```sh
bun run lint
bun run check
bun run test:unit -- --run
bunx playwright install chromium # once on a new machine
bun run test:e2e
bun run build
```

`bun run preview:worker` builds and serves the Worker locally. Deployment requires explicit owner permission; there is no automatic deployment from GitHub.

## Project direction

[The simple plan](morphi-plan-simple.md) is the active plan: games first, architecture second. The full plan in `docs/PLAN.md` is reference only. Step 5 public testing is complete per the owner's report; the next implementation scope awaits direction. See [the code map](docs/CODEMAP.md), [decisions](docs/DECISIONS.md), and [reports](docs/PHASE_REPORTS.md).

Local `.env*`, `.dev.vars*`, credential directories, dependencies, and build/test output are excluded from Git. An optional `ELEVENLABS_API_KEY` is used only by an unused server stub; it is not needed to play or develop the games.
