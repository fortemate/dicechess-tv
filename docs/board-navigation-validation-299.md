# Horizontal cycling validation (#299)

Initial implementation: `44d1097030219eefa624b7ba41ca74c3c12d56a5`. Review follow-up: `b7144d1e2c03f2fd83b736ad646c771e41fbc00c`. The follow-up retains physical direction holds across context/focus/activity changes until release and prevents canceled OK presses from re-arming on repeats. Main's native test-harness integration changes tests and coverage accounting, rather than the application behavior.

## Automated validation

Core and native tests cover new Left/Right presses at both ends, sparse candidate rows, no other candidate, forward choices on another rank taking precedence, selected destinations, Black's flipped board, unchanged vertical navigation, and arrows emitting no move intent. Native events also cover walking to an end while held, release/new-press cycling, continuing a hold after cycling, context changes, blur/inactivity, single-release OK and Back cancellation. The tutorial uses the same repeat metadata and board reducer.

The implementation passes the cyclic discrete-press layout to shortest paths, centrality, landing reachability and the evaluator. Automated evidence for routes and centrality is `shortest routes and centrality include discrete cyclic presses` in `test/cursor.test.ts`; evaluator evidence is `the current cyclic strategy counts a boundary press and both OKs` in `test/presses.test.ts`. These tests do not establish physical-device behavior. Historical evaluator strategies retain their graph with wrapping disabled; the original published simulation figures have not been replaced with new measurements.

`opening and closing a menu during a hold cannot enable cycling` in `native/test/input.test.tsx` fails against the original hook: more Right repeats after closing Menu incorrectly take the cursor from `h2` to `c2`. It passes after the correction. `native/test/remoteInput.test.tsx` checks direction holds across context and lifecycle changes, releases received while inactive, and canceled OK repeats after context or focus changes. Those corrections have automated evidence; an additional physical multi-key injection attempt did not establish the intended close-Menu-while-held sequence, so it is not counted as physical validation of that scenario.

## Physical Vega Fire TV Stick

On 9 October 2026, an armv7 Release package, version 0.1.0, build 13, verified a 2.2-second Right hold stopping at the available `g1` knight and the next short Right cycling to `b1`. Its SHA-256 is `c6801119af585d6464652ba7709ad92fc5f06dff7b6f0eff785a9cec04072d9b`.

After the device connection was restored, controlled-position build 22 exercised the review-follow-up implementation on the same physical Stick. Its SHA-256 is `930c2cc1e0275500e40588973f4cd10e58b987e95bef56195cdc6b11b10efa89`. The temporary entry point created positions with the canonical `newGame` and `rollGame`, supplied asynchronous scheduling, and used an isolated MMKV namespace. The native remote hook, screen reducer, board navigation and rendering were the application code from the revision above. Device state reports and settled 1920×1080 screenshots established the results below.

| Verified physical scenario                | Observed sequence                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| All eight White starting pawns, `[1,1,1]` | Hold Right from `e2` stops at `h2`; new Right → `a2`; new Left → `h2`; held Left stops at `a2`; new Left → `h2`                               |
| Start a press at the boundary             | Hold Right starting at `h2`: cycle once to `a2`, walk forward and stop at `h2`                                                                |
| Sparse choices, `[1,3,5]`                 | Candidates `b2`, `d2`, `e2`: new Right from `e2` → `b2`; new Left from `b2` → `e2`; held repeats stop at the available end                    |
| Knight destinations, `[5,4,2]`            | Select `b1`, landing on `a3`; hold Right stops at `c3`; new Right → `a3`; new Left → `c3`; Back returns to `b1`; OK then OK plays `b1a3`      |
| Black, board turning enabled              | Hold Right from `e7` stops at `a7`; new Right → `h7`; new Left → `a7`; held Left stops at `h7`; new Left → `a7`, following screen orientation |
| Pawn confirmation and cancellation        | OK on `h2` selects it and focuses `h4`; Back returns to `h2`; OK then OK plays `h2h4`                                                         |

VDA's `inputd-cli` supplied key-down, repeated-down and key-up events. This is remote event injection on physical hardware, rather than a human usability test.

## Final ordinary package

The temporary fixture package was replaced by normal armv7 Release build 23, version 0.1.0, from `b7144d1e2c03f2fd83b736ad646c771e41fbc00c`. Its SHA-256 is `1cf5160a52dd3bea5230abd5264bca2deb13674cd6f957a5b4aaa14da2b96137`. The device package manager reported build 23 and a SHA-384 matching the locally retained archive. Cold launch showed the original saved game. D-pad navigation, OK selection, Back cancellation and opening/closing Menu were checked on this ordinary package without playing a move in the saved game.

The original installed build 12 archive was retained locally for rollback, with its hash matched against the device package metadata. The PR has not been merged, and no release has been published.
