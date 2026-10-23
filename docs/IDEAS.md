# IDEAS.md

Inbox for things the owner remembers mid-project. Agents do **not** read or act on this file unless the owner promotes an item into `docs/PLAN.md`.

## How it works

1. When you remember something, add one line below with the date. Do not edit the plan right away.
2. At each phase boundary, triage every new item:
   - **Blocks the current or next phase** -> promote into `docs/PLAN.md`.
   - **Needed before launch** -> add to `docs/LAUNCH_CHECKLIST.md`.
   - **Everything else** -> move to the parked list in `docs/PLAN.md` (section 7).
3. Delete items from this inbox once triaged.

## Inbox

- YYYY-MM-DD: (example) idea or forgotten thing
- 2026-10-14: Theme feedback: a tiny optional "report this look" action in the menu that sends the theme features, as a direct signal alongside the replay metrics (decide at the Phase 3 review)
- 2026-10-14: Retry the same puzzle after a failed round. Recommended rule: solo play offers **Try again** (same seed and same look) next to **Next puzzle** (new seed) on failure. The run records `attempt: 2`, retries do not update personal bests (or are tracked separately), and ranked or daily play does not allow free retries, because replaying a Memory layout lets players memorize it. Measure Try again versus Next in analytics. This does not break randomness, because Next is still random. Decide at the Phase 1B gate.
- 2026-10-14: Random microcopy: a small bank of variants for taglines, hints, and result messages (picked at random, kept stable within a round, and stored in the message catalog). Keep the Play button label and other primary actions constant for clarity, accessibility, and tests.
- 2026-10-17: Side column content per puzzle: decide what goes in the left and right columns on each puzzle page (candidates: how to play, tips, personal best, session stats, other puzzles). The slots are defined in section 11.16; the content is the owner's call.
- 2026-10-18: Cross-device resume of an active round (start on a phone, continue on a desktop). Needs an account-backed checkpoint with frequent writes; parked until the owner decides it is worth the cost (plan section 11.13 scope note).
- 2026-10-19: Home Play button look varies per visitor (owner's choice, option 2 of the randomness discussion). Candidate for the Phase 2 landing-page test; not part of the 1A build. Constraints: (1) variants change only the button's shape, proportion, motion style, or accent, using approved tokens (section 11.1a), and pass the anti-slop checklist (no glow, no shadow); the label, the h1, the title, the meta description, and the links never change; (2) assignment is sticky per visitor, derived from the anonymous id (server-set cookie, section 11.6) with a fixed variant list and a version constant, so any report can be reproduced; (3) `/` is prerendered, so a variant cannot be chosen per request without a Worker invocation: apply it with a tiny inline pre-paint script (CSP hash, section 9.1) that reads the cookie, and check for flash and layout shift (CLS). The first visit has no cookie yet and shows the default, which biases the first-visit numbers; account for that in analysis; (4) log `home_variant` in the event envelope and bucket through config (section 11.6); (5) each variant is reviewed by screenshot, not a new wireframe (section 11.1).
