<script lang="ts">
  import { onMount } from 'svelte';
  import { Chessground } from '@lichess-org/chessground';
  import type { Api } from '@lichess-org/chessground/api';
  import type { Key } from '@lichess-org/chessground/types';
  import BotWorker from './bot.worker?worker&inline';
  import { SnapshotStore } from './storage';
  import { shiftSquare } from './model';
  import {
    newGame,
    decodeGame,
    viewGame,
    rollGame,
    moveGame,
    nextTurn,
    resignGame,
    agreeDraw,
    applyBotReply,
    rollDice,
    sideName,
    opposite,
    type Game,
    type Mode,
  } from './game';
  import '@lichess-org/chessground/assets/chessground.base.css';
  import '@lichess-org/chessground/assets/chessground.brown.css';

  let game = $state<Game | null>(null);
  let current = $derived(game ? viewGame(game) : null);
  let home = $state(true);
  let homeIndex = $state(0);
  let homeOptions = $derived(
    game
      ? ['Resume game', 'Hotseat', 'Play Random']
      : ['Hotseat', 'Play Random'],
  );
  let busy = $state(true);
  let saveStatus = $state('Loading saved game…');
  let error = $state('');
  let cursor = $state('b1');
  let selected = $state<string | null>(null);
  let promotion = $state<string[]>([]);
  let promotionIndex = $state(0);
  let menu = $state(false);
  let menuIndex = $state(0);
  let confirmation = $state<'resign' | 'draw' | 'new' | null>(null);
  let confirmIndex = $state(0);
  let newMode = $state<Mode>('hotseat');
  let workerStatus = $state('');
  let board: Api | undefined;
  let worker: Worker | undefined;
  let workerEpoch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let saves: SnapshotStore<Game>;
  const pieces: Record<string, string> = {
    P: 'Pawn',
    N: 'Knight',
    B: 'Bishop',
    R: 'Rook',
    Q: 'Queen',
    K: 'King',
  };
  const diceLetters = ['P', 'N', 'B', 'R', 'Q', 'K'];
  const targets = $derived(
    selected && current && game?.phase === 'move'
      ? [
          ...new Set(
            current.legal
              .filter((m) => m.startsWith(selected!))
              .map((m) => m.slice(2, 4)),
          ),
        ]
      : [],
  );
  const options = $derived([
    'Resume',
    ...(error ? ['Retry bot'] : []),
    ...(game?.phase !== 'ended' ? ['Resign'] : []),
    ...(game?.mode === 'hotseat' && game.phase !== 'ended'
      ? ['Agree draw']
      : []),
    'Choose mode',
  ]);
  const resultText = $derived(
    game?.result
      ? game.result.winner
        ? `${sideName(game.result.winner)} wins`
        : 'Draw'
      : '',
  );
  const reasonText: Record<string, string> = {
    'king-captured': 'King captured',
    resigned: 'Resignation',
    'agreed-draw': 'By agreement',
    '100-halfmoves': '100 halfmoves without a pawn move or capture',
    'turn-limit': '5,000-turn limit',
  };

  function stopWorker() {
    workerEpoch++;
    worker?.terminate();
    worker = undefined;
    clearTimeout(timer);
  }
  function boardAction(node: HTMLDivElement) {
    const api = Chessground(node, {
      fen: current?.dfen.split(' ')[0],
      viewOnly: true,
      coordinates: true,
      animation: { enabled: true, duration: 150 },
    });
    board = api;
    updateBoard();
    return {
      destroy() {
        api.destroy();
        if (board === api) board = undefined;
      },
    };
  }
  function updateBoard() {
    if (!current) return;
    board?.set({
      fen: current.dfen.split(' ')[0],
      selected: selected as Key | undefined,
      lastMove: game?.lastMove
        ? [game.lastMove.slice(0, 2) as Key, game.lastMove.slice(2, 4) as Key]
        : undefined,
    });
  }
  $effect(() => {
    current;
    selected;
    game?.lastMove;
    updateBoard();
  });

  async function commit(next: Game) {
    if (busy) throw new Error('A save is already pending');
    busy = true;
    saveStatus = 'Saving…';
    try {
      await saves.save(next);
      if (disposed) return;
      const changedSide = current?.side !== viewGame(next).side;
      game = next;
      selected = null;
      promotion = [];
      if (changedSide) cursor = viewGame(next).side === 'w' ? 'b1' : 'b8';
      saveStatus = 'Saved';
    } catch (reason) {
      saveStatus = 'Save failed';
      throw reason;
    } finally {
      busy = false;
    }
  }
  async function perform(makeNext: () => Game) {
    if (busy) return;
    try {
      await commit(makeNext());
      driveBot();
    } catch (reason) {
      error = String(reason);
    }
  }
  function driveBot() {
    if (
      disposed ||
      busy ||
      home ||
      menu ||
      confirmation ||
      !game ||
      !current?.bot ||
      error ||
      game.phase === 'ended' ||
      worker
    )
      return;
    if (game.phase === 'roll') {
      void perform(() => rollGame(game!, rollDice()));
      return;
    }
    if (game.phase === 'handoff') {
      void perform(() => nextTurn(game!));
      return;
    }
    const requestGame = game;
    const dfen = current.dfen;
    const id = ++workerEpoch;
    workerStatus = 'Random is thinking…';
    try {
      worker = new BotWorker();
      const fail = (message: string) => {
        if (id !== workerEpoch) return;
        stopWorker();
        workerStatus = '';
        error = message;
      };
      worker.onerror = () =>
        fail('The local bot could not finish. Open the menu to retry.');
      worker.onmessage = async (event) => {
        if (
          id !== workerEpoch ||
          !game ||
          game.id !== requestGame.id ||
          game.revision !== requestGame.revision
        )
          return;
        try {
          const data = event.data;
          if (data.id !== id) return;
          if (data.error) throw new Error(data.error);
          const next = applyBotReply(game, data);
          stopWorker();
          workerStatus = 'Saving Random’s turn…';
          await commit(next);
          workerStatus = '';
          driveBot();
        } catch (reason) {
          stopWorker();
          workerStatus = '';
          error = String(reason);
        }
      };
      timer = setTimeout(
        () =>
          fail(
            'The local bot timed out. No result was applied. Open the menu to retry.',
          ),
        10000,
      );
      worker.postMessage({
        id,
        gameId: game.id,
        revision: game.revision,
        dfen,
      });
    } catch (reason) {
      stopWorker();
      workerStatus = '';
      error = String(reason);
    }
  }
  async function start(mode: Mode) {
    stopWorker();
    error = '';
    workerStatus = '';
    try {
      await commit(newGame(mode, crypto.randomUUID()));
      home = false;
      menu = false;
      confirmation = null;
      cursor = 'b1';
      driveBot();
    } catch (reason) {
      error = String(reason);
    }
  }
  async function chooseHome() {
    const choice = homeOptions[homeIndex];
    if (choice === 'Resume game') {
      home = false;
      cursor = current?.side === 'b' ? 'b8' : 'b1';
      driveBot();
      return;
    }
    newMode = choice === 'Hotseat' ? 'hotseat' : 'random';
    if (game && game.phase !== 'ended') {
      confirmation = 'new';
      confirmIndex = 0;
    } else await start(newMode);
  }
  async function chooseMenu() {
    const choice = options[menuIndex];
    if (choice === 'Resume') {
      menu = false;
      driveBot();
    } else if (choice === 'Retry bot') {
      error = '';
      menu = false;
      driveBot();
    } else if (choice === 'Choose mode') {
      menu = false;
      home = true;
      homeIndex = 0;
    } else {
      confirmation = choice === 'Resign' ? 'resign' : 'draw';
      confirmIndex = 0;
    }
  }
  async function confirm() {
    const choice = confirmation;
    confirmation = null;
    if (confirmIndex === 0) {
      driveBot();
      return;
    }
    if (choice === 'new') await start(newMode);
    else {
      menu = false;
      await perform(() =>
        choice === 'resign' ? resignGame(game!) : agreeDraw(game!),
      );
    }
  }
  async function onKey(event: KeyboardEvent) {
    const key = event.key === 'GoBack' ? 'Escape' : event.key;
    if (
      ![
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Enter',
        'Escape',
        'Backspace',
      ].includes(key)
    )
      return;
    event.preventDefault();
    if (
      busy ||
      disposed ||
      (event.repeat && ['Enter', 'Escape', 'Backspace'].includes(key))
    )
      return;
    const back = key === 'Escape' || key === 'Backspace';
    if (confirmation) {
      if (back) {
        confirmation = null;
        driveBot();
      } else if (key === 'Enter') await confirm();
      else confirmIndex = 1 - confirmIndex;
      return;
    }
    if (promotion.length) {
      if (back) {
        promotion = [];
      } else if (key === 'Enter') {
        const move = promotion[promotionIndex];
        await perform(() => moveGame(game!, move));
      } else
        promotionIndex =
          (promotionIndex +
            (key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1) +
            promotion.length) %
          promotion.length;
      return;
    }
    if (home) {
      if (back && game) {
        home = false;
        driveBot();
      } else if (key === 'Enter') await chooseHome();
      else if (key.startsWith('Arrow'))
        homeIndex =
          (homeIndex +
            (key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1) +
            homeOptions.length) %
          homeOptions.length;
      return;
    }
    if (back) {
      if (selected) {
        selected = null;
      } else {
        menu = !menu;
        menuIndex = 0;
        if (menu) {
          stopWorker();
          workerStatus = '';
        } else driveBot();
      }
      return;
    }
    if (menu) {
      if (key === 'Enter') await chooseMenu();
      else
        menuIndex =
          (menuIndex +
            (key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1) +
            options.length) %
          options.length;
      return;
    }
    if (!game || !current || error) return;
    if (game.phase === 'ended') {
      if (key === 'Enter') {
        home = true;
        homeIndex = 0;
      }
      return;
    }
    if (current.bot) return;
    if (game.phase === 'roll') {
      if (key === 'Enter') await perform(() => rollGame(game!, rollDice()));
      return;
    }
    if (game.phase === 'handoff') {
      if (key === 'Enter') await perform(() => nextTurn(game!));
      return;
    }
    if (key.startsWith('Arrow')) {
      cursor = shiftSquare(cursor, key);
      return;
    }
    const matches = selected
      ? current.legal.filter((m) => m.startsWith(selected! + cursor))
      : [];
    if (matches.length > 1) {
      promotion = matches;
      promotionIndex = 0;
    } else if (matches.length === 1)
      await perform(() => moveGame(game!, matches[0]));
    else if (current.legal.some((m) => m.startsWith(cursor))) selected = cursor;
  }
  onMount(() => {
    saves = new SnapshotStore<Game>(indexedDB, {
      database: 'dicechess-tv.games',
      key: 'active.v2',
      decode: decodeGame,
    });
    void (async () => {
      try {
        game = await saves.load();
        saveStatus = game ? 'Restored' : 'Ready';
      } catch (reason) {
        error = 'Saved game could not be loaded: ' + String(reason);
        saveStatus = 'Save unavailable';
      } finally {
        if (!disposed) busy = false;
      }
    })();
    window.addEventListener('keydown', onKey);
    return () => {
      disposed = true;
      stopWorker();
      window.removeEventListener('keydown', onKey);
      void saves.close().catch(() => {});
    };
  });
