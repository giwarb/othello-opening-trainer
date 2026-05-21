import { describe, expect, it } from "vitest";
import { JOSEKI_LIST } from "../data/joseki";
import { applyMove, colorForPly, initialBoard } from "./othello";
import { playComputerMove, playPlayerMove, startTrainer } from "./trainer";

function mustFindJoseki(id: string) {
  const joseki = JOSEKI_LIST.find((j) => j.id === id);
  if (!joseki) throw new Error(`Missing joseki fixture: ${id}`);
  return joseki;
}

const tori = mustFindJoseki("tori");
const nezumi = mustFindJoseki("nezumi");

describe("trainer", () => {
  it("all joseki start with f5", () => {
    expect(JOSEKI_LIST.every((j) => j.moves[0] === "f5")).toBe(true);
  });

  it("all joseki have at least six moves", () => {
    expect(JOSEKI_LIST.every((j) => j.moves.length >= 6)).toBe(true);
  });

  it("all joseki lines are legal Othello move sequences", () => {
    for (const joseki of JOSEKI_LIST) {
      let board = initialBoard();
      for (const [ply, move] of joseki.moves.entries()) {
        expect(
          () => {
            board = applyMove(board, move, colorForPly(ply));
          },
          `${joseki.id} failed at move ${ply + 1}: ${move}`,
        ).not.toThrow();
      }
    }
  });

  it("does not branch on the player's own turn", () => {
    const violations: string[] = [];

    for (const playerSide of ["black", "white"] as const) {
      const josekiForSide = JOSEKI_LIST.filter((j) => j.color === playerSide);
      const maxLength = Math.max(...josekiForSide.map((j) => j.moves.length));

      for (let ply = 0; ply < maxLength; ply += 1) {
        if (colorForPly(ply) !== playerSide) continue;

        const movesByPrefix = new Map<string, Map<string, string[]>>();
        for (const joseki of josekiForSide) {
          if (joseki.moves.length <= ply) continue;
          const prefix = joseki.moves.slice(0, ply).join(" ");
          const move = joseki.moves[ply];
          const moveMap =
            movesByPrefix.get(prefix) ?? new Map<string, string[]>();
          moveMap.set(move, [...(moveMap.get(move) ?? []), joseki.id]);
          movesByPrefix.set(prefix, moveMap);
        }

        for (const [prefix, moveMap] of movesByPrefix) {
          if (moveMap.size <= 1) continue;
          const choices = [...moveMap]
            .map(([move, ids]) => `${move}: ${ids.join(", ")}`)
            .join(" / ");
          violations.push(
            `${playerSide} ply ${ply + 1} after [${prefix}]: ${choices}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("starts in playing state", () => {
    const state = startTrainer(tori);
    expect(state.status).toBe("playing");
    expect(state.moves).toEqual([]);
    expect(state.playerSide).toBe("white");
  });

  it("computer plays first move for white-side joseki", () => {
    const state = startTrainer(tori);
    const next = playComputerMove(state);
    expect(next.moves).toEqual(["f5"]);
    expect(next.status).toBe("playing");
  });

  it("player succeeds on correct joseki sequence (black side)", () => {
    let state = startTrainer(nezumi);
    for (const move of nezumi.moves) {
      if (state.status !== "playing") break;
      if (state.moves.length % 2 === 0) {
        state = playPlayerMove(state, move);
      } else {
        state = playComputerMove(state);
      }
    }
    expect(state.status).toBe("success");
  });

  it("failure when player leaves joseki", () => {
    const state = startTrainer(nezumi);
    const failed = playPlayerMove(state, "d3");
    expect(failed.status).toBe("failure");
    expect(failed.correctMove).toBe("f5");
  });

  it("ignores illegal Othello moves silently", () => {
    const state = startTrainer(nezumi);
    const same = playPlayerMove(state, "a1");
    expect(same.status).toBe("playing");
    expect(same.moves).toEqual([]);
  });

  it("succeeds when all moves of joseki are played", () => {
    let state = startTrainer(tori);
    for (const move of tori.moves) {
      if (state.status !== "playing") break;
      if (state.moves.length % 2 === 0) {
        state = playComputerMove(state);
      } else {
        state = playPlayerMove(state, move);
      }
    }
    expect(state.status).toBe("success");
  });
});
