# Next-phase combined local review

Status: all three local slices and the quick-review changes were accepted by the
owner on 2026-11-01. The owner reported all checks passed after review on their
own local PC and checked mobile layouts with browser responsive emulation without
noting corrections. Browser and device models were not supplied; physical mobile
review was not reported. This closes the local work and supersedes earlier pending
review notes. No deployment or production release is authorized.

## Admin review

Open `/admin/sign-in` using the enrolled Google account and Morphi.One TOTP.
A Google login and an admin session are separate: the admin session expires after
30 minutes or 10 minutes idle; sensitive actions need Google and admin
authentication within 15 minutes. Expired admin grants should now return to
sign-in rather than incorrectly showing a permissions-denied page. True role
or origin violations still fail closed.

- Users opens summary cards. The top player is the account with the most saved
  completions, not a comparison between unlike game scores.
- Use the styled Users tabs or expandable sidebar to open the directory. Check search, status filters and
  pagination. View opens a right-side quick view with basic statistics; click
  the player name for the styled identity header, summary cards, tables and detail tabs. Google name/email must appear only
  in that individual detail view, never directory or preview.
- Check saved statistics, activity, ban and warning history, score visibility,
  rename, timed/permanent ban and unban. Historical unrecorded fields are labelled;
  prospective activity is best effort and unknown exits are not estimated.
- Ordinary delete defaults to a seven-day adjustable restoration window. Restore
  within it; restoration is impossible at the deadline. Physical anonymization
  runs on the next app request or maintenance. Verified privacy-delete and
  self-service deletion remain separate and final. Audit remains independent.
- Audit opens summary cards and recent entries. Open the detailed explorer to
  filter actor/action/target/date, inspect before/after, export a yearly archive
  in pages, and undo eligible moderation actions. Undo writes another audit;
  unban undo is a new permanent ban with a new reason. Audit cannot be edited or
  deleted through the app/database actions.

## Games review

Open `/admin/games` for the overview. Select a game for its dedicated statistics
and settings views, retained saved-completion stats and existing scoring editor. Default control is Disable. Re-enable restores
selector availability. Soft-deleted games move to the deleted list and can be
restored during their window; after it, confirmed hard deletion permanently
retires availability while keeping historical results, game labels and replay
code. Existing admitted rounds can still finish and save.

Use the scoring rollback picker: restoring a prior value set creates another
version and audit, preserving prior and in-flight results. Invalid live values
resolve to a valid server ancestor/default for new rounds; exact corrupt
historical versions are rejected rather than silently re-scored.

Stats use retained saved account completions. Cross-version/group score averages
are labelled; guest play and historical abandonment/ending breakdown cannot be
invented. Availability controls apply to the local backend-enabled app. The
separate published static guest/privacy release is unchanged and has no backend
for these controls. Already delivered offline/static copies cannot receive an
operator state update.

## Ending review

Finish Memory, Block and Connect. The completed board stays open while its text
enters over 420 ms and holds fully visible for at least 500 ms. The text clears,
the Card folds into the played stack over 500 ms, and the existing result enters
(420 ms; only its large score scrambles for 500 ms). Next keeps the 350 ms exit.
Reduced motion shows text instantly for 500 ms and settles the fold immediately.
Hidden time pauses the hold. Tapping cannot shorten the minimum text hold.

Headlines: Memory “All pairs found!”, Connect “All pairs connected!”, Block
“No moves left!” or the owner-selected placement-cap wording “Board full!”.
Block's placement cap does not itself guarantee every board cell is occupied;
this wording follows the owner's explicit choice. Sublines use real pairs/time,
fill percentage, or score/pieces. Completion is queued before presentation;
storage failure is logged and shown while keeping the result available.

Review at 390×844, 844×390 and 1280×800, then on the owner's own devices. Inspect
preparation failure/retry, early Next, all-disabled recovery, reduced motion and
sign-out/sign-in behavior. The owner accepted this combined review on 2026-11-01 as described above.

## Verification

Final `bun run verify` passed on 2026-11-01: lint/format, zero errors/warnings,
boundaries, 30,000 palettes, 126 unit tests, 37 account integration tests, vectors
in all six runtimes, 32 built-Worker smoke checks, and 174/174 browser checks with
one worker. Full output: `build/combined-review/verify-final.log`. The subsequent owner review and its limits are recorded above.

## Visual comparison

Open `build/combined-review/index.html` locally for 63 matched before/after pairs:
48 admin states/viewports and 15 game-ending/result captures at each stage.
Admin includes 1920×923 plus the three required sizes; games use the three
required sizes. The baseline starts after the first user-detail polish. Test
identities/counts vary between runs. Images remain local ignored artifacts.

The visual inspection retained the existing overview cards and ending design;
refinements remove repeated headings and centered desktop gaps, strengthen the
quick drawer, preserve readable table columns with contained horizontal scroll,
and bring the audit log nearer the top with compact filter/export panels.

Visual findings and retained designs: `docs/reviews/NEXT_PHASE_VISUAL_REVIEW.md`.
