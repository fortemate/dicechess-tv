# English voice expansion validation

October 22, 2026. Development integration; no release or store submission.

The app vendors 179 additional recordings from four expansion packs at the asset commit recorded in `native/voices/voices.json`: 96 opponent lines and 83 Hot Seat host lines. Five selected second takes are included. The full app catalog contains 446 clips: 159 opponent, 239 host and 48 tutorial lines. Existing recordings remain available.

Opponents now have 13 intro and loss lines, eight win lines and seven dedicated rematch lines each. A new game after a completed game against the same opponent uses the rematch pool. Switching opponents uses an intro. Opening state resets without discarding the last line for an event, so immediate repeats remain excluded. Host shuffle bags and commentary pacing are preserved.

The 20 dp caption font is unchanged. Opponent bubbles allow four rows and host bubbles three, with matching reserved layout space, because the added recordings have longer transcripts. Source transcripts remain exact, including the two approved wording changes; caption spelling follows the existing presentation rules.

## Automated validation

- Asset catalog build/check and 60 Python tests passed before the asset commit.
- Root TypeScript, lint and formatting checks passed; all 337 core tests passed.
- Native TypeScript and lint checks passed; all 711 native tests passed.
- Metro bundle passed. Web bench: 13 tests and production build passed.
- Release packages built for aarch64, armv7 and x86_64 using development build number 58.
- Vendoring and packaging verify the recorded checksums. Regression tests require exactly 179 expansion clips, exact transcript parity, correct host/opponent packs and all five selected second takes. Event-pool tests exercise every opponent expansion line and the host shuffle bags.

## Virtual device observation

The aarch64 package was installed and launched on the Vega Virtual Device. D-pad, OK and Back were used to select Rolly, resign, start a rematch, return to the main menu, start a friend game and resign there.

Observed captions included the new Rolly opening “All set? I've brought enough giggles for both of us!”, the rematch “Back we go! A fresh sprinkle of luck!”, and Prowla's result “Black wins, darlings. My compliments to both players.” The sampled captions fit their bubbles and the result/control areas remained usable.

The initially selected virtual-device image did not boot. A second already-installed image booted and was used for the successful run without changing the global SDK selection.

This is sampled virtual-device behavior, not a claim that a person listened to all 179 clips or that physical Fire TV Stick playback was checked. Original superseded takes and their metadata remain in the owner's local comparison bundles and workbench. Physical-device listening and release approval remain separate.

## PR review and physical installation follow-up

The SonarQube gate initially reported 31.4% duplication on new lines, entirely in the copied opponent transcript table. The existing duplication exception for host transcript data now also names `src/core/voiceExpansion.ts`; executable logic remains checked. The rerun quality gate passed, with no open code issues. The asset pack README files now record the owner's integration authorization while preserving the distinction from human listening approval, and the client pins that asset documentation update.

At the owner's request, the ordinary and QA Dice Chess installations were removed from a physical armv7 Fire TV Stick. Their removal was verified before installing the standard Release 1.0.4/build 58 package. Package metadata and a screenshot confirmed the new installation and first-run tutorial offer. The installed JS and Hermes bundles and all five selected corrected audio files matched the package bytes by SHA-256. All 446 audio clips were counted on the device, including the presence of all 179 expansion files.

The review changes affect analysis configuration, documentation and the asset commit pointer only; the runtime files match the previously built Release package. This installation readback is separate from human TV-output listening and a full physical audio/lifecycle regression session, neither of which is claimed here. The old installations were deliberately not restored because the owner requested their removal.
