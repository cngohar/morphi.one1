# Connect local review evidence

Screenshots from the real `/play` Mix flow in headless Chromium:

- [Desktop board, 1920×923](connect-1920x923.png): centred 48×48 generated symbols, Connect-only backdrop.
- [Phone board, 390×844](connect-390x844.png): responsive board without backdrop objects.
- [Phone result after pair-only win](connect-partial-result.png): all eight pairs connected with four cells empty, 92% fill shown, readable save controls and played stack.

`tests/e2e/connect.spec.ts` samples the first rendered arrival frames to check
that cells and dots start hidden, then reveal. It verifies symbol alignment,
the three layouts, the pair-only finish, result and Next, mute and nine dedicated
sound asset requests, and reduced motion. Local full browser output is in the
ignored `build/v1.1-connect/e2e-final.log`. Its only failure was a WebKit Block
backdrop bounds check outside Connect; measuring bounds when the backdrop
becomes visible fixed it. The affected case then passed three WebKit repeats
and one run in each of Chromium, Firefox and WebKit.

Physical-device motion, drag and audio quality remain for owner review.
