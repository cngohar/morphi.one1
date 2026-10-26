# Step 6 owner review — local devices

Owner completed this review and explicitly accepted the local functional build on **2026-10-24**. All table outcomes below were supplied by the owner for PC and mobile; they are owner-reported evidence, not browser-emulation results. Specific device models, browsers and the mobile OAuth connection method were not recorded and are not inferred.

## Run locally

Start `bun run dev --host 0.0.0.0` and open the machine's local-network URL on a phone. Google rejects ordinary HTTP LAN callback origins: use guest gameplay on the LAN, and perform the real Google account test on an allowed localhost origin (for example a deliberate USB/ADB reverse-port connection on an Android device, if available) or another approved secure local setup. Do not change production OAuth/DNS, deploy a preview, or claim that signing in on a desktop validates the phone login. If a suitable setup is unavailable, record that limitation.

| Check                                                                                           | Device / browser / date  | Actual outcome                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------ |
| Guest Block then Next to Memory; portrait and landscape                                         | pc + mobile (24-10-2026) | working as expected                              |
| Privacy readable from Home and account sign-in, including small-screen scroll                   | pc + mobile              | working as expected                              |
| Google sign-in/cancel/back; guest remains usable                                                | pc + mobile              | working as expected                              |
| Choose/edit public name; Google name/email absent from public board                             | pc + mobile              | working as expected                              |
| Completed round saved; history/best and ranked score agree with server acknowledgment           | pc + mobile              | working as expected                              |
| Same account on second independent device shows saved completed history                         | pc + mobile              | working as expected                              |
| Network interrupted after completion, pending status retained; reconnect saves one result       | pc + mobile              | working as expected                              |
| Sign-out returns to guest; another account cannot access first account's history                | pc + mobile              | working as expected                              |
| Fresh-confirmed deletion removes profile/saved/ranked entries; local copies elsewhere explained | pc + mobile              | working as expected                              |
| Owner accepts Step 6 or records issues                                                          | pc + mobile              | accepted as everything as expected on 24-10-2026 |

Use test accounts/rounds deliberately; do not delete an account containing wanted history. Review `STEP6_MEASUREMENTS.md` for the unmeasured true peak isolate memory and production request/capacity limits. The local functional acceptance is recorded above. No waiver or pass is inferred for unmeasured peak memory, production capacity or public-release operations.

Existing local operator scope is moderation, ranked kill switch, audit records, retention maintenance and verified-request deletion (`ADMIN_LOCAL.md`). A proposed web panel still needs owner-approved global-release scope and authentication/2FA/recovery design before implementation. No CMS, analytics or new admin dashboard is made a prerequisite for this local review.
