# One-line

The `one-line-1` engine uses the shared SplitMix64 generator, the `brief-v1` family scoring definition, and the shared centered stage. Pointer, touch, and keyboard input produce the same numeric move log.

- `classic` covers an undirected figure in one stroke. Lifting resets the drawing.
- `one-way` restricts marked edges to the arrow direction.
- `double-trace` requires a second traversal on the marked edge.
- `closed-loop` starts on an even figure and finishes at the original dot.
- `two-stroke` allows one lift. The second stroke starts on an eligible dot in the remainder.
- `crossings-are-junctions` allows a turn at marked crossings.
- `countdown` saves a completed loss when the two-minute timer expires.
- `no-hint` disables the hint actions.
- `degree-hidden` removes odd rings and degree counts, including in spoken labels.
- `lift-resume` keeps the current stroke across a lift.
- `verdict` asks whether the figure is drawable. A drawable declaration commits to tracing it. An impossible declaration ends the round. This preset is unlimited-only.

A traced edge can only be traversed again when it has a second required strand. Undo rewinds within the current lift boundary. Restart keeps the same figure, elapsed time, and hint use. The last legal edge wins before dead-end evaluation. Earlier dead-end arrivals finish the round as a loss.
