# Third-party notices

This private technical prototype imports the following runtime dependencies. These notices do not select a license for Fortemate-authored TV application code or resolve the terms of a future combined distribution.

| Component                         | Pinned version | License          | Source                                        |
| --------------------------------- | -------------- | ---------------- | --------------------------------------------- |
| Dice Chess engine                 | 0.12.2         | AGPL-3.0-only    | https://github.com/fortemate/dicechess-engine |
| Chessground, Lichess Team         | 10.1.1         | GPL-3.0-or-later | https://github.com/lichess-org/chessground    |
| Svelte                            | 5.57.0         | MIT              | https://github.com/sveltejs/svelte            |
| Vector Chess Pieces Pack, RhosGFX | —              | CC0-1.0          | https://twitter.com/RhosGFX                   |

The engine, Chessground, and RhosGFX license texts are in [AGPL-3.0](licenses/AGPL-3.0.txt), [GPL-3.0](licenses/GPL-3.0.txt), and [CC0-1.0](licenses/RhosGFX-CC0.txt). Full installed-package notices are retained in node_modules, and build-generated license comments must not be removed. The package lock records the exact dependency graph. Before any external binary distribution, resolve the combined license, required notices and complete corresponding-source delivery, including applicable transitive dependencies.

Chess pieces use 12 vector SVG pieces (White and Black Outline variants) from the RhosGFX Vector Chess Pieces Pack, dedicated to the public domain under Creative Commons CC0 1.0 Universal and bundled locally. No cburnett artwork, opening book, private model or server implementation is bundled. No Vega SDK or Amazon sample code has yet been copied into this repository.

Development-only tests use fake-indexeddb 6.2.5 (Apache-2.0), from https://github.com/dumbmatter/fakeIndexedDB. Its license is retained in the installed package; it is not included in the runtime bundle.
