# Opponent site browser validation

Checked on October 16, 2026, for PR #400, against the production site build from
`docs/opponent-profiles`. The playing examples and recordings are those added
in `8453e173eb50899685148010e7047e908a3d577e`; the review follow-up updates their
documentation and the explanation of manual playback without JavaScript.

These are manual browser checks on macOS, separate from the native TV app's
device validation and the automated engine and portrait tests.

## With JavaScript enabled

In the Codex in-app browser, on the Opponents overview:

- Start Rolly's capture sample, then start Grabby's before Rolly finishes.
  Grabby plays and Rolly's control returns to Play: the previous sample pauses.
- Each sample has its transcript above its native browser controls.
- Nothing plays automatically on navigation or reload.

The earlier in-app browser pass also checked all nine recordings, desktop and
390px mobile layouts, light and dark themes, and the rendered teaching boards.

## With JavaScript disabled

In Chrome DevTools, run **Disable JavaScript** from the command menu and reload
the page. Chrome's address bar reports **JavaScript was blocked on this page**;
the Console has none of the page's normal startup messages. Keep DevTools open
while following the page links so the tab's setting remains in force.

The separate pass covered the overview and the Rolly, Grabby and Rampage
profiles:

- The descriptions and all sample transcripts are readable.
- The character portraits and the three static teaching boards render.
- Ordinary links between the overview and profiles, and links to sections of a
  profile, navigate correctly.
- Native audio Play controls start all nine distinct recordings. Loading enables
  each control's time scrubber and volume control; Play changes to Pause.
- Starting another recording does not pause the previous one. Two controls can
  remain on Pause together. Play one recording at a time by pausing manually.
- The site's Search control is disabled. This pass establishes access to the
  opponent pages and their recordings, not full parity for every site feature.

After the pass, restore the original scripting setting. In Chrome DevTools
Settings, **Preferences > Debugger > Disable JavaScript** was cleared and
confirmed unchecked. The rebuilt overview was also rechecked in the in-app
browser: starting Grabby paused Rolly, and native Pause stopped Grabby.

## Reproduce

1. Install the site's locked dependencies with `npm ci --prefix site` and build
   with `npm run build --prefix site`.
2. Start `npm run preview --prefix site` and open `/play/opponents/` at the URL
   printed by Astro.
3. Run the enabled and disabled checks above, reloading after every setting
   change. Use the real Play and Pause controls; script execution from DevTools
   would not prove that a visitor can use the page without JavaScript.

The three example turns are also checked against the app's actual algorithms
by `test/opponent-examples.test.ts`; algorithm mapping and Rolly's immediate
king capture are checked by `test/opponents.test.ts`. The native portrait
fallback is covered by `native/test/matchup.test.tsx`, with Thinkle's empty
portrait place in `native/test/tutorial.test.tsx`.
