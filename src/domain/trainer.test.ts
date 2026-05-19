import { describe, expect, it } from "vitest";
import { createOpeningTree, openings } from "./openings";
import {
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
});
