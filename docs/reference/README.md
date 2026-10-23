# reference

`theme_demo.py` is a throwaway Python prototype of the recipe-based theme generator (OKLCH recipes, contrast and color-blind checks, symbol and backdrop generators). It shows the approach and pass rates, not production code. The real generator is TypeScript and must reproduce the checks in `docs/PLAN.md` sections 11.1a and 11.2.

Prototype results (2,000 seeds, up to 8 tries): about 41 percent pass on the first try, about 2.5 tries on average, and about 1.5 percent fall back to a preset. Known gaps in this prototype (checked October 19, 2026): when all 8 tries fail, `make()` returns the last failing candidate flagged `fallback`; it does not return a verified preset, and the real generator must not copy that path (plan section 11.2). The Machado matrices match a published implementation at severity 1.0. The key finding: color-blind separation is mostly a lightness problem, so spread the symbol colors across contrast targets of roughly 3.3, 5.5, and 9 against white.

Cross-check note (October 19, 2026): the prototype's fallback path returns the last failing candidate. The real generator must use a verified preset instead (plan section 11.2).
