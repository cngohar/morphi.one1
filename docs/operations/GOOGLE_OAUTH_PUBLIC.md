# Public Google sign-in submission guide

Prepared 2026-10-23. Local Google OAuth works according to the owner's confirmation. Guest homepage/privacy publication was explicitly authorized and completed on 2026-10-24; the subsequent owner-requested Cloudflare Web Analytics disclosure update is version `b50a7a18-2e85-4406-bd40-77f27c4b3da3`. No Google project/client/credentials, DNS, database, OAuth publication or brand submission was changed by the agent.

## Current state and exact remaining order

**Latest owner update, 2026-10-24:** the owner reports production Google setup complete and supplied a private production credential-file location. The agent has not validated/installed that file or inspected the console's actual branding verification/publication and audience state. The setup/submission instructions below remain reference; they are not evidence that the owner has not performed those actions. Record actual status before rollout rather than recreating the project or assuming Google approval from a downloaded client file. The current live callback still needs the separately approved account backend. The owner-requested [v1 release plan](../planning/V1_RELEASE_PLAN.md) tracks that rollout and its operating gates; its preparation authorizes no production changes.

1. **Published:** `https://morphi.one/` and `https://morphi.one/privacy` are live on the existing Cloudflare Worker. The disclosure identifies intentional Cloudflare Web Analytics injected by automatic setup; it remains absent from the uploaded files by design. See `PUBLIC_PRIVACY_RELEASE.md` and the newest phase report for final live evidence.
2. **Domain ownership already done:** the owner explicitly confirms Search Console/domain ownership is verified. Do not repeat DNS verification or change records. When configuring the production project, use the Google account/project ownership association required by Google; this task did not independently inspect the Google console. No GA4 installation is needed.
3. **Production project/client:** use a separate production project from localhost development; set Morphi branding, support/developer contacts, public URLs and authorized domain `morphi.one`; External audience; exactly `openid`, `email`, `profile`; Web application client with callback `https://morphi.one/api/auth/callback/google`. Keep the secret private. No production project/client/credential was created or changed in this task.
4. **Waiting for authorized submission:** once public URLs/domain checks pass, request the applicable brand verification through the production Branding page. Follow actual console requirements; approval and timing are not guaranteed. This task did not submit anything, so it is not yet waiting for a Google review response.
5. **Separate publishing/rollout decisions:** publish verified branding and set the OAuth audience/publication state only at the owner-approved time. The prepared guest build intentionally has no working production callback or account endpoints. If Google requires a working production-flow demonstration, arrange a separately approved controlled backend rollout; do not enable public accounts or invent a successful review to bypass this dependency.
6. **Before public accounts/v1:** resolve the operational/account-eligibility gates in `PRIVACY_REQUESTS.md`, remaining Step 6 production resource evidence (local functional review is owner-accepted), secure production operator access, D1/secrets/maintenance/restore configuration and controlled real OAuth tests. Brand verification alone does not complete these.

Search Console, Google Cloud project state, ownership tokens and verification status cannot be inspected through the currently connected tools. Domain ownership is owner-confirmed; Google project/client setup and submission remain owner-run, with the latest owner report above superseding earlier future-tense setup notes. Do not ask for passwords or client secrets in chat. The detailed fields and sequence below remain reference for checking the production setup.

## 1. Prepare the public information

Before submitting, publish the owner-reviewed home page and privacy policy on `morphi.one`. The home page describes Morphi and links visibly to the privacy policy. Google requires a public home page on a verified domain; a local preview is insufficient for verification.

The owner approved the general-audience wording. Local readiness now includes the verified retention inventory (`PRIVACY_RETENTION.md`), monitored contact and manual request process (`PRIVACY_REQUESTS.md`), and protected local maintenance/privacy deletion. The public copy has no draft notes and uses an updated date of 2026-10-24. Provider log/backup limits are disclosed without arbitrary expiry promises. See `PRIVACY_REVIEW.md` for completed items versus future public-account operations.

The exact guest-only home/privacy publication candidate is prepared through `prepare:public-privacy`, checked through `test:public-privacy`, and packaged by `wrangler.public-privacy.jsonc`. Publication and the analytics disclosure update are complete under their recorded owner instructions. Follow `PUBLIC_PRIVACY_RELEASE.md` for the evidence and require fresh authorization for any later deployment; never deploy the normal localhost accounts configuration as a policy update. Terms remain optional for Google's homepage requirement and a separately scoped v1 page.

Production URLs for the owner’s Google project:

| Field                          | Production value                                               |
| ------------------------------ | -------------------------------------------------------------- |
| App name                       | Morphi                                                         |
| Home                           | `https://morphi.one/`                                          |
| Privacy policy                 | `https://morphi.one/privacy` (published)                       |
| Terms                          | `https://morphi.one/terms` if included in the approved release |
| Authorized domain              | `morphi.one`                                                   |
| Authorized callback            | `https://morphi.one/api/auth/callback/google`                  |
| Support and developer contacts | cngohar@gmail.com (owner confirmed monitoring)                 |

