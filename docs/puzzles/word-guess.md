# Word Guess (`word-guess`) — v1.4.6

Owner-selected Revision 5 brief, accepted 2026-11-17. The owner authorized local
implementation of Classic first, then ten Batch A presets, with focused checks.
Stop at that report; no commit, push, deployment, release or Batch B.

Guess a hidden word using count-aware position feedback: exact matches consume
copies first, then present matches from left to right, then surplus copies are
grey. Teal/orange-red/grey tiles and Morphi typography follow the supplied
`static/demo/word-guess.html` visual reference. Production logic is newly authored.

Touch/mouse use a DOM QWERTY keyboard; physical A–Z, Enter and Backspace also work.
The board and keyboard fit the shared centered RoundStage at portrait, landscape
and desktop sizes. Word Guess has no family Stage. Letter tiles supply the backdrop.

Classic: five letters, one board, six guesses, no hints or timer. Wins complete;
budget losses complete with zero points, reveal answers, and receive no daily row.
Invalid or constraint-violating guesses never consume a row. Countdown time-up
retains the failed board, abandons the session, and saves no score.

The accepted single-axis Batch A changes are hard constraints, ultra-hard
constraints, four/six/seven-letter lengths, two/four/eight shared boards,
120-second countdown and three-hint budget. Preset identities stay internal;
player teaching describes only this round. E1 excludes constraints with multi-board.
All eleven presets ship enabled. Board key: `(word-guess, UTC date)`; variant
boards: none; zero per-variant groups. Lists, themes and seeds are never variants.

Morphi curates its own ENABLE-based lists, graded with SCOWL ≤35. Each length has
at least 365 familiar answers; every answer is a legal guess. Names, simple
plurals/past forms and sensitive words are filtered. An integer-only greedy
information-gain solver gates daily issuance at six guesses. Distinct multi-board
answers and a bounded 100-attempt board generator prevent raw fallback issuance.

One immutable, admin-editable `brief-v1` scoring config serves every preset:
100/90/75/60/45/30 on guesses 1–6, then 25/20/15/10/5/5/5 on guesses 7–13.
Multi-board wins sum each board's solve-guess points; any budget loss scores zero.
Hints deduct 100, floored at zero; countdown wins add 10 per second left.
Ranked floor: 2,500 ms of server-measured gameplay; below-floor claims consume
the attempt and save unranked. Hint-solved wins rank by the pinned scoring flag
and show “solved with hint” on results and daily boards, including zero-point wins.

Family motion uses anime.js 4.5 only: row flip 300 ms, key pop 120 ms,
invalid shake/end entrance 300 ms; reduced motion and failures settle immediately.
Reuse generic pick/place/invalid/win/clear cues. No new audio or dependencies.

Evidence and source notices are in the family README and local `build/v1.4.6/`.
Automated checks do not establish physical-device or owner functional acceptance.
Formal trademark review remains a pre-launch action for the working title.
