# Horizontal cycling validation (#299)

Implementation: `44d1097030219eefa624b7ba41ca74c3c12d56a5`, based on the updated main branch. The later integration of main's native test harness changes tests and coverage accounting, not the application behavior described here.

## Automated validation

Core and native tests cover new Left/Right presses at both ends, sparse candidate rows, no other candidate, forward choices on another rank taking precedence, selected destinations, Black's flipped board, unchanged vertical navigation, and arrows emitting no move intent. Native events also cover walking to an end while held, release/new-press cycling, continuing a hold after cycling, context changes, blur/inactivity, single-release OK and Back cancellation. The tutorial uses the same repeat metadata and board reducer.

Shortest paths, centrality, landing reachability and the evaluator use the cyclic graph for discrete presses. Historical evaluator strategies retain their graph with wrapping disabled; the original published simulation figures have not been replaced with new measurements.

## Physical Vega Fire TV Stick

On 9 October 2026, an armv7 Release package, version 0.1.0, build 13, was installed and launched on a physical Vega Stick. Its SHA-256 is `c6801119af585d6464652ba7709ad92fc5f06dff7b6f0eff785a9cec04072d9b`.

VDA's `inputd-cli` supplied real device key-down, repeated-down and key-up events. A 2.2-second Right hold stopped at the available `g1` knight. The next short Right press moved the cursor to the available `b1` knight. Both states were checked in 1920×1080 device screenshots. This verifies the held boundary and a deliberate rightward cycle in movable-piece selection. It is remote event injection on physical hardware, not a human usability test.

The full physical matrix below remains pending. Temporary controlled-position packages used an isolated storage namespace so the player's saved game and preferences were not replaced. The first harness incorrectly used the synchronous unit-test scheduler for the danger search; it was changed to the application's asynchronous scheduling. During retesting, the developer shell service stopped responding. After a device reboot, the Stick stopped responding over the existing network connection, preventing completion of the matrix and installation of the final ordinary package.

The last installed package is a temporary validation build 18 using isolated storage. A normal Release build 19 has been built from the application implementation and is ready to install once connectivity returns. The original installed build 12 package was retained locally for rollback, with its archive hash matched against the device's package metadata. No merge or release has been performed.

| Remaining physical scenario               | Press sequence and expected result                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| All eight White starting pawns, `[1,1,1]` | Hold Right from `e2` → `h2`; release/new Right → `a2`; new Left → `h2`; held Left stops at `a2`                                                     |
| Start a press at the boundary             | Hold Right starting at `h2`: cycle once to `a2`, walk forward, stop at `h2`                                                                         |
| Sparse choices, `[1,3,5]`                 | Starting candidates `b2`, `d2`, `e2`: new Right from `e2` → `b2`; new Left from `b2` → `e2`; holds stop at the available end                        |
| Knight destinations, `[5,4,2]`            | Select `b1`; hold Right from `a3` stops at `c3`; release/new Right → `a3`; new Left → `c3`; Back returns to `b1`; OK then OK plays the focused move |
| Black, board turning enabled              | Starting Black pawn row: held Right stops at `a7`; new Right → `h7`; new Left → `a7`; movement follows the displayed orientation                    |
| Final ordinary package                    | Install build 19; cold launch; check D-pad, OK and Back, and that the original saved game and preferences are available                             |

These pending cases have automated coverage. They are not claimed as completed physical checks.
