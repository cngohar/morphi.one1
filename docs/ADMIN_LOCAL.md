# Local Step 6 moderation

This command operates only on the local D1 database. It does not expose an admin HTTP route, provision a remote resource, or authorize a public admin panel. It requires the project owner's local OS access, a database-assigned role, and a fresh TOTP code on every operational command. Keep the OS login protected; production authentication and recovery must be designed during global-release planning.

After local migrations, the owner can explicitly enroll the first local administrator:

```sh
bun run admin:local -- --local bootstrap
```

Privately open the newly created ignored `.admin-local.json` and enroll its `authenticatorURI` in an authenticator. The file contains a secret, has mode 600, and must never be committed or shared. Bootstrap refuses an existing admin or key file. No administrator is automatically enrolled by development, tests, or this implementation task.

Run commands from an interactive terminal. They prompt for a current authenticator code; never pass codes or secrets as command arguments.

```sh
bun run admin:local -- --local list-hidden
bun run admin:local -- --local hide ROUND_UUID "Reason for review"
bun run admin:local -- --local restore ROUND_UUID "Review completed"
bun run admin:local -- --local ban PUBLIC_PLAYER_NAME "Reason for ban"
bun run admin:local -- --local unban PUBLIC_PLAYER_NAME "Review completed"
bun run admin:local -- --local ranked-off ranked "Investigating validation errors"
bun run admin:local -- --local ranked-on ranked "Validation checks passed"
bun run admin:local -- --local prune-expired
bun run admin:local -- --local privacy-delete INTERNAL_USER_ID CASE_REFERENCE
```

Admin can perform all listed actions. Moderators can hide/restore scores and ban/unban players, and support can read hidden-score records. Only admin can toggle ranked mode. Role assignment is stored in D1; there is no public role-assignment endpoint or role editor. Mutations and their before/after audit record commit in one database batch. Listing hidden scores is also audited. A reason of 3–240 characters is required for mutations.

Privacy readiness adds two admin-only operations, still local/interactive/TOTP-protected: `prune-expired` performs the precise maintenance in `PRIVACY_RETENTION.md`, and `privacy-delete` removes a verified request's active user and owned data with an independent minimal audit. The latter requires an internal user id and an opaque case reference (3–64 letters/digits/underscores/hyphens); never pass an email, child's age, identity evidence or message as the reference. Follow `PRIVACY_REQUESTS.md` first. Cleanup has no schedule or automatic maximum-deletion promise. Neither operation is run on the owner's real data by tests or task setup.

Hiding a score removes it from the board; a player's next-best eligible score can take its place. Bans remove the player's entries and refuse new submissions/starts. Identical retries of a previously committed submission still return its stored acknowledgment. Turning ranked off prevents new ranked starts/claims; a previously claimed submission can finish safely. Guest/local play continues.

No raw SQL, remote flag, arbitrary actor parameter, impersonation, personal Google-profile listing, or general configuration editor is exposed. Account holders retain fresh authenticated self-service deletion; the narrowly scoped privacy-delete command supports verified local operator cases. The local key/OS enrollment is not a production admin-authentication design.

The long plan's section 11.10 begins with this Stage 0 command tool. During the later global-release planning, the owner can choose a small Stage 1 web panel: protected admin login and 2FA, per-action role checks, audit viewer, ranked kill switch, and score/player moderation. Broader dashboards, content management, payments, and theme administration need their own scope.

## v1 local web operator

After the existing OS-owner bootstrap, `bun run admin:local -- --local enroll-web
<google-user-id>` verifies the local OS identity and its authenticator, checks
the verified owner email `cngohar@gmail.com`, and enrolls that Google user only.
No enrollment was performed by the integration task. Privately read the mode-600
ignored `.admin-web-enrollment.json`, add the authenticator URI, and store the
eight single-use recovery codes offline. Never share these artifacts.

Visit `/admin/sign-in`, complete Google re-authentication and TOTP. The panel
includes aggregates, ranked status, exact public-name/round lookup, moderation,
case references, read-only audit and verified-request export/deletion. Reasons
contain only a short operational explanation or opaque case reference. Never
paste private requests, emails, tokens or children's information. Export is
bounded to 100 completed rounds per page; continue with `nextOffset` until null.
The operator must verify requester identity/authority outside this panel.

For lost authenticators/recovery codes, the existing OS/TOTP gate protects
`bun run admin:local -- --local reset-web <google-user-id>`. This revokes current
web grants/recovery codes, rotates the authenticator material and writes the
ignored mode-600 `.admin-web-reset.json`. Store the new material privately.
Neither command has a remote mode. Production enrollment/recovery is still a
separate owner-controlled release rehearsal. No web role editing, impersonation
or audit deletion is available. Operator accounts cannot use ordinary account
deletion; the last web admin cannot be demoted/deleted.
