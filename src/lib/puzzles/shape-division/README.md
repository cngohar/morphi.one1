# Shape Division

`shape-division-1` owns the grid, cut routing, exact-cover gate, partition check,
move cap and score. The manifest owns the enabled catalogue and wire validation.
The family View mounts in the shared centered RoundStage. Only Classic is daily.

| Preset                | Rule                                           |
| --------------------- | ---------------------------------------------- |
| Classic               | Four congruent three-square pieces             |
| Two pieces            | Two congruent three-square pieces              |
| Five pieces           | Five congruent three-square pieces             |
| Four-square pieces    | Four congruent four-square pieces              |
| Equal area            | Four equal-area pieces of any shape            |
| One tree              | Four congruent pieces with one tree per piece  |
| Given shape           | Four congruent pieces matching the given shape |
| Five-minute countdown | Classic division within 300 gameplay seconds   |
| No hint               | Classic with hints disabled                    |
| Equality score        | Four pieces, with score scaled by equality     |

Each logged move contains `action`, `first` and `second`. Cut endpoints are
row-major vertices. Non-cut moves use zero endpoints. Action values 0–6 are cut,
remove, Check, Hint, Undo, timeout and Restart.

See the [family design](../../../../docs/puzzles/shape-division.md) for settings,
timing and generation. Its vector filter is `--shape-division`.
