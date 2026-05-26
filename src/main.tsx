import {
  ArrowLeft,
  CheckCircle2,
  Music2,
  RefreshCw,
  Shuffle,
  TrendingDown,
  Undo2,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { JOSEKI_LIST, type Joseki } from "./data/joseki";
import { AudioEngine } from "./domain/audio";
import {
  type Board,
  type Cell,
  colorForPly,
  discCounts,
  getFlips,
  legalMoves,
  pointToCoord,
} from "./domain/othello";
import {
  addRecord,
  buildStats,
  getRecords,
  type JosekiRecord,
  type JosekiStats,
} from "./domain/storage";
import { buildStrategyPlan } from "./domain/strategy";
import {
  playComputerMove,
  playPlayerMove,
  startTrainer,
  type TrainerState,
} from "./domain/trainer";

type Phase = "home" | "animating" | "practice" | "result";
type AnimatingCells = { placed: Set<string>; flipped: Set<string> };

const sleep = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [phase, setPhase] = useState<Phase>("home");
  const [selectedJoseki, setSelectedJoseki] = useState<Joseki | null>(null);
  const [state, setState] = useState<TrainerState | null>(null);
  const [history, setHistory] = useState<TrainerState[]>([]);
  const [animatingCells, setAnimatingCells] = useState<AnimatingCells>({
    placed: new Set(),
    flipped: new Set(),
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [records, setRecords] = useState<JosekiRecord[]>(getRecords);
  const [resultHadMistake, setResultHadMistake] = useState(false);
  const stateRef = useRef<TrainerState | null>(null);
  const sessionHasMistake = useRef(false);
  const audioRef = useRef<AudioEngine | null>(null);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() =>
    readBooleanSetting("othello_se_enabled", true),
  );
  const [musicEnabled, setMusicEnabled] = useState(() =>
    readBooleanSetting("othello_music_enabled", false),
  );

  function getAudio() {
    audioRef.current ??= new AudioEngine();
    audioRef.current.setSoundEffectsEnabled(soundEffectsEnabled);
    audioRef.current.setMusicEnabled(musicEnabled);
    return audioRef.current;
  }

  function toggleSoundEffects() {
    setSoundEffectsEnabled((enabled) => {
      const next = !enabled;
      localStorage.setItem("othello_se_enabled", String(next));
      getAudio().setSoundEffectsEnabled(next);
      if (next) void getAudio().playPlace();
      return next;
    });
  }

  function toggleMusic() {
    setMusicEnabled((enabled) => {
      const next = !enabled;
      localStorage.setItem("othello_music_enabled", String(next));
      getAudio().setMusicEnabled(next);
      return next;
    });
  }

  useEffect(() => {
    audioRef.current ??= new AudioEngine();
    audioRef.current.setSoundEffectsEnabled(soundEffectsEnabled);
  }, [soundEffectsEnabled]);

  useEffect(() => {
    audioRef.current ??= new AudioEngine();
    audioRef.current.setMusicEnabled(musicEnabled);
  }, [musicEnabled]);

  function refreshRecords() {
    setRecords(getRecords());
  }

  const stats = useMemo(() => {
    const map = new Map<string, JosekiStats>();
    for (const j of JOSEKI_LIST) {
      map.set(j.id, buildStats(j.id, records));
    }
    return map;
  }, [records]);

  function launchJoseki(joseki: Joseki) {
    sessionHasMistake.current = false;
    setSelectedJoseki(joseki);
    setPhase("animating");
  }

  function startByMode(mode: "today" | "worst3") {
    if (mode === "today") {
      const pending = JOSEKI_LIST.filter((j) => !stats.get(j.id)?.clearedToday);
      if (pending.length === 0) {
        alert("今日は全定石をクリアしました！おつかれさまです！");
        return;
      }
      launchJoseki(pending[Math.floor(Math.random() * pending.length)]);
    } else {
      const sorted = [...JOSEKI_LIST].sort((a, b) => {
        const ra = getJosekiStats(stats, a.id).successRate;
        const rb = getJosekiStats(stats, b.id).successRate;
        const na = Number.isNaN(ra) ? -1 : ra;
        const nb = Number.isNaN(rb) ? -1 : rb;
        return na - nb;
      });
      const top3 = sorted.slice(0, 3);
      launchJoseki(top3[Math.floor(Math.random() * top3.length)]);
    }
  }

  async function handleAnimationDone() {
    const joseki = selectedJoseki;
    if (!joseki) return;
    const initial = startTrainer(joseki);
    commitState(initial);
    setHistory([]);
    setAnimatingCells({ placed: new Set(), flipped: new Set() });
    setPhase("practice");

    if (joseki.color === "white") {
      await sleep(350);
      await driveComputerMoves(initial);
    }
  }

  async function driveComputerMoves(base: TrainerState): Promise<TrainerState> {
    let cur = base;
    while (
      cur.status === "playing" &&
      colorForPly(cur.moves.length) !== cur.playerSide
    ) {
      const move = cur.joseki.moves[cur.moves.length];
      if (!move) break;
      cur = await animateMove(cur, move, "computer");
      if (cur.status !== "playing") break;
      await sleep(160);
    }
    return cur;
  }

  async function play(coord: string) {
    const current = stateRef.current;
    if (!current || isAnimating || current.status !== "playing") return;
    if (colorForPly(current.moves.length) !== current.playerSide) return;

    setHistory((items) => [...items, current]);

    const next = await animateMove(current, coord, "player");

    if (next.status === "failure") {
      sessionHasMistake.current = true;
      addRecord(next.joseki.id, "failure");
      refreshRecords();
      return;
    }

    if (next.status === "success") {
      await handleSuccess(next);
      return;
    }

    const afterComputer = await driveComputerMoves(next);
    if (afterComputer.status === "success") {
      await handleSuccess(afterComputer);
    }
  }

  async function handleSuccess(s: TrainerState) {
    const hadMistake = sessionHasMistake.current;
    if (!hadMistake) {
      addRecord(s.joseki.id, "success");
      refreshRecords();
    }
    setResultHadMistake(hadMistake);
    await sleep(400);
    setPhase("result");
  }

  async function animateMove(
    base: TrainerState,
    move: string,
    actor: "player" | "computer",
  ): Promise<TrainerState> {
    setIsAnimating(true);
    const color = colorForPly(base.moves.length);
    const flips = getFlips(base.board, move, color);

    await getAudio().playPlace();
    commitState({
      ...base,
      board: boardWithCell(base.board, move, color),
    });
    setAnimatingCells({ placed: new Set([move]), flipped: new Set() });
    await sleep(280);

    const finalState =
      actor === "player" ? playPlayerMove(base, move) : playComputerMove(base);

    const msgOverride =
      actor === "player"
        ? finalState.status === "failure"
          ? `間違い！正解は ${finalState.correctMove ?? "?"}`
          : `${move} を着手`
        : `相手が ${move} を着手`;

    commitState({ ...finalState, message: msgOverride });
    await getAudio().playFlip(flips.length);
    setAnimatingCells({ placed: new Set(), flipped: new Set(flips) });
    await sleep(440);
    setAnimatingCells({ placed: new Set(), flipped: new Set() });
    setIsAnimating(false);
    return stateRef.current ?? finalState;
  }

  function undo() {
    setHistory((items) => {
      const prev = items.at(-1);
      if (!prev) return items;
      commitState(prev);
      setAnimatingCells({ placed: new Set(), flipped: new Set() });
      return items.slice(0, -1);
    });
  }

  function commitState(next: TrainerState | null) {
    stateRef.current = next;
    setState(next);
  }

  function backToHome() {
    setPhase("home");
    commitState(null);
    setHistory([]);
    refreshRecords();
  }

  async function restartCurrent() {
    if (!selectedJoseki) return;
    sessionHasMistake.current = false;
    setPhase("animating");
  }

  return (
    <main className="app-shell">
      <AudioControls
        musicEnabled={musicEnabled}
        soundEffectsEnabled={soundEffectsEnabled}
        onToggleMusic={toggleMusic}
        onToggleSoundEffects={toggleSoundEffects}
      />
      {phase === "home" && (
        <HomeScreen
          stats={stats}
          onLaunch={launchJoseki}
          onStartMode={startByMode}
        />
      )}
      {phase === "animating" && selectedJoseki && (
        <AnimatingScreen joseki={selectedJoseki} onDone={handleAnimationDone} />
      )}
      {phase === "practice" && state && (
        <PracticeScreen
          animatingCells={animatingCells}
          historyLength={history.length}
          isAnimating={isAnimating}
          state={state}
          onBackToHome={backToHome}
          onPlay={play}
          onRestart={restartCurrent}
          onUndo={undo}
        />
      )}
      {phase === "result" && state && (
        <ResultScreen
          hadMistake={resultHadMistake}
          state={state}
          onBackToHome={backToHome}
          onPlayAgain={restartCurrent}
        />
      )}
    </main>
  );
}

function AudioControls({
  musicEnabled,
  soundEffectsEnabled,
  onToggleMusic,
  onToggleSoundEffects,
}: {
  musicEnabled: boolean;
  soundEffectsEnabled: boolean;
  onToggleMusic: () => void;
  onToggleSoundEffects: () => void;
}) {
  return (
    <fieldset className="audio-controls">
      <legend className="sr-only">音量設定</legend>
      <button
        className={soundEffectsEnabled ? "audio-btn active" : "audio-btn"}
        title="効果音"
        type="button"
        onClick={onToggleSoundEffects}
      >
        {soundEffectsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        <span>SE</span>
      </button>
      <button
        className={musicEnabled ? "audio-btn active" : "audio-btn"}
        title="バックミュージック"
        type="button"
        onClick={onToggleMusic}
      >
        <Music2 size={18} />
        <span>BGM</span>
      </button>
    </fieldset>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────────────────────────────────────
function HomeScreen({
  stats,
  onLaunch,
  onStartMode,
}: {
  stats: Map<string, JosekiStats>;
  onLaunch: (joseki: Joseki) => void;
  onStartMode: (mode: "today" | "worst3") => void;
}) {
  const whiteJoseki = JOSEKI_LIST.filter((j) => j.color === "white");
  const blackJoseki = JOSEKI_LIST.filter((j) => j.color === "black");

  const todayClearedCount = JOSEKI_LIST.filter(
    (j) => stats.get(j.id)?.clearedToday,
  ).length;

  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="home-title-block">
          <h1>オセロ定石修業</h1>
          <p>
            定石を覚えて、毎日クリアを目指そう —{" "}
            <strong>
              {todayClearedCount} / {JOSEKI_LIST.length}
            </strong>{" "}
            本日クリア
          </p>
        </div>
      </header>

      <div className="home-modes">
        <button
          className="mode-btn today"
          type="button"
          onClick={() => onStartMode("today")}
        >
          <Shuffle size={20} />
          <span>
            <strong>今日未クリアからランダム</strong>
            <small>まだ正解していない定石を練習</small>
          </span>
        </button>
        <button
          className="mode-btn worst"
          type="button"
          onClick={() => onStartMode("worst3")}
        >
          <TrendingDown size={20} />
          <span>
            <strong>正解率ワースト3からランダム</strong>
            <small>苦手な定石を集中練習</small>
          </span>
        </button>
      </div>

      <div className="joseki-catalog">
        <JosekiGroup
          label="白番の定石"
          items={whiteJoseki}
          stats={stats}
          onLaunch={onLaunch}
        />
        <JosekiGroup
          label="黒番の定石"
          items={blackJoseki}
          stats={stats}
          onLaunch={onLaunch}
        />
      </div>
    </div>
  );
}

function JosekiGroup({
  label,
  items,
  stats,
  onLaunch,
}: {
  label: string;
  items: Joseki[];
  stats: Map<string, JosekiStats>;
  onLaunch: (joseki: Joseki) => void;
}) {
  return (
    <section className="joseki-group">
      <h2 className="group-label">{label}</h2>
      <div className="joseki-grid">
        {items.map((j) => (
          <JosekiCard
            key={j.id}
            joseki={j}
            stats={getJosekiStats(stats, j.id)}
            onLaunch={onLaunch}
          />
        ))}
      </div>
    </section>
  );
}

function JosekiCard({
  joseki,
  stats,
  onLaunch,
}: {
  joseki: Joseki;
  stats: JosekiStats;
  onLaunch: (joseki: Joseki) => void;
}) {
  const rateText = Number.isNaN(stats.successRate)
    ? "未挑戦"
    : `${Math.round(stats.successRate * 100)}%`;

  return (
    <div className={`joseki-card ${stats.clearedToday ? "cleared" : ""}`}>
      <div className="jcard-head">
        <span className={`color-badge ${joseki.color}`}>
          {joseki.color === "white" ? "白" : "黒"}
        </span>
        <strong className="jcard-name">{joseki.name}</strong>
        {stats.clearedToday && (
          <span className="today-badge" title="本日クリア済">
            <CheckCircle2 size={16} />
          </span>
        )}
      </div>
      <code className="jcard-seq">{joseki.moves.join(" ")}</code>
      <div className="jcard-stats">
        <span className="stat-ok">✓ {stats.totalSuccess}</span>
        <span className="stat-ng">✗ {stats.totalFailure}</span>
        <span className="stat-rate">{rateText}</span>
      </div>
      <button
        className="jcard-btn"
        type="button"
        onClick={() => onLaunch(joseki)}
      >
        練習
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AnimatingScreen  ("あなたは{黒/白}番です")
// ─────────────────────────────────────────────────────────────────────────────
function AnimatingScreen({
  joseki,
  onDone,
}: {
  joseki: Joseki;
  onDone: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 2300);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div className="announce-screen">
      <p className="announce-text">
        あなたは
        <span className={`announce-badge ${joseki.color}`}>
          {joseki.color === "white" ? "白" : "黒"}
        </span>
        番です
      </p>
      <p className="announce-sub">{joseki.name}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PracticeScreen
// ─────────────────────────────────────────────────────────────────────────────
function PracticeScreen({
  animatingCells,
  historyLength,
  isAnimating,
  state,
  onBackToHome,
  onPlay,
  onRestart,
  onUndo,
}: {
  animatingCells: AnimatingCells;
  historyLength: number;
  isAnimating: boolean;
  state: TrainerState;
  onBackToHome: () => void;
  onPlay: (coord: string) => void;
  onRestart: () => void;
  onUndo: () => void;
}) {
  const counts = discCounts(state.board);
  const ply = state.moves.length;
  const currentColor = colorForPly(ply);
  const isPlayerTurn =
    state.status === "playing" &&
    currentColor === state.playerSide &&
    !isAnimating;

  const playableMoves = isPlayerTurn
    ? new Set(legalMoves(state.board, state.playerSide))
    : new Set<string>();

  const colorLabel = state.playerSide === "white" ? "白番" : "黒番";

  return (
    <section className="practice-layout">
      <div className="practice-top">
        <button className="ghost-action" type="button" onClick={onBackToHome}>
          <ArrowLeft size={18} />
          ホームへ
        </button>
        <div className="practice-info">
          <span className={`color-badge ${state.playerSide}`}>
            {colorLabel}
          </span>
          <strong>{state.joseki.name}</strong>
        </div>
        <button className="ghost-action" type="button" onClick={onRestart}>
          <RefreshCw size={18} />
          最初から
        </button>
      </div>

      <div className="board-zone">
        <div className="status-line">
          <div>
            <span className={`status-pill ${state.status}`}>
              {statusLabel(state)}
            </span>
            <p>{state.message}</p>
          </div>
          <div className="score">
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

        {state.status === "failure" && (
          <div className="failure-panel">
            <strong>
              <XCircle size={22} />
              間違い！
            </strong>
            <span>
              正解は <kbd>{state.correctMove}</kbd> でした
            </span>
            <button
              className="primary-action"
              disabled={historyLength === 0}
              type="button"
              onClick={onUndo}
            >
              <Undo2 size={18} />
              元に戻す
            </button>
          </div>
        )}

        <div className="move-strip">
          {state.moves.map((move, index) => (
            <span
              key={`${move}-${index}`}
              className={index % 2 === 0 ? "black-move" : "white-move"}
            >
              {index + 1}.{move}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BoardView
// ─────────────────────────────────────────────────────────────────────────────
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
                disabled={!canPlay}
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

function StaticBoard({ board }: { board: Board }) {
  return (
    <div className="board-wrap">
      <div className="board">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const coord = pointToCoord(rowIndex, colIndex);
            return (
              <span className="square static-square" key={coord}>
                <span className="coord">{coord}</span>
                {cell ? <span className={`stone ${cell}`} /> : null}
              </span>
            );
          }),
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultScreen
// ─────────────────────────────────────────────────────────────────────────────
function ResultScreen({
  hadMistake,
  state,
  onBackToHome,
  onPlayAgain,
}: {
  hadMistake: boolean;
  state: TrainerState;
  onBackToHome: () => void;
  onPlayAgain: () => void;
}) {
  const message = hadMistake
    ? "完走しましたが失敗がありました"
    : resultMessage(state.joseki);
  const counts = discCounts(state.board);
  const strategyPlan = buildStrategyPlan(state.board, state.joseki);
  const strategyCounts = discCounts(strategyPlan.board);

  return (
    <div className="result-screen">
      <div className={`result-card ${hadMistake ? "had-mistake" : "clean"}`}>
        <p className="result-message">{message}</p>
        {!hadMistake && (
          <p className="result-seq">{state.joseki.moves.join(" › ")}</p>
        )}
        {hadMistake && (
          <p className="result-hint">
            「最初からやり直す」でミスなしクリアを目指しましょう！
          </p>
        )}
        <div className="result-details">
          <section className="result-board-section" aria-label="最後の盤面">
            <div className="result-section-head">
              <span>最後の盤面</span>
              <div className="score result-score">
                <span className="disc black" />
                {counts.black}
                <span className="disc white" />
                {counts.white}
              </div>
            </div>
            <BoardView
              animatingCells={{ placed: new Set(), flipped: new Set() }}
              playableMoves={new Set()}
              state={state}
              onPlay={() => undefined}
            />
          </section>
          <section className="result-board-section" aria-label="この先の狙い図">
            <div className="result-section-head">
              <span>この先の狙い図</span>
              <div className="score result-score">
                <span className="disc black" />
                {strategyCounts.black}
                <span className="disc white" />
                {strategyCounts.white}
              </div>
            </div>
            <StaticBoard board={strategyPlan.board} />
            <div className="plan-strip">
              {strategyPlan.moves.map((move, index) => (
                <span
                  key={`${move.color}-${move.move}-${index}`}
                  className={
                    move.color === "black" ? "black-move" : "white-move"
                  }
                >
                  {move.color === "black" ? "黒" : "白"}
                  {move.move}
                </span>
              ))}
            </div>
          </section>
          <section className="result-explanation">
            <span className="result-section-headline">この定石の狙い</span>
            <p>{state.joseki.explanation.aim}</p>
            <span className="result-section-headline">図の見方</span>
            <p>{strategyPlan.note}</p>
            <span className="result-section-headline">
              この後に意識すること
            </span>
            <ul>
              {state.joseki.explanation.followUp.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </section>
        </div>
        <div className="result-actions">
          <button
            className="primary-action result-again"
            type="button"
            onClick={onPlayAgain}
          >
            <RefreshCw size={18} />
            最初からやり直す
          </button>
          <button className="ghost-action" type="button" onClick={onBackToHome}>
            <ArrowLeft size={18} />
            ホームへ
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────
function resultMessage(joseki: Joseki): string {
  if (joseki.color === "white") {
    if (joseki.id === "tori") return "酉定石完成！";
    return `応手成功！${joseki.name}`;
  }
  return `${joseki.name}完成！`;
}

function getJosekiStats(
  stats: Map<string, JosekiStats>,
  josekiId: string,
): JosekiStats {
  return (
    stats.get(josekiId) ?? {
      josekiId,
      totalSuccess: 0,
      totalFailure: 0,
      totalAttempts: 0,
      clearedToday: false,
      successRate: Number.NaN,
    }
  );
}

function statusLabel(state: TrainerState): string {
  if (state.status === "success") return "成功";
  if (state.status === "failure") return "失敗";
  return colorForPly(state.moves.length) === "black" ? "黒番" : "白番";
}

function boardWithCell(board: Board, move: string, cell: Cell): Board {
  const next = board.map((row) => [...row]);
  const col = "abcdefgh".indexOf(move[0]);
  const row = Number(move.slice(1)) - 1;
  next[row][col] = cell;
  return next;
}

function readBooleanSetting(key: string, fallback: boolean) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
const root = document.getElementById("root");
if (!root) throw new Error("Root element was not found");
createRoot(root).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}
