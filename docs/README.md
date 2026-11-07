# Documentation

Supporting documents are grouped by purpose. Core plan, decisions, edge cases, phase reports, and code map retain their established paths.

Files under `references/` are reference material, not authorization to implement their contents. The Mahjong Solitaire variant report is locally authored web research; the other imported originals remain preserved. The imported briefs are preserved unchanged; maintained project copies live under `briefs/`. The two engine-refactor versions differ and have not been merged.

## Core guidance

- [CODEMAP](CODEMAP.md)
- [DECISIONS](DECISIONS.md)
- [EDGE_CASES](EDGE_CASES.md)
- [PHASE_REPORTS](PHASE_REPORTS.md)
- [PLAN](PLAN.md)

## Planning

- [V1.3.5 Memory roadmap and AI handoff](planning/V1.3.5_ROADMAP.md) — draft;
  shared entry point for Gemini, Codex and other coding agents. One selected
  milestone at a time; Memory-only cap of 100 total. Completed .1 is accepted
  locally on 2026-11-07 with this source-only GitHub handoff authorized; later
  milestones remain unselected.
- [V1.3.5 browser preview](planning/v1.3.5-preview.html) — human summary;
  the editable roadmap holds the execution instructions.
- [IDEAS](planning/IDEAS.md)
- [LAUNCH_CHECKLIST](planning/LAUNCH_CHECKLIST.md)
- [PROTOTYPE_NOTES](planning/PROTOTYPE_NOTES.md)
- [STEP6](planning/STEP6.md)
- [V1_RELEASE_CHECKLIST](planning/V1_RELEASE_CHECKLIST.md)
- [V1_RELEASE_PLAN](planning/V1_RELEASE_PLAN.md)

## Implementation briefs

- [v1.3.5.1-games-extraction-brief](briefs/v1.3.5.1-games-extraction-brief.md) — brief and completed local extraction accepted; source-only GitHub handoff authorized 2026-11-07.
- [morphi-engine-refactor-brief](briefs/morphi-engine-refactor-brief.md)
- [morphi-v1.3-memory-variants-codex-brief](briefs/morphi-v1.3-memory-variants-codex-brief.md)
- [morphi-v1.3.1-codex-brief](briefs/morphi-v1.3.1-codex-brief.md)
- [morphi-v1.3.2-codex-brief](briefs/morphi-v1.3.2-codex-brief.md) — accepted locally on 2026-11-05; verification evidence unconfirmed.

## Work records

- [V1.3.5.1_WORK](work/V1.3.5.1_WORK.md) — accepted local Games extraction; retained focused evidence and source-only handoff boundary.
- [V1.3.4_SLICE0_WORK](work/V1.3.4_SLICE0_WORK.md) — admin/query only; Mahjong excluded and deferred to later plans.

- [STEP6_WORK](work/STEP6_WORK.md)
- [V1.1_WORK](work/V1.1_WORK.md)
- [V1.3.1_WORK](work/V1.3.1_WORK.md)
- [V1.3_WORK](work/V1.3_WORK.md)
- [V1_WORK](work/V1_WORK.md)

## Reviews and measurements

- [NEXT_PHASE_ASSESSMENT](reviews/NEXT_PHASE_ASSESSMENT.md)
- [NEXT_PHASE_REVIEW](reviews/NEXT_PHASE_REVIEW.md)
- [NEXT_PHASE_VISUAL_REVIEW](reviews/NEXT_PHASE_VISUAL_REVIEW.md)
- [SLICE5_CSS_AUDIT](reviews/SLICE5_CSS_AUDIT.md)
- [SLICE7_CONTRACT_AUDIT](reviews/SLICE7_CONTRACT_AUDIT.md)
- [STEP6_MEASUREMENTS](reviews/STEP6_MEASUREMENTS.md)
- [STEP6_REVIEW](reviews/STEP6_REVIEW.md)

## Local operations and setup

- [ADMIN_LOCAL](operations/ADMIN_LOCAL.md)
- [CLOUDFLARE_AGENT_SETUP](operations/CLOUDFLARE_AGENT_SETUP.md)
- [GOOGLE_AUTH_SETUP](operations/GOOGLE_AUTH_SETUP.md)
- [GOOGLE_OAUTH_PUBLIC](operations/GOOGLE_OAUTH_PUBLIC.md)
- [REPLAY_TEST](operations/REPLAY_TEST.md)

## Privacy

- [PRIVACY_REQUESTS](privacy/PRIVACY_REQUESTS.md)
- [PRIVACY_RETENTION](privacy/PRIVACY_RETENTION.md)
- [PRIVACY_REVIEW](privacy/PRIVACY_REVIEW.md)
- [PUBLIC_PRIVACY_RELEASE](privacy/PUBLIC_PRIVACY_RELEASE.md)

## Imported source documents

- [Mahjong Solitaire — How It Is Played](<references/game-guides/Mahjong Solitaire — How It Is Played.html>)
- [morphi-engine-refactor-brief](references/imported-briefs/morphi-engine-refactor-brief.md)
- [morphi-v1.3.1-codex-brief](references/imported-briefs/morphi-v1.3.1-codex-brief.md)
- [Block Puzzle Variants](<references/puzzle-variants/Block Puzzle Variants.html>)
- [Connect Puzzle Variants](<references/puzzle-variants/Connect Puzzle Variants.html>)
- [Memory Puzzle Variants](<references/puzzle-variants/Memory Puzzle Variants.html>)
- [Mahjong Solitaire Variants](<references/puzzle-variants/Mahjong Solitaire Variants.html>) — locally authored research: 28 examples, 18 dimensions, 21 sources and interactive exploration.
- [Full Road Map(2)](<references/roadmaps/Full Road Map(2).html>)

## Existing design and evidence collections

- [v1.3.4 Mahjong Solitaire proposal](planning/V1.3.4_MAHJONG.md) and [draft puzzle brief](puzzles/mahjong-solitaire.md); awaiting owner decisions. [Visual layout draft](../static/demo/v1.3.4-mahjong.html) shows the three conceptual boards; geometry is for review, not validated game data. Captured desktop views and a phone view are in [evidence/v1.3.4/](evidence/v1.3.4/).

- [Puzzle briefs](puzzles/)
- [Verification and visual evidence](evidence/)
- [v1.1 design handoff](morphi-v1.1-handoff-2026-10-26/)
- [v1 design package](morphi-design-package-2026-10-25/)

Member Support v1.3.3: [approved local plan](planning/V1.3.3_MEMBER_SUPPORT.md). The owner corrected the earlier v1.3.4 numbering; v1.3.2 is the accepted baseline.

Member Support [local handoff](work/V1.3.3_WORK.md) and [targeted verification](evidence/v1.3.3/verification.json): full `bun run verify` is explicitly deferred by the owner to later stages; the owner confirmed local review and acceptance on 2026-11-05, with remaining improvements deferred to later stages.
