# Combined visual review — 2026-11-01

Local screenshot review requested by the owner. All three slices and quick-review
changes were accepted locally on 2026-11-01 after the owner reviewed them on their
own PC and checked mobile layouts in browser responsive emulation without noting
corrections. Models were not supplied; physical mobile review was not reported.
This supersedes earlier pending-review notes. No deployment is authorized.

Open `build/combined-review/index.html` locally. It compares 63 matched pairs:
48 admin captures (12 states × four viewports) and 15 game captures (five states ×
three viewports), with 63 images in each of `before/` and `after/`. Captures use
390×844, 844×390, 1280×800 and, for admin, the owner's 1920×923 desktop size.
Fixture identities, dates, seeds and counts can differ between runs; compare
layout and behavior rather than those values. The baseline includes the first
user-detail styling already completed before the owner requested captures.
There is no fabricated pre-polish screenshot.

| Newly implemented view           | Screenshot finding                                                                                                       | Final treatment                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Shared admin header/sidebar      | Repeated Workspace/title/description and centered width cap wasted space; long sidebar exceeded short landscape viewport | Title moved to compact header; duplicate block removed; full available width; sidebar scrolls independently                      |
| Users overview                   | Summary cards and top-completion player were readable                                                                    | Kept cards and meaningful population labels; applied shared spacing fix                                                          |
| User directory                   | Phone table squeezed identifiers into very narrow columns                                                                | Preserved readable column widths with contained horizontal scrolling and clear table headings                                    |
| User quick view                  | Plain paragraphs lacked hierarchy                                                                                        | Added identity/status header, completion tile, definition fields and prominent full-detail action; no Google identity in preview |
| User detail statistics           | Identity/cards/tabs provided clear hierarchy after initial polish                                                        | Retained structure; removed surrounding wasted space; kept readable scrolling tables                                             |
| User detail activity             | Dates/counts and moderation table grouped clearly                                                                        | Kept layout and honest empty/not-recorded states                                                                                 |
| User detail saved rounds         | Collapsible visibility controls were clear on phone                                                                      | Kept controls and wrapping identifiers                                                                                           |
| User detail actions              | Action cards separated ban, rename and delete                                                                            | Kept grouped forms and responsive stacking; permissions/reasons unchanged                                                        |
| Audit overview                   | Metric cards/latest rows were clear                                                                                      | Retained cards; applied header/table improvements                                                                                |
| Audit explorer/export            | Tall stacked full-width forms pushed logs far down                                                                       | Compact responsive filter/export panels; required reasons and confirmation preserved                                             |
| Games overview                   | Linked family cards had a clear next action                                                                              | Retained cards and styled family navigation                                                                                      |
| Individual game statistics       | Dense history needs version/group context and readable columns                                                           | Retained labelled grouped statistics and contained table scroll                                                                  |
| Individual game settings/scoring | Availability and scoring sections had a clear hierarchy                                                                  | Kept existing per-game controls and rollback picker                                                                              |
| Memory, Block, Connect endings   | Headlines/subline read clearly over the completed board                                                                  | Kept presentation; verified pre-fold order and settled hold                                                                      |
| Memory/Block result states       | Existing score, statistics and Next remained clear                                                                       | Preserved accepted result design and animation                                                                                   |

The capture tests wait for the actual target screen to render. Earlier stale
settings/explorer captures were replaced with correctly synchronized captures.
A transient local D1 SQLite lock interrupted one attempt; the subsequent isolated
capture passed. The final admin capture passed all five operator specs. Final
full verification passed all 174 browser checks with one worker, plus the other
required stages; see `docs/PHASE_REPORTS.md` and
`build/combined-review/verify-final.log`.

Independent audit retention, best-effort activity limits and the unchanged static
public guest release are explained in `docs/reviews/NEXT_PHASE_REVIEW.md`.
