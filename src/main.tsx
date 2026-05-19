import {
  ArrowLeft,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  japaneseName,
  josekiLabel,
  type OpeningRecord,
  openingSearchText,
  openings,
} from "./domain/openings";
import {
  applyMove,
  type Board,
  type Cell,
  colorForPly,
  discCounts,
  getFlips,
  legalMoves,
  pointToCoord,
} from "./domain/othello";
import {
  expectedMoves,
  playComputerMove,
  playPlayerMove,
  rootTree,
  startTrainer,
  type TrainerMode,
  type TrainerState,
} from "./domain/trainer";

type ModeChoice = "free" | string;
type SideChoice = "black" | "white";
type Phase = "setup" | "practice";
type AnimatingCells = { placed: Set<string>; flipped: Set<string> };

const sleep = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const curatedOpenings = openings
  .filter((opening) => opening.move_count >= 4)
  .sort(
    (a, b) =>
      a.move_count - b.move_count ||
      japaneseName(a).localeCompare(japaneseName(b), "ja"),
  );

function App() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [side, setSide] = useState<SideChoice>("black");
  const [modeChoice, setModeChoice] = useState<ModeChoice>("free");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<TrainerState | null>(null);
  const [history, setHistory] = useState<TrainerState[]>([]);
  const [animatingCells, setAnimatingCells] = useState<AnimatingCells>({
    placed: new Set(),
    flipped: new Set(),
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const stateRef = useRef<TrainerState | null>(null);

  const selectedOpening = curatedOpenings.find(
    (opening) => opening.id === modeChoice,
  );
  const mode: TrainerMode = selectedOpening
    ? { kind: "fixed", opening: selectedOpening }
    : { kind: "free", tree: rootTree };

  const filteredOpenings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? curatedOpenings.filter((opening) =>
          openingSearchText(opening).includes(needle),
        )
      : curatedOpenings;
    return list.slice(0, 180);
  }, [query]);

  async function beginPractice() {
    const next = startTrainer(side, mode);
    commitState(next);
    setHistory([]);
    setAnimatingCells({ placed: new Set(), flipped: new Set() });
    setPhase("practice");
    if (side === "white") {
      await sleep(260);
      await runComputerTurn(next);
    }
  }

  async function restartSameSettings() {
    const next = startTrainer(side, mode);
    commitState(next);
    setHistory([]);
    setAnimatingCells({ placed: new Set(), flipped: new Set() });
    if (side === "white") {
      await sleep(260);
      await runComputerTurn(next);
    }
  }

  function backToSetup() {
    setPhase("setup");
    commitState(null);
    setHistory([]);
    setAnimatingCells({ placed: new Set(), flipped: new Set() });
  }

  async function play(coord: string) {
    const current = stateRef.current;
    if (!current || isAnimating || current.status !== "playing") {
      return;
    }
    if (!expectedMoves(current).includes(coord)) {
      const failed = playPlayerMove(current, coord);
      setHistory((items) => [...items, current]);
      commitState(failed);
      return;
    }
    setHistory((items) => [...items, current]);
    const next = await animateMove(current, coord, "player");
    if (next.status === "playing") {
      await sleep(240);
      await runComputerTurn(next);
    }
  }

  function undo() {
    setHistory((items) => {
      const previous = items.at(-1);
      if (!previous) {
        return items;
      }
      commitState(previous);
      setAnimatingCells({ placed: new Set(), flipped: new Set() });
      return items.slice(0, -1);
    });
  }

  async function runComputerTurn(base: TrainerState) {
    if (
      base.status !== "playing" ||
      colorForPly(base.moves.length) === base.playerSide
    ) {
      return;
    }
    const options = expectedMoves(base);
    const move = options[Math.floor(Math.random() * options.length)];
    if (!move) {
      commitState(playComputerMove(base));
      return;
    }
    await animateMove(base, move, "computer");
  }

  async function animateMove(
    base: TrainerState,
    move: string,
    actor: "player" | "computer",
  ): Promise<TrainerState> {
    setIsAnimating(true);
    const color = colorForPly(base.moves.length);
    const flips = getFlips(base.board, move, color);
    const placedBoard = boardWithCell(base.board, move, color);
    commitState({
      ...base,
      board: placedBoard,
      message:
        actor === "player"
          ? `${move} を置きました`
          : `相手が ${move} に置きました`,
    });
    setAnimatingCells({ placed: new Set([move]), flipped: new Set() });
    await sleep(280);

    const finalState =
      actor === "player"
        ? playPlayerMove(base, move)
        : playComputerMove(base, rngForMove(base, move));
    const finalBoard =
      finalState.status === "failure"
        ? applyMove(base.board, move, color)
        : finalState.board;
    commitState({
      ...finalState,
      board: finalBoard,
      message: actor === "player" ? `${move} を着手` : `相手が ${move} を着手`,
    });
    setAnimatingCells({ placed: new Set(), flipped: new Set(flips) });
    await sleep(440);
    setAnimatingCells({ placed: new Set(), flipped: new Set() });
    setIsAnimating(false);
    return stateRef.current ?? finalState;
  }

  function commitState(next: TrainerState | null) {
    stateRef.current = next;
    setState(next);
  }

  return (
    <main className="app-shell">
      <Header />
      {phase === "setup" ? (
        <SetupScreen
          filteredOpenings={filteredOpenings}
          modeChoice={modeChoice}
          query={query}
          selectedOpening={selectedOpening}
          side={side}
          onBegin={beginPractice}
          onModeChange={setModeChoice}
          onQueryChange={setQuery}
          onSideChange={setSide}
        />
      ) : state ? (
        <PracticeScreen
          animatingCells={animatingCells}
          historyLength={history.length}
          isAnimating={isAnimating}
          selectedOpening={selectedOpening}
          state={state}
          onBackToSetup={backToSetup}
          onPlay={play}
          onRestart={restartSameSettings}
          onUndo={undo}
        />
      ) : null}
    </main>
  );
}

