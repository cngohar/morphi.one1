# Slice 5 legacy CSS audit

Audited `src/lib/ui/v1.css`, `card-shell.css`, `game-shell.css`, and
`account.css` in full. The shell/layout remains in place.

| File             |                    Cosmetic declarations connected to editable tokens | Result                                                                                                  |
| ---------------- | --------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------- |
| `v1.css`         | 110 radius, border-width and spacing declarations, plus modal overlay | Uses shared site token values; removed 16 wrapper color overrides that previously shadowed root tokens. |
| `card-shell.css` |                      37 radius, border-width and spacing declarations | Card frame, stack and result spacing retain their responsive structure.                                 |
| `game-shell.css` |                      27 radius, border-width and spacing declarations | Board fitting, safe-area bands and viewport calculations stay in code.                                  |
| `account.css`    |                      29 radius, border-width and spacing declarations | Account controls, cards, dialogs and responsive spacing consume the same site token set.                |

`src/lib/engine/theme/site-tokens.json` records 94 approved-default token
values. Existing root color names are retained. Radius, line width, and spacing
scales use stable names (`--radius-*`, `--line-*`, `--space-*`). Frame/background
and HUD blend percentages and decorative/disabled opacity are tokens as well. Circle/squircle radii and the
hexagon clip polygon are editable token values, resolved into each generated
theme snapshot so in-flight ranked themes keep their recorded shapes. The runtime loader applies a
validated live config to the root; unavailable config keeps the last valid
snapshot, with code defaults for the first load. CSS fallbacks retain the
accepted appearance before loading and in the separate assets-only guest build.

The accepted public wrapper colors now reside in the root defaults in
`src/app.css`, so a wrapper no longer overrides an administrator's root values.
Per-round generated palette, shape, aspect and gap variables remain supplied by
the resolved theme adapter, rather than competing with static shell values.
No gradients, glows or game-object shadows were added.

Retained structural declarations: flex/grid topology, positioned chrome,
viewport/container calculations, responsive breakpoints, safe-area insets,
padding/margins that reserve screen regions, board-size calculations, Card
measurement and motion geometry, and `0`/`inherit` resets. Board gap clamps stay
as responsive fit constraints around the editable theme gap. Existing color
references and `currentColor` remain token references; transparent fills remain
structural. Shape meaning and game input/hit targets remain game-owned.

Validation rejects unknown keys, declaration/URL injection, wrong units,
unbounded lengths, and unsafe line widths. Site text contrast is checked
separately from generated puzzle palettes. Focused checks live in
`site-tokens.test.ts`; Worker failure and config snapshot tests live in
`solo-theme.test.ts`; family/version history tests live in
`theme-history.test.ts`. Final verification is coordinated by the parent after
source stabilization; this audit records implementation review, not a browser
or device acceptance.
