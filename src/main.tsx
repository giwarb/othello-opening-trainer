import { RotateCcw, Shuffle, Sparkles, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { displayName, openingSearchText, openings } from "./domain/openings";
import { discCounts, legalMoves, pointToCoord } from "./domain/othello";
import {
  expectedMoves,
  playPlayerMove,
  rootTree,
  startTrainer,
  type TrainerMode,
  type TrainerState,
} from "./domain/trainer";

type ModeChoice = "free" | string;
type SideChoice = "black" | "white";

const curatedOpenings = openings
  .filter((opening) => opening.move_count >= 4)
  .sort(
    (a, b) =>
      a.move_count - b.move_count ||
      displayName(a).localeCompare(displayName(b), "ja"),
  );

function App() {
  const [side, setSide] = useState<SideChoice>("black");
  const [modeChoice, setModeChoice] = useState<ModeChoice>("free");
  const [query, setQuery] = useState("");
  const [seed, setSeed] = useState(0);

  const selectedOpening = curatedOpenings.find(
    (opening) => opening.id === modeChoice,
  );
  const mode: TrainerMode = selectedOpening
    ? { kind: "fixed", opening: selectedOpening }
    : { kind: "free", tree: rootTree };

  const [state, setState] = useState<TrainerState>(() =>
    startTrainer(side, mode, Math.random),
  );

  const filteredOpenings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? curatedOpenings.filter((opening) =>
          openingSearchText(opening).includes(needle),
        )
      : curatedOpenings;
    return list.slice(0, 180);
  }, [query]);

  const counts = discCounts(state.board);
  const nextColor =
    state.status === "playing"
      ? state.moves.length % 2 === 0
        ? "black"
        : "white"
      : null;
  const playableMoves =
    nextColor === side && state.status === "playing"
      ? new Set(legalMoves(state.board, side))
      : new Set<string>();
  const bookMoves = new Set(expectedMoves(state));

  function reset(nextSide = side, nextChoice = modeChoice) {
    const opening = curatedOpenings.find((item) => item.id === nextChoice);
    const nextMode: TrainerMode = opening
      ? { kind: "fixed", opening }
      : { kind: "free", tree: rootTree };
    setSeed((value) => value + 1);
    setState(startTrainer(nextSide, nextMode, Math.random));
  }

  function updateSide(value: SideChoice) {
    setSide(value);
    reset(value, modeChoice);
  }

  function updateMode(value: ModeChoice) {
    setModeChoice(value);
    reset(side, value);
  }

  function play(coord: string) {
    setState((current) => playPlayerMove(current, coord, Math.random));
  }

  return (
    <main className="app-shell">
      <section className="control-band">
        <div className="brand-block">
          <div className="mark" aria-hidden="true">
            <Sparkles size={22} />
          </div>
          <div>
            <h1>Othello Opening Trainer</h1>
            <p>{openings.length} lines loaded from the opening book</p>
          </div>
        </div>

        <div className="toolbar">
          <fieldset className="segmented">
            <legend>先後選択</legend>
            <button
              className={side === "black" ? "active" : ""}
              type="button"
              onClick={() => updateSide("black")}
            >
              黒番
            </button>
            <button
              className={side === "white" ? "active" : ""}
              type="button"
              onClick={() => updateSide("white")}
            >
              白番
            </button>
          </fieldset>
          <button
            className="icon-button"
            type="button"
            onClick={() => reset()}
            title="リセット"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </section>

      <section className="workspace">
        <aside className="opening-panel">
          <div className="panel-heading">
            <Target size={18} />
            <h2>定石</h2>
          </div>
          <button
            className={`mode-row ${modeChoice === "free" ? "selected" : ""}`}
            type="button"
            onClick={() => updateMode("free")}
          >
            <Shuffle size={18} />
            <span>
              <strong>フリーモード</strong>
              <small>現在局面から続く定石をランダム選択</small>
            </span>
          </button>
          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="定石名・手順で検索"
            type="search"
          />
          <div className="opening-list">
            {filteredOpenings.map((opening) => (
              <button
                className={`opening-row ${modeChoice === opening.id ? "selected" : ""}`}
                key={opening.id}
                type="button"
                onClick={() => updateMode(opening.id)}
              >
                <strong>{displayName(opening)}</strong>
                <span>{opening.sequence}</span>
              </button>
            ))}
          </div>
        </aside>

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
            bookMoves={bookMoves}
            playableMoves={playableMoves}
            state={state}
            onPlay={play}
          />

          <div className="move-strip" key={seed}>
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
            title="モード"
            value={
              selectedOpening ? displayName(selectedOpening) : "フリーモード"
            }
          />
          <InfoBlock
            title="次の定石手"
            value={expectedMoves(state).join(", ") || "なし"}
          />
          <InfoBlock title="手数" value={`${state.moves.length}`} />
          <div className="terminal-list">
            <h3>到達した定石</h3>
            {state.currentOpenings.length > 0 ? (
              state.currentOpenings
                .slice(0, 8)
                .map((opening) => (
                  <span key={opening.id}>{displayName(opening)}</span>
                ))
            ) : (
              <span>未到達</span>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function BoardView({
  state,
  playableMoves,
  bookMoves,
  onPlay,
}: {
  state: TrainerState;
  playableMoves: Set<string>;
  bookMoves: Set<string>;
  onPlay: (coord: string) => void;
}) {
  return (
    <div className="board-wrap">
      <div className="board">
        {state.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const coord = pointToCoord(rowIndex, colIndex);
            const canPlay = playableMoves.has(coord);
            const isBook = bookMoves.has(coord);
            return (
              <button
                aria-label={coord}
                className={`square ${canPlay ? "playable" : ""} ${isBook ? "book" : ""}`}
                disabled={!canPlay || state.status !== "playing"}
                key={coord}
                type="button"
                onClick={() => onPlay(coord)}
              >
                <span className="coord">{coord}</span>
                {cell ? <span className={`stone ${cell}`} /> : null}
                {!cell && canPlay ? <span className="hint" /> : null}
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