</script>

<main
  data-phase={game?.phase ?? 'home'}
  data-dfen={current?.dfen ?? ''}
  data-game-id={game?.id ?? ''}
  data-revision={game?.revision ?? 0}
>
  {#if home}
    <section class="home-screen" aria-label="Game mode">
      <p class="eyebrow">DICE CHESS · OFFLINE</p>
      <h1>Three dice.<br />Your next move.</h1>
      <p>Capture the king. Use as many dice as the position allows.</p>
      <div class="choices">
        {#each homeOptions as option, i}<button
            tabindex="-1"
            disabled={busy}
            class:active={homeIndex === i}
            onclick={() => {
              homeIndex = i;
              void chooseHome();
            }}>{option}</button
          >{/each}
      </div>
      <p class="muted">
        Hotseat: two players, one remote.<br />Random: you are White, the local
        bot is Black.
      </p>
      <p class="status" data-testid="save-status">{saveStatus}</p>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </section>
  {:else if game && current}
    <section class="board-section" aria-label="Chessboard">
      <div class="board-frame">
        <div class="cg-wrap" use:boardAction></div>
        {#each targets as square}<div
            class="target"
            style:left={`${(square.charCodeAt(0) - 97) * 12.5}%`}
            style:top={`${(8 - Number(square[1])) * 12.5}%`}
          ></div>{/each}
        {#if game.phase === 'move' && !current.bot}<div
            class="cursor"
            style:left={`${(cursor.charCodeAt(0) - 97) * 12.5}%`}
            style:top={`${(8 - Number(cursor[1])) * 12.5}%`}
          ></div>{/if}
      </div>
    </section>
    <aside>
      <p class="eyebrow">
        {game.mode === 'hotseat' ? 'HOTSEAT' : 'YOU vs RANDOM'} · TURN {game.turn}
      </p>
      <h1>
        {game.phase === 'ended'
          ? resultText
          : `${sideName(current.side)} to play`}
      </h1>
      {#if game.phase === 'ended'}
        <p class="success">{reasonText[game.result!.reason]}</p>
        <p>OK: choose a new game</p>
      {:else}
        <div class="dice" aria-label="Rolled dice">
          {#each game.roll as die, i}<div
              class="die"
              class:used={current.remaining.split(diceLetters[die - 1]).length -
                1 <
                game.roll.slice(0, i + 1).filter((n) => n === die).length}
            >
              <strong>{die}</strong><span>{pieces[diceLetters[die - 1]]}</span>
            </div>{/each}
        </div>
        {#if workerStatus}<p class="notice">{workerStatus}</p>
        {:else if game.phase === 'roll'}<p class="notice">
            OK: roll three dice
          </p>
        {:else if game.phase === 'handoff'}<p class="notice">
            {game.moves.length
              ? 'Turn complete.'
              : 'No legal action with this roll.'}<br />{game.mode === 'hotseat'
              ? `Pass the remote to ${sideName(opposite(current.side))}.`
              : `${sideName(opposite(current.side))} plays next.`}<br />OK:
            continue
          </p>
        {:else}<p class="notice">
            {selected
              ? `Choose a destination for ${selected}.`
              : 'Choose a piece, then press OK to see its legal destinations.'}
          </p>
          <p class="muted">
            Remaining: {current.remaining
              .split('')
              .map((p) => pieces[p])
              .join(' · ') || 'none'}
          </p>{/if}
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <p class="instructions">
        Arrows: move focus · OK: select<br />Back: cancel or open menu
      </p>
      <p class="status" data-testid="save-status">{saveStatus}</p>
      <p class="status">
        {selected ? `Selected ${selected}` : `Cursor ${cursor}`} · {game.phase}
      </p>
    </aside>
  {/if}
  {#if menu && !home}<div class="veil">
      <div class="menu" aria-modal="true" role="dialog" aria-label="Game menu">
        <h2>Game menu</h2>
        {#each options as option, i}<button
            tabindex="-1"
            disabled={busy}
            class:active={menuIndex === i}
            onclick={() => {
              menuIndex = i;
              void chooseMenu();
            }}>{option}</button
          >{/each}
      </div>
    </div>{/if}
  {#if promotion.length}<div class="veil">
      <div class="menu" aria-modal="true" role="dialog" aria-label="Promotion">
        <h2>Promote to</h2>
        {#each promotion as move, i}<button
            tabindex="-1"
            disabled={busy}
            class:active={promotionIndex === i}
            onclick={() => void perform(() => moveGame(game!, move))}
            >{pieces[move.slice(4).toUpperCase()]}</button
          >{/each}
        <p>Back: cancel</p>
      </div>
    </div>{/if}
  {#if confirmation}<div class="veil">
      <div
        class="menu"
        aria-modal="true"
        role="dialog"
        aria-label="Confirm action"
      >
        <h2>
          {confirmation === 'new'
            ? 'Replace unfinished game?'
            : confirmation === 'draw'
              ? 'Both players agree to a draw?'
              : `Resign as ${game?.mode === 'random' ? 'White' : sideName(current!.side)}?`}
        </h2>
        <p>
          {confirmation === 'new'
            ? 'The current game will be replaced. No result is recorded.'
            : 'This ends the current game.'}
        </p>
        {#each ['Cancel', 'Confirm'] as label, i}<button
            tabindex="-1"
            disabled={busy}
            class:active={confirmIndex === i}
            onclick={() => {
              confirmIndex = i;
              void confirm();
            }}>{label}</button
          >{/each}
      </div>
    </div>{/if}
</main>
