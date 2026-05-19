import {
  createOpeningTree,
  findNode,
  type OpeningNode,
  type OpeningRecord,
  openings,
} from "./openings";
import { applyMove, type Board, colorForPly, initialBoard } from "./othello";

export type PlayerSide = "black" | "white";
export type TrainerMode =
  | { kind: "fixed"; opening: OpeningRecord }
  | { kind: "free"; tree: OpeningNode };

export type TrainerStatus = "playing" | "success" | "failure";

export type TrainerState = {
  board: Board;
  moves: string[];
  playerSide: PlayerSide;
  mode: TrainerMode;
  status: TrainerStatus;
  message: string;
  currentOpenings: OpeningRecord[];
};

export type Rng = () => number;

const rootTree = createOpeningTree(openings);

export function startTrainer(
  playerSide: PlayerSide,
  mode: TrainerMode,
  rng: Rng = Math.random,
): TrainerState {
  const state: TrainerState = {
    board: initialBoard(),
    moves: [],
    playerSide,
    mode,
    status: "playing",
    message: "開始",
    currentOpenings: [],
  };
  return maybeComputerMove(state, rng);
}

export function playPlayerMove(
  state: TrainerState,
  move: string,
  rng: Rng = Math.random,
): TrainerState {
  if (state.status !== "playing") {
    return state;
  }
  if (colorForPly(state.moves.length) !== state.playerSide) {
    return { ...state, status: "failure", message: "相手番です" };
  }

  const normalized = move.toLowerCase();
  const validation = validateMove(state, normalized);
  if (!validation.ok) {
    return { ...state, status: "failure", message: validation.message };
  }

  const next = applyKnownMove(state, normalized);
  return maybeComputerMove(checkTerminal(next), rng);
}

export function expectedMoves(state: TrainerState): string[] {
  if (state.mode.kind === "fixed") {
    const expected = state.mode.opening.moves[state.moves.length];
    return expected ? [expected] : [];
  }
  const node = findNode(state.mode.tree, state.moves);
  return node ? [...node.children.keys()] : [];
}

export function currentFreeOpenings(state: TrainerState): OpeningRecord[] {
  const tree = state.mode.kind === "free" ? state.mode.tree : rootTree;
  const node = findNode(tree, state.moves);
  return node?.terminalOpenings ?? [];
}

function maybeComputerMove(state: TrainerState, rng: Rng): TrainerState {
  if (state.status !== "playing") {
    return state;
  }
  if (colorForPly(state.moves.length) === state.playerSide) {
    return checkTerminal(state);
  }

  const options = expectedMoves(state);
  if (options.length === 0) {
    return {
      ...state,
      status: "success",
      message: "定石の終端まで到達しました",
    };
  }
  const choice = options[Math.floor(rng() * options.length)] ?? options[0];
  return maybeComputerMove(checkTerminal(applyKnownMove(state, choice)), rng);
}

function applyKnownMove(state: TrainerState, move: string): TrainerState {
  try {
    const board = applyMove(state.board, move, colorForPly(state.moves.length));
    const moves = [...state.moves, move];
    const currentOpenings =
      state.mode.kind === "free"
        ? (findNode(state.mode.tree, moves)?.terminalOpenings ?? [])
        : [];
    return {
      ...state,
      board,
      moves,
      currentOpenings,
      message: `${move} を着手`,
    };
  } catch {
    return {
      ...state,
      status: "failure",
      message: `${move} はこの盤面では合法手ではありません`,
    };
  }
}

function validateMove(
  state: TrainerState,
  move: string,
): { ok: true } | { ok: false; message: string } {
  const options = expectedMoves(state);
  if (!options.includes(move)) {
    return {
      ok: false,
      message:
        state.mode.kind === "fixed"
          ? "選択した定石と違う手です"
          : "収録定石にない手です",
    };
  }
  return { ok: true };
}

function checkTerminal(state: TrainerState): TrainerState {
  if (state.status !== "playing") {
    return state;
  }
  if (state.mode.kind === "fixed") {
    if (state.moves.length >= state.mode.opening.moves.length) {
      return { ...state, status: "success", message: "定石を完走しました" };
    }
    return state;
  }

  const node = findNode(state.mode.tree, state.moves);
  if (!node) {
    return { ...state, status: "failure", message: "収録定石から外れました" };
  }
  if (node.children.size === 0 && node.terminalOpenings.length > 0) {
    return { ...state, status: "success", message: "展開先のない終端です" };
  }
  return state;
}

export { rootTree };