## 2. Domain ownership — owner-confirmed complete

The owner confirms this step is already done. The following reference applies only if a future project/account change requires checking association; no new verification token or DNS edit is requested now.

Using a Google account that is an Owner or Editor of the production OAuth project, verify `morphi.one` in Google Search Console. A Domain property normally uses the DNS record provided by Google. If ownership is already verified, check the account/project association before adding anything. DNS changes still require owner approval. Search Console verification does not require installing GA4.

Do not use the shared `workers.dev` domain as the public brand domain. It serves the same Worker as the custom domain and is not a staging environment.

## 3. Configure a separate production project

After authorization, open [Google Cloud Console](https://console.cloud.google.com/) and select/create a dedicated production project. Keep the current localhost project for development. Google requires separate testing and production projects in its production policy.

In **Google Auth Platform**:

1. **Branding:** set Morphi's name, owner-approved logo if desired, support email, home/privacy links, authorized domain, and developer contacts. Keep these accurate and consistent with the public pages.
2. **Audience:** use **External** for public Google-account access. Publishing the app is a separate action from verifying/publishing its branding. Do not publish until the owner authorizes the release sequence.
3. **Data Access:** declare only `openid`, `email`, and `profile`. These are basic identity/non-sensitive sign-in scopes. Gmail, Drive, Calendar, contacts, and offline access are unnecessary.
4. **Clients:** create a **Web application** client. Add the exact HTTPS callback from the table. Keep localhost/LAN/test callbacks out of the production client.
5. Morphi uses a server redirect flow, not Google's browser widget. No JavaScript origin is needed for this flow; if the console requires an origin for a chosen integration, use only the intended production origin and verify the integration first.
6. Save the client secret privately when created. Do not send it in chat or add it to source control.

## 4. Submit and publish the brand

Once all linked public pages are live and the owner authorizes submission:

1. Open the production project's **Branding** page and review the draft information.
2. Select **Verify Branding**. Address any detected domain, page, or identity mismatches. If automatic verification cannot complete, follow the console's manual-review instructions.
3. When verification succeeds and the brand is **Ready to publish**, select **Publish branding** at the owner-approved time. Current Google documentation says the successful result is valid for seven days before re-verification is needed.
4. In **Audience**, check that the app's publication state is appropriate for the approved public rollout. Publishing branding and changing the app's audience/publication state are separate operations; verify both.
5. Confirm Data Access/Verification Center reports no unexpected sensitive or restricted scopes. Basic identity sign-in does not need a sensitive/restricted-data review; production branding still needs its applicable verification.

Do not promise a fixed approval date. Follow the current console if Google's labels or review flow change. Branding edits can require another verification/publication cycle.

## 5. Prepare Morphi's production configuration

This is an owner-approved operations step, not something completed by the guide:

- Provision the intended production D1 database and apply reviewed migrations to it; local database IDs and fixtures are not production resources.
- Set `BETTER_AUTH_URL=https://morphi.one`.
- Stage a separate production `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` as Worker secrets using the current version-staging workflow. Preserve the local values for local development.
- Review the existing hostname behavior. Authentication uses the canonical custom domain. The `workers.dev` hostname is not an independently isolated release.
- Review secure session cookies, exact trusted origins, database bindings, rollback compatibility, and deletion behavior.
- Request the required deployment approval only after the local release and concrete production configuration are reviewable. Secret-management commands can deploy immediately; check the current Wrangler workflow before running them.

## 6. Check the real public flow

During the owner-approved controlled rollout, before announcing accounts:

- Sign in using a regular Google account that is not a project owner or tester. Check displayed branding, requested scopes, and callback hostname.
- Cancel sign-in and confirm immediate guest play remains available.
- Choose/edit the public name, sign out, and sign back in.
- Verify a completed result on a second device and confirm another account cannot access it.
- Complete a ranked round, check its server score and leaderboard group, then test deletion and removal of its entries.
- Check a real phone, session expiry/re-authentication, reconnect, and a failed save retry.

Record the project/client identifiers (never secrets), verification/publication state, deployment version, and smoke-test evidence in the release report.

## Official references

Rechecked 2026-10-24:

- [Google production policy and home-page requirements](https://developers.google.com/identity/verification/authentication-policy-compliance)
- [Google brand verification and publishing](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- [Google authentication brand verification](https://developers.google.com/identity/verification/authentication-verification)
- [Google OAuth app states and basic identity scope exceptions](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Google web-server OAuth client setup](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)
- [Search Console ownership verification](https://support.google.com/webmasters/answer/9008080)
- [Better Auth Google provider](https://better-auth.com/docs/authentication/google)
