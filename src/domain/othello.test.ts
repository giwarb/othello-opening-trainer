import { describe, expect, it } from "vitest";
import {
  applyMove,
  boardFromMoves,
  discCounts,
  initialBoard,
  legalMoves,
} from "./othello";

describe("othello rules", () => {
  it("finds the standard initial legal moves for black", () => {
    expect(legalMoves(initialBoard(), "black").sort()).toEqual([
      "c4",
      "d3",
      "e6",
      "f5",
    ]);
  });

  it("applies flips after a move", () => {
    const board = applyMove(initialBoard(), "f5", "black");
    expect(discCounts(board)).toEqual({ black: 4, white: 1 });
  });

  it("can replay a known opening prefix", () => {
    const board = boardFromMoves(["f5", "d6", "c3", "d3", "c4"]);
    expect(discCounts(board).black + discCounts(board).white).toBe(9);
  });
});
