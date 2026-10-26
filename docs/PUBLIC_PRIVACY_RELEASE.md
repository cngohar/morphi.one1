# Published guest/privacy release — 2026-10-24

Target: the existing **morphi-one** Worker serving `https://morphi.one/` and its `workers.dev` alias. Current published version: `b50a7a18-2e85-4406-bd40-77f27c4b3da3` at 100%; deployment `fdb5c4e0-d618-40f0-a557-0130470cc24a`, 2026-10-24T12:32:54.790982Z. This is a guest/policy update, not the accounts/global launch. Both hostnames change together. Dashboard-managed custom domain and DNS stay unchanged.

## Exact published payload

- `wrangler.public-privacy.jsonc`: an assets-only deployment configuration targeting the existing Worker; no `main`, auth variables, D1 binding, credentials, migrations or SPA fallback. No production resource is provisioned by preparation.
- `build/public-privacy/assets/`: explicit allowlist of prerendered Home and privacy HTML, required compiled client `_app` assets, robots and security headers. Guest Home/results hide account entry points. Account/auth/API/leaderboard paths are unavailable, and review demos/server bundles/source maps/environment files are excluded.
- `build/public-privacy/manifest.json`: SHA-256 for every public asset and the source config. `build/public-privacy/checks/` contains local evidence outside the upload directory.
- Memory and Block rules, score functions, themes and vectors are unchanged. Guest games keep local settings/bests; the later account-import replay queue and all upload endpoints remain disabled in this candidate. Account features in the policy are explicitly identified as a later release.

Preparation/check commands, all local:

```sh
bun run prepare:public-privacy
bun run test:public-privacy
bunx wrangler deploy --config wrangler.public-privacy.jsonc --dry-run --outdir build/public-privacy/dry-run
```

The preparation command intentionally performs no upload and has no deployment branch. Building replaces the candidate assets/manifest, so rerun its checks and review the new hashes after any source change. Main application builds can follow without changing this copied candidate. `test:public-privacy` verifies config/assets against the manifest, starts local workerd, tests the no-JS policy and layouts, checks unavailable endpoints and completes Block-result-Next-to-Memory play. Inspect generated screenshots as part of review. A dry run validates packaging, not live settings or a successful future deployment.

## Publication and verification record

The owner authorized the original prepared guest/privacy release: version `44a5846f-95d6-43d5-b61e-c7f478b6e857`, manifest `15c32fd3562c607d43d676e09041f4ccda498e9457f06a18c553e43ce600efce`. The exact artifact and initial evidence are archived in ignored `build/public-privacy-published-44a5846f/`.

Live checks revealed **Cloudflare Web Analytics through automatic setup**. The owner confirmed keeping it, then explicitly instructed updating `/privacy`, recording the intentional beacon and rechecking live pages. Cloudflare injects the beacon during delivery, so its absence from the build files is **by design**. No analytics setting was added or changed by this publication. A connected diagnostic request for account analytics settings lacked `account-settings.read`; no provider retention configuration is inferred.

The requested disclosure update is now published as `b50a7a18-2e85-4406-bd40-77f27c4b3da3`. Its 41-file manifest SHA-256 is `019edab6f58dff4f231739763a527f955e84afa60432da08a9e19a52f28d82c0`; `checks/deployment.json` records the receipt. Type check (zero errors/warnings), lint, focused privacy browser cases (2/2), publication build, six local artifact check groups and packaging dry run all pass. No account backend bindings are present.

`bun run test:public-privacy --live` passes seven live groups: manifest consistency; unavailable account/auth/API routes; analytics disclosure/metadata; no-JS readability/contact/date/canonical; three approved layouts; intentional Cloudflare beacon with no other external requests; and a real Block-result-Next-to-Memory round without account prompts, replay queue, account API calls or browser errors. The strict raw-build no-script assertion remains; live checks permit only the exact Cloudflare beacon origin/path, not arbitrary analytics. The initial generic external-script failure is explained and retained in the first-release archive rather than misreported as a pass.

Home and privacy return HTTP 200 on both `morphi.one` and `morphi-one.electrasincng.workers.dev`. Non-browser curl responses match the uploaded HTML; browser HTML can include the intentional provider injection. HTTP and www still resolve to canonical `https://morphi.one/`. `checks/live-results.json`, `live-http-results.json`, and `live-privacy-*.png` retain evidence outside the upload directory. No new runtime performance claim/median/p95 or global-launch acceptance is made.

The owner confirms domain ownership is already verified and will configure/apply for the Google project. No Google project/client/credentials, DNS, database, account provisioning or verification submission was performed by the agent.

## Checks for any future explicitly approved update

```sh
bun run test:public-privacy
bun run test:public-privacy --live
```

Rebuilding changes the candidate; repeat its checks and obtain the required authorization before another deployment. Do not use `bun run deploy`, which targets the separate local-account configuration.

## Reference sequence for future deployments

1. Read the final phase report, request/retention limitations, local evidence and manifest. Recheck the current live version/bindings/settings for concurrent changes; if accounts or other new resources appeared, stop and reconcile the candidate instead of removing them. Verify the custom domain is still attached. This review performed GETs only and retrieved no raw user log payloads.
2. Obtain explicit owner approval for **this exact guest-only assets/privacy update to morphi-one**, including the fact that the Svelte server Worker is replaced by static asset serving and unpublished paths return 404. `AGENTS.md` requires approval before every deployment. Wording approval and a dry run are not deployment approval.
3. Only after fresh approval, with the reviewed manifest/config unchanged, the deployment command is `bunx wrangler deploy --config wrangler.public-privacy.jsonc`. **A past publication approval is not permission for another deployment. Do not use `bun run deploy` for this update**, which rebuilds the local-account application and uses its local D1/auth settings. Review any Wrangler warning or drift before accepting it; never silently modify DNS or production secrets.
4. Record the actual new version/deployment id and verify both public hostnames: Home and `/privacy` are HTTP 200; Home links to policy; canonical/title/date/contact are correct; no draft notes or local production links; Block/Next/Memory work; account/auth/API routes remain unavailable; no GA4/ads were added. Confirm HTTP/`www` redirects still work. No public account or Google-flow success is claimed by an assets-only release.
5. If the approved update fails, review rollback to the recorded prior version using the current Wrangler/dashboard workflow. Obtain the applicable explicit deployment/rollback approval; keep both version ids in the report. There are no schema changes in this artifact. Provider resources/data are not rolled back with Worker code.
6. After public pages pass, continue the separate owner-controlled domain/Google steps in `GOOGLE_OAUTH_PUBLIC.md`. Publishing the policy does not publish OAuth, enable accounts or announce v1.

## Sources checked

[Static Assets routing](https://developers.cloudflare.com/workers/static-assets/), [SSG routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), and [rollback limitations](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) were checked alongside installed Wrangler `4.151.3` help/schema. The candidate uses default asset serving, no SPA catch-all and no custom Worker API. The normal local SvelteKit/Cloudflare stack remains unchanged.
