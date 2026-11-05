# Privacy and children's-information requests

Local operating procedure prepared 2026-10-24. Responsible operator: **Ali Gohar**; public contact: **cngohar@gmail.com**. The owner supplied this contact and explicitly confirmed that he will monitor it and handle requests. Mailbox delivery/access was not independently tested; no email was sent. The public general-audience direction and guest access remain unchanged.

## Intake and verification

1. Check the mailbox regularly and prioritize credible reports about children's information or exposed data. Assign an opaque case reference. Record receipt, request type, applicable response deadline, responsible person and outcome in private operator notes. Use the shortest applicable legal deadline; seek advice promptly where the jurisdiction or authority is unclear. No universal deadline or automatic mailbox deletion is represented as implemented.
2. Acknowledge the request without confirming whether an email/player has an account. Ask only for the information reasonably needed to locate the data and establish the requester's identity/authority. Prefer the existing signed-in account and its fresh deletion flow when suitable. Never ask for passwords, Google codes or tokens; do not request identity documents by default or store a child's DOB merely to process a concern.
3. For a parent/guardian report, establish the account/data concerned and reasonable authority before disclosing information or acting on an unverified third-party deletion request. Treat a credible report of under-13 personal-data collection as requiring prompt review, not something a generic policy disclaimer resolves. Minimize correspondence, avoid collecting more information from the child, and use legal advice where evidence, custody or applicable rules conflict.

## Investigate and act

- Determine which release actually handled the data. The inspected public guest Worker has no account database or auth endpoints; it still uses Cloudflare and can keep local browser data. Do not invent a server account to delete, promise to find anonymous visitors by name, or tell the requester guest access creates no processing.
- Establish whether the request concerns active account rows, public names/results, unlinked OAuth/rate-limit records, operator mail, audit evidence, device-local copies, or a provider's records. Use `PRIVACY_RETENTION.md`; search only authorized, relevant records and do not disclose another player's identity. Reports of children's information do not automatically prove that a particular account belongs to the child.
- Ordinary account holders can use the authenticated, freshly signed-in deletion action. For a verified local operator-handled erasure, the existing protected local admin command now supports `privacy-delete INTERNAL_USER_ID CASE_REFERENCE`. A database `admin` role and current TOTP are required; the deletion and minimal audit commit together. It revokes sessions and removes private profile/provider rows, public name, owned rounds/ranked starts, bans, support tickets and every message in those tickets. Other players remain intact. This is **local only**; do not point it at production or bypass its guard.
- Where actual knowledge brings children's-privacy obligations into scope, assess whether the information must be deleted or whether a specific lawful exception applies. Morphi offers no child-account/parental-consent product; do not retain a known child account merely because guest play exists. Stop unnecessary use, remove public exposure where appropriate, and carry out the required action promptly through a reviewed operator path. A ranked ban only blocks ranked activity; it does **not** disable Google login or replace necessary erasure.
- Inspect separate audit/rate-limit/state/provider records as needed. Preserve only what has a documented lawful need; do not promise automatic destruction of every audit, backup or security record. If continued retention is impermissible, arrange the required minimization/deletion/provider assistance rather than marking the request done because user rows are gone. No child-specific exemption or indefinite retention of their information is assumed.
- Access/correction requests may need more than the UI's latest 30 rounds. Verify the full authorized scope, use secure delivery only to the verified requester, and record any legal limitation/refusal and explanation. There is no public data-export endpoint or automated operator email integration. Any production access/export operation needs an authorized secure operator path.

## Verify and close

Confirm active user/provider/session/name/history/start/ban rows support tickets/messages and public ranking entries are gone when erasure is the outcome. Explain what was changed, any justified limits and provider/local-device steps. Google disconnection is separate from Morphi deletion. Remote browser storage cannot be wiped by server deletion; explain how to clear it without asking the parent to send its contents.

Keep only the minimum case/outcome evidence for the remaining purpose; review and delete/minimize correspondence and unnecessary attachments after resolution, subject to documented legal/security needs. If the operator takes a backup or restores a database, maintain the necessary restricted erasure record and reapply erasures before restored data becomes available. Do not log request messages, ages, documents or tokens in application events or admin audit reasons.

## Operational gates

- **Confirmed:** operator/contact, personal mailbox monitoring, general-audience intent, no separate kids product, no child-focused design/marketing, and no age gate or verification system authorized by this task.
- **Implemented and tested locally:** self-service deletion, admin/TOTP-protected operator deletion, session/game-data cascades, minimal audit, and retention maintenance. No real personal account was deleted as a test.
- **Before public accounts:** decide the launch account-eligibility statement for relevant jurisdictions and review the actual neutral game design/marketing; provision a secure production operator and request-access/export/deletion path, maintenance cadence and audit review rules. Basic Google scopes do not report DOB or prove the player's age. There is no automated child eligibility block, and the policy does not claim one.
- **Guest-policy publication:** this procedure, the monitored contact, truthful provider limits and unavailable public account endpoints support a guest-only publication candidate. Account eligibility/production operations remain separate v1 gates, not a reason to add a guest age screen or reopen approved general-audience wording.

## Primary guidance

[FTC COPPA FAQs, especially general-audience services and actual knowledge](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [Google OpenID Connect claims](https://developers.google.com/identity/openid-connect/openid-connect), and [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) were reviewed as inputs. This procedure is not a determination of Morphi's legal status in every launch jurisdiction; unresolved jurisdiction/eligibility issues are recorded explicitly above. Follow the applicable current requirements when an actual request arrives.

## Member Support request handling — local v1.3.3

Members may contact staff through account Support, including while banned. It is
not a public export endpoint or an automatic identity-verification/deletion flow.
Use the existing verification and fresh-auth deletion procedures above for
privacy requests; do not ask for passwords or copy conversation content into an
audit reason. Account deletion removes every message in owned tickets, including
staff replies. Closing a ticket preserves it until account deletion. Pending
deletion retains data through the existing restoration window, then lifecycle
purge removes it; support access is denied during that window. Drafts are held
only in the current page memory and are lost when leaving or closing it.
