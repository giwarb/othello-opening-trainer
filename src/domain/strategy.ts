import type { Joseki } from "../data/joseki";
import {
  applyMove,
  type Board,
  type Color,
  discCounts,
  legalMoves,
  opponent,
} from "./othello";

export type PlanMove = {
  color: Color;
  move: string;
};

export type StrategyPlan = {
  board: Board;
  moves: PlanMove[];
  note: string;
};

const stableShapeTerms = ["山", "ウィング", "爆弾", "X", "C"];

export function buildStrategyPlan(board: Board, joseki: Joseki): StrategyPlan {
  const moves: PlanMove[] = [];
  let current = board;
  let color: Color = opponent(joseki.color);

  for (let turn = 0; turn < 4; turn += 1) {
    const move = chooseIllustrativeMove(current, color, joseki.color);
    if (!move) break;
    current = applyMove(current, move, color);
    moves.push({ color, move });
    color = opponent(color);
  }

  return {
    board: current,
    moves,
    note: buildStrategyNote(joseki.color, moves),
  };
}

function chooseIllustrativeMove(
  board: Board,
  color: Color,
  playerSide: Color,
): string | null {
  const moves = legalMoves(board, color);
  if (moves.length === 0) return null;

  const scored = moves.map((move) => {
    const next = applyMove(board, move, color);
    const counts = discCounts(next);
    const mobility =
      legalMoves(next, color).length - legalMoves(next, opponent(color)).length;
    const playerSign = color === playerSide ? 1 : -1;
    return {
      move,
      score:
        playerSign * (counts[playerSide] - counts[opponent(playerSide)]) +
        mobility * 1.8 +
        shapeBonus(move, color === playerSide),
    };
  });

  scored.sort((a, b) => b.score - a.score || a.move.localeCompare(b.move));
  return scored[0].move;
}

function shapeBonus(move: string, isPlayerMove: boolean): number {
  const file = move[0];
  const rank = move[1];
  const isCorner = ["a1", "a8", "h1", "h8"].includes(move);
  const isX = ["b2", "b7", "g2", "g7"].includes(move);
  const isC = ["a2", "b1", "a7", "b8", "g1", "h2", "g8", "h7"].includes(move);
  const isEdge = file === "a" || file === "h" || rank === "1" || rank === "8";
  const isCenter =
    ["c", "d", "e", "f"].includes(file) && ["3", "4", "5", "6"].includes(rank);

  if (isCorner) return isPlayerMove ? 18 : -18;
  if (isX) return isPlayerMove ? -14 : 10;
  if (isC) return isPlayerMove ? -8 : 6;
  if (isCenter) return 5;
  if (isEdge) return 2;
  return 0;
}

function buildStrategyNote(playerSide: Color, moves: PlanMove[]) {
  const sideLabel = playerSide === "black" ? "黒" : "白";
  const ownMoves = moves
    .filter((move) => move.color === playerSide)
    .map((move) => move.move);
  const firstOwnMove = ownMoves[0] ?? "次の一手";
  const terms = stableShapeTerms.join("・");

  return `${sideLabel}番は、ここから ${firstOwnMove} のような中央に近い手や相手の好点を消す手を見ます。狙いは、相手に楽な辺を作らせず、必要なら ${terms} の形も見ながら、終盤で使える手を残すことです。`;
}
