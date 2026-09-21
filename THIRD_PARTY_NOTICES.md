# Third-party notices

This private technical prototype imports the following runtime dependencies. These notices do not select a license for Fortemate-authored TV application code or resolve the terms of a future combined distribution.

| Component                 | Pinned version | License          | Source                                        |
| ------------------------- | -------------- | ---------------- | --------------------------------------------- |
| Dice Chess engine         | 0.12.2         | AGPL-3.0-only    | https://github.com/fortemate/dicechess-engine |
| Chessground, Lichess Team | 10.1.1         | GPL-3.0-or-later | https://github.com/lichess-org/chessground    |
| Svelte                    | 5.57.0         | MIT              | https://github.com/sveltejs/svelte            |

The engine and Chessground license texts are in [AGPL-3.0](licenses/AGPL-3.0.txt) and [GPL-3.0](licenses/GPL-3.0.txt). Full installed-package notices are retained in node_modules, and build-generated license comments must not be removed. The package lock records the exact dependency graph. Before any external binary distribution, resolve the combined license, required notices and complete corresponding-source delivery, including applicable transitive dependencies.

Piece glyphs are Unicode characters rendered by system fonts. No cburnett artwork, opening book, private model or server implementation is bundled. No Vega SDK or Amazon sample code has yet been copied into this repository.
