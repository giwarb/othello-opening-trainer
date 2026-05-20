import { describe, expect, it } from "vitest";
import { JOSEKI_LIST } from "../data/joseki";
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
    // nezumi: f5 f4 e3 (user=black plays f5, e3; computer plays f4)
    let state = startTrainer(nezumi);
    state = playPlayerMove(state, "f5");
    expect(state.status).toBe("playing");
    state = playComputerMove(state);
    expect(state.moves).toEqual(["f5", "f4"]);
    state = playPlayerMove(state, "e3");
    expect(state.status).toBe("success");
  });

  it("failure when player leaves joseki", () => {
    const state = startTrainer(nezumi);
    const failed = playPlayerMove(state, "d3"); // wrong first move
    expect(failed.status).toBe("failure");
    expect(failed.correctMove).toBe("f5");
  });

  it("ignores illegal Othello moves silently", () => {
    const state = startTrainer(nezumi);
    const same = playPlayerMove(state, "a1"); // not a legal Othello move
    expect(same.status).toBe("playing");
    expect(same.moves).toEqual([]);
  });

  it("succeeds when all moves of joseki are played", () => {
    let state = startTrainer(tori);
    for (const move of tori.moves) {
      if (state.status !== "playing") break;
      if (state.moves.length % 2 === 0) {
        // black's turn (computer for white joseki)
        state = playComputerMove(state);
      } else {
        state = playPlayerMove(state, move);
      }
    }
    expect(state.status).toBe("success");
  });
});
