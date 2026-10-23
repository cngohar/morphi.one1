# LAUNCH_CHECKLIST.md

Things to finish before specific milestones. Agents do not act on this file unless the owner promotes an item into `docs/PLAN.md`. Items about law, tax, and children's privacy are reminders, not legal advice: check the requirements for your own country and your players' countries, and consult a professional where needed.

## Before the first deploy (Phase 2)

- [ ] **Accounts:** a GitHub account or organization and a Cloudflare account, each with two-factor authentication and recovery codes stored safely
- [ ] **Repository:** push the code, protect the main branch, and confirm the CI workflow runs on a real pull request
- [ ] **Domain:** morphi.one added to Cloudflare, with DNS and HTTPS checked
- [ ] **Domain security:** registrar lock, two-factor authentication on the registrar, DNSSEC if the TLD supports it (check), and expiry alerts
- [ ] **Staging first:** an unlisted, `noindex` preview for the replay test before anything is public
- [ ] **Secrets:** stored as Worker secrets, never committed

## Before accounts go live to testers (Phase 3A)

- [ ] **Username policy:** length, allowed characters, uniqueness, and a profanity filter (leaderboard names are public)
- [ ] **Account deletion:** a way for users to delete their account and personal data; decide whether scores are deleted or anonymized so leaderboards stay consistent
- [ ] **Report and ban path:** at minimum, an admin can hide a score, rename or ban a user (full admin UI comes later)
- [ ] **Draft privacy notice:** what is collected (email, scores, IP for rate limits), why, and how long it is kept
- [ ] **Email setup** (only if sending verification or reset emails): sending domain, SPF, DKIM, DMARC, and a provider chosen
- [ ] **Contact or feedback link** in the menu (not on the game screen)

## Before payments (Phase 4)

- [ ] **Merchant account verification (KYC):** the payment provider may require identity verification, so start it early and keep sandbox and live keys separate
- [ ] **Terms of service** and a clear **refund and dispute policy**
- [ ] **Receipts:** what the buyer receives after a payment
- [ ] **Tax:** how crypto and card payments are reported in your country, and whether sales tax or VAT applies to players elsewhere (consult a professional)
- [ ] **Keys:** test and live keys kept separate, webhook secrets stored as secrets, never committed
- [ ] **Reconciliation:** a way to find payments that were taken but not granted (admin view)

## Before public launch

- [ ] **Analytics and privacy:** the privacy notice describes GA4 (cookies or identifiers, events, retention), consent is handled as local rules require (GA4 loads only after consent where needed), the opt-out toggle works, GA4 event retention is set to 14 months, and Search Console is verified
- [ ] **Name and brand check (Morphi):** a quick web search found several existing puzzle games named "Morph" (including an 8x8 block-placement game on the App Store and an itch.io puzzle game) but did not surface "Morphi" itself. That search is not exhaustive and not legal advice. Do a real trademark search in the countries you care about, check app-store and social handles, and decide whether to register nearby domains
- [ ] **Legal pages:** privacy policy, terms, and consent for cookies or analytics where required
- [ ] **Children:** decide whether the game targets or may attract children, and review the rules that apply
- [ ] **Backups:** D1 Time Travel restores to any minute within the last 30 days on the Workers Paid plan (7 days on Free) and is automatic. For longer retention, schedule an export to R2. Do a restore into a separate test database at least once and time it. An untested backup is a hope, not a plan
- [ ] **Backups and deletion:** a deleted user's data stays in backups until they expire (D1 Time Travel keeps 7 to 30 days depending on plan), so say so in the privacy notice
- [ ] **Load test:** run 100, 500, and 2,000 simulated players against staging, and record request rate, p95 latency, D1 query time, and errors
- [ ] **Runbook:** write `docs/RUNBOOK.md` (where the logs are, how to revoke all sessions, rotate secrets, and disable features with kill switches)
- [ ] **Secrets rotation and deletion after restore:** a rotation plan for signing keys and webhook secrets, and a way to re-apply account deletions after a backup restore
- [ ] **Accessibility pass:** a recorded keyboard and screen-reader pass on every puzzle and on the landing page
- [ ] **Monitoring:** uptime check, error alerts, and a place to see Workers logs
- [ ] **Cost guardrails:** billing or usage alerts on Cloudflare (Workers, D1, Durable Objects are usage-billed), rate limits in place, and an upper bound on abuse cost
- [ ] **Admin security review:** two-factor enforced, roles tested, `/admin` behind extra protection, audit log working, impersonation disabled, and a tested break-glass CLI
- [ ] **Cloudflare plan and billing:** move to Workers Paid before Phase 3 (the Free plan allows only 10 ms CPU per request, which matters for ranked replay), and set billing alerts
- [ ] **Security pass:** secrets audit, dependency audit, security headers (CSP, HSTS), and Turnstile on signup and submit
- [ ] **Licenses:** fonts and any third-party assets (sounds are synthesized; check the font license)
- [ ] **Abuse and takedown contact:** a monitored address for reports
- [ ] **Domain, DNS, and HTTPS** set up and verified
- [ ] **Launch rehearsal:** run the failure drills (section 11.4) against the deployed site
