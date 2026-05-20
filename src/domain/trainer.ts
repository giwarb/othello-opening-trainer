import type { Joseki } from "../data/joseki";
import {
  applyMove,
  type Board,
  colorForPly,
  getFlips,
  initialBoard,
} from "./othello";

export type PlayerSide = "black" | "white";
export type TrainerStatus = "playing" | "success" | "failure";

export type TrainerState = {
  board: Board;
  moves: string[];
  playerSide: PlayerSide;
  joseki: Joseki;
  status: TrainerStatus;
  message: string;
  correctMove?: string; // correct joseki move when status=failure
};

export function startTrainer(joseki: Joseki): TrainerState {
  return {
    board: initialBoard(),
    moves: [],
    playerSide: joseki.color,
    joseki,
    status: "playing",
    message: "開始",
  };
}

export function playPlayerMove(
  state: TrainerState,
  move: string,
): TrainerState {
  if (state.status !== "playing") return state;

  const ply = state.moves.length;
  const color = colorForPly(ply);
  if (color !== state.playerSide) return state; // not player's turn

  const normalized = move.toLowerCase();

  // Silently ignore illegal Othello moves
  if (getFlips(state.board, normalized, color).length === 0) return state;

  const expected = state.joseki.moves[ply];

  if (normalized !== expected) {
    // Wrong joseki move – apply it so user can see, then they must undo
    try {
      const board = applyMove(state.board, normalized, color);
      return {
        ...state,
        board,
        moves: [...state.moves, normalized],
        status: "failure",
        message: "定石から外れました",
        correctMove: expected,
      };
    } catch {
      return {
        ...state,
        status: "failure",
        message: "定石から外れました",
        correctMove: expected,
      };
    }
  }

  // Correct move
  try {
    const board = applyMove(state.board, normalized, color);
    const moves = [...state.moves, normalized];
    if (moves.length >= state.joseki.moves.length) {
      return { ...state, board, moves, status: "success", message: "定石完成！" };
    }
    return { ...state, board, moves, status: "playing", message: `${normalized} を着手` };
  } catch {
    return { ...state, status: "failure", message: "合法手ではありません", correctMove: expected };
  }
}

export function playComputerMove(state: TrainerState): TrainerState {
  if (state.status !== "playing") return state;

  const ply = state.moves.length;
  const color = colorForPly(ply);
  if (color === state.playerSide) return state; // player's turn

  const move = state.joseki.moves[ply];
  if (!move) {
    return { ...state, status: "success", message: "定石完成！" };
  }

  try {
    const board = applyMove(state.board, move, color);
    const moves = [...state.moves, move];
    if (moves.length >= state.joseki.moves.length) {
      return { ...state, board, moves, status: "success", message: "定石完成！" };
    }
    return { ...state, board, moves, status: "playing", message: `相手が ${move} を着手` };
  } catch {
    // Should not happen with valid joseki data
    return { ...state, status: "failure", message: `無効な手: ${move}` };
  }
}

/** Expected joseki move at the current ply, or undefined */
export function expectedMove(state: TrainerState): string | undefined {
  return state.joseki.moves[state.moves.length];
}
