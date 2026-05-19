import { describe, expect, it } from "vitest";
import { createOpeningTree, openings } from "./openings";
import {
  chooseComputerMove,
  expectedMoves,
  playComputerMove,
  playPlayerMove,
  startTrainer,
  type TrainerMode,
} from "./trainer";

const tiger = openings.find(
  (opening) =>
    opening.primary_name === "Tiger" && opening.sequence === "F5d6C3d3C4",
);

if (!tiger) {
  throw new Error("Expected Tiger opening fixture to exist");
}

describe("trainer", () => {
  it("normalizes openings so the first move is f5", () => {
    expect(openings.every((opening) => opening.moves[0] === "f5")).toBe(true);
  });

  it("deduplicates openings by normalized move sequence", () => {
    const sequences = openings.map((opening) => opening.moves.join(""));
    expect(new Set(sequences).size).toBe(openings.length);
    expect(openings.length).toBeLessThan(623);
  });

  it("can play a computer move when player chooses white", () => {
    const state = startTrainer("white", { kind: "fixed", opening: tiger });
    const next = playComputerMove(state, () => 0);
    expect(next.moves).toEqual(["f5"]);
    expect(expectedMoves(next)).toEqual(["d6"]);
  });

  it("fails when fixed-mode player leaves the selected opening", () => {
    const state = startTrainer("black", { kind: "fixed", opening: tiger });
    const failed = playPlayerMove(state, "c4");
    expect(failed.status).toBe("failure");
    expect(failed.message).toContain("違う手");
  });

  it("succeeds when the fixed opening reaches its terminal move", () => {
    let state = startTrainer("black", { kind: "fixed", opening: tiger });
    state = playPlayerMove(state, "f5");
    state = playComputerMove(state, () => 0);
    state = playPlayerMove(state, "c3");
    state = playComputerMove(state, () => 0);
    state = playPlayerMove(state, "c4");
    expect(state.status).toBe("success");
  });

  it("free mode accepts any move that continues at least one opening", () => {
    const tree = createOpeningTree(openings);
    const mode: TrainerMode = { kind: "free", tree };
    const state = startTrainer("black", mode);
    const next = playPlayerMove(state, "f5");
    expect(next.status).toBe("playing");
    expect(next.moves).toEqual(["f5"]);
  });

  it("free mode computer prefers the move with the longest continuation", () => {
    const records = [
      makeOpening("short", ["f5", "d6", "c3"]),
      makeOpening("long", ["f5", "f6", "d3", "f4", "e3"]),
    ];
    const mode: TrainerMode = {
      kind: "free",
      tree: createOpeningTree(records),
    };
    const state = playPlayerMove(startTrainer("black", mode), "f5");
    expect(chooseComputerMove(state, () => 0)).toBe("f6");
  });
});

function makeOpening(id: string, moves: string[]) {
  return {
    id,
    primary_name: id,
    aliases: [],
    japanese_names: [],
    sequence: moves.join(""),
    moves,
    move_count: moves.length,
    family: "unknown" as const,
    tags: [],
    sources: [],
    source_notes: [],
    parent_id: null,
  };
}