function Header() {
  return (
    <section className="control-band">
      <div className="brand-block">
        <div className="mark" aria-hidden="true">
          <Sparkles size={22} />
        </div>
        <div>
          <h1>オセロ定石トレーナー</h1>
          <p>{openings.length} 本の定石データを初手 f5 に正規化</p>
        </div>
      </div>
    </section>
  );
}

function SetupScreen({
  filteredOpenings,
  modeChoice,
  query,
  selectedOpening,
  side,
  onBegin,
  onModeChange,
  onQueryChange,
  onSideChange,
}: {
  filteredOpenings: OpeningRecord[];
  modeChoice: ModeChoice;
  query: string;
  selectedOpening?: OpeningRecord;
  side: SideChoice;
  onBegin: () => void;
  onModeChange: (choice: ModeChoice) => void;
  onQueryChange: (query: string) => void;
  onSideChange: (side: SideChoice) => void;
}) {
  return (
    <section className="setup-screen">
      <div className="setup-main">
        <div className="setup-copy">
          <span>Opening Book Practice</span>
          <h2>定石を選んで、盤上で覚える。</h2>
        </div>

        <fieldset className="setup-card">
          <legend>手番選択</legend>
          <div className="choice-grid">
            <button
              className={side === "black" ? "choice active" : "choice"}
              type="button"
              onClick={() => onSideChange("black")}
            >
              黒番で練習
            </button>
            <button
              className={side === "white" ? "choice active" : "choice"}
              type="button"
              onClick={() => onSideChange("white")}
            >
              白番で練習
            </button>
          </div>
        </fieldset>

        <fieldset className="setup-card">
          <legend>定石選択</legend>
          <button
            className={`mode-row ${modeChoice === "free" ? "selected" : ""}`}
            type="button"
            onClick={() => onModeChange("free")}
          >
            <Shuffle size={18} />
            <span>
              <strong>フリーモード</strong>
              <small>局面から続く定石を相手がランダムに選びます</small>
            </span>
          </button>
          <input
            className="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="日本語名・手順で検索"
            type="search"
          />
          <div className="opening-list setup-list">
            {filteredOpenings.map((opening) => (
              <button
                className={`opening-row ${modeChoice === opening.id ? "selected" : ""}`}
                key={opening.id}
                type="button"
                onClick={() => onModeChange(opening.id)}
              >
                <strong>{josekiLabel(opening)}</strong>
                <span>{opening.sequence}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="start-summary">
          <div>
            <span>選択中</span>
            <strong>
              {selectedOpening ? josekiLabel(selectedOpening) : "フリーモード"}
            </strong>
          </div>
          <button className="primary-action" type="button" onClick={onBegin}>
            <Play size={18} />
            練習開始
          </button>
        </div>
      </div>
    </section>
  );
}

function PracticeScreen({
  animatingCells,
  historyLength,
  isAnimating,
  selectedOpening,
  state,
  onBackToSetup,
  onPlay,
  onRestart,
  onUndo,
}: {
  animatingCells: AnimatingCells;
  historyLength: number;
  isAnimating: boolean;
  selectedOpening?: OpeningRecord;
  state: TrainerState;
  onBackToSetup: () => void;
  onPlay: (coord: string) => void;
  onRestart: () => void;
  onUndo: () => void;
}) {
  const counts = discCounts(state.board);
  const nextColor =
    state.status === "playing"
      ? state.moves.length % 2 === 0
        ? "black"
        : "white"
      : null;
  const playableMoves =
    nextColor === state.playerSide && state.status === "playing" && !isAnimating
      ? new Set(legalMoves(state.board, state.playerSide))
      : new Set<string>();
  const latestOpponentMove = [...state.moves]
    .map((move, index) => ({ move, index }))
    .reverse()
    .find(({ index }) => colorForPly(index) !== state.playerSide);
  const reachedOpenings =
    state.mode.kind === "fixed" && state.status === "success" && selectedOpening
      ? [selectedOpening]
      : state.currentOpenings;
  const reachedOpening = reachedOpenings.at(-1);

  return (
    <section className="practice-layout">
      <div className="practice-top">
        <button className="ghost-action" type="button" onClick={onBackToSetup}>
          <ArrowLeft size={18} />
          設定へ
        </button>
        <button className="ghost-action" type="button" onClick={onRestart}>
          <RotateCcw size={18} />
          やり直し
        </button>
      </div>

      <section className="board-zone">
        <div className="status-line">
          <div>
            <span className={`status-pill ${state.status}`}>
              {statusLabel(state)}
            </span>
            <p>{state.message}</p>
          </div>
          <div className="score" role="status" aria-label="石数">
            <span className="disc black" />
            {counts.black}
            <span className="disc white" />
            {counts.white}
          </div>
        </div>

        <BoardView
          animatingCells={animatingCells}
          playableMoves={playableMoves}
          state={state}
          onPlay={onPlay}
        />

        {reachedOpening ? (
          <div className="joseki-banner" key={reachedOpening.id}>
            {josekiLabel(reachedOpening)}
          </div>
        ) : null}

        {state.status === "success" ? (
          <div className="clear-panel">
            <strong>クリア</strong>
            <span>
              {reachedOpening
                ? `${josekiLabel(reachedOpening)}を最後まで打てました`
                : "定石の終端まで到達しました"}
            </span>
            <button
              className="primary-action"
              type="button"
              onClick={onBackToSetup}
            >
              また最初から
            </button>
          </div>
        ) : null}

        {state.status === "failure" ? (
          <div className="failure-panel">
            <strong>失敗</strong>
            <span>{state.message}</span>
            <button
              className="primary-action"
              disabled={historyLength === 0}
              type="button"
              onClick={onUndo}
            >
              <Undo2 size={18} />
              一手戻る
            </button>
          </div>
        ) : null}

        <div className="move-strip">
          {state.moves.map((move, index) => (
            <span
              key={`${move}-${index}`}
              className={index % 2 === 0 ? "black-move" : "white-move"}
            >
              {index + 1}. {move}
            </span>
          ))}
        </div>
      </section>

      <aside className="info-panel">
        <h2>現在</h2>
        <InfoBlock
          title="練習"
          value={
            selectedOpening ? josekiLabel(selectedOpening) : "フリーモード"
          }
        />
        <InfoBlock
          title="相手の直前手"
          value={
            latestOpponentMove ? latestOpponentMove.move : "まだありません"
          }
        />
        <InfoBlock title="手数" value={`${state.moves.length}`} />
        <div className="terminal-list">
          <h3>到達した定石</h3>
          {reachedOpenings.length > 0 ? (
            reachedOpenings
              .slice(-6)
              .map((opening) => (
                <span key={opening.id}>{josekiLabel(opening)}</span>
              ))
          ) : (
            <span>未到達</span>
          )}
        </div>
      </aside>
    </section>
  );
}

function BoardView({
  state,
  playableMoves,
  animatingCells,
  onPlay,
}: {
  state: TrainerState;
  playableMoves: Set<string>;
  animatingCells: AnimatingCells;
  onPlay: (coord: string) => void;
}) {
  return (
    <div className="board-wrap">
      <div className="board">
        {state.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const coord = pointToCoord(rowIndex, colIndex);
            const canPlay = playableMoves.has(coord);
            const placed = animatingCells.placed.has(coord);
            const flipped = animatingCells.flipped.has(coord);
            return (
              <button
                aria-label={coord}
                className={`square ${canPlay ? "playable" : ""}`}
                disabled={!canPlay || state.status !== "playing"}
                key={coord}
                type="button"
                onClick={() => onPlay(coord)}
              >
                <span className="coord">{coord}</span>
                {cell ? (
                  <span
                    className={`stone ${cell} ${placed ? "placed" : ""} ${flipped ? "flipped" : ""}`}
                    key={`${coord}-${cell}-${placed ? "p" : ""}-${flipped ? "f" : ""}-${state.moves.length}`}
                  />
                ) : null}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="info-block">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function statusLabel(state: TrainerState): string {
  if (state.status === "success") {
    return "成功";
  }
  if (state.status === "failure") {
    return "失敗";
  }
  return state.moves.length % 2 === 0 ? "黒番" : "白番";
}

function boardWithCell(board: Board, move: string, cell: Cell): Board {
  const next = board.map((row) => [...row]);
  const [file, rankText] = [move[0], move.slice(1)];
  const col = "abcdefgh".indexOf(file);
  const row = Number(rankText) - 1;
  next[row][col] = cell;
  return next;
}

function rngForMove(state: TrainerState, move: string): () => number {
  const options = expectedMoves(state);
  const index = Math.max(0, options.indexOf(move));
  return () => (index + 0.01) / Math.max(1, options.length);
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}
