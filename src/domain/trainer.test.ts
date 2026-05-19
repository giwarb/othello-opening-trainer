import { describe, expect, it } from "vitest";
import { createOpeningTree, openings } from "./openings";
import {
  expectedMoves,
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
  it("lets the computer play when player chooses white", () => {
    const state = startTrainer(
      "white",
      { kind: "fixed", opening: tiger },
      () => 0,
    );
    expect(state.moves).toEqual(["f5"]);
    expect(expectedMoves(state)).toEqual(["d6"]);
  });

  it("fails when fixed-mode player leaves the selected opening", () => {
    const state = startTrainer("black", { kind: "fixed", opening: tiger });
    const failed = playPlayerMove(state, "c4");
    expect(failed.status).toBe("failure");
    expect(failed.message).toContain("違う手");
  });

  it("succeeds when the fixed opening reaches its terminal move", () => {
    let state = startTrainer(
      "black",
      { kind: "fixed", opening: tiger },
      () => 0,
    );
    state = playPlayerMove(state, "f5", () => 0);
    state = playPlayerMove(state, "c3", () => 0);
    state = playPlayerMove(state, "c4", () => 0);
    expect(state.status).toBe("success");
  });

  it("free mode accepts any move that continues at least one opening", () => {
    const tree = createOpeningTree(openings);
    const mode: TrainerMode = { kind: "free", tree };
    const state = startTrainer("black", mode);
    const next = playPlayerMove(state, "f5", () => 0);
    expect(next.status).toBe("playing");
    expect(next.moves.length).toBe(2);
    expect(next.currentOpenings[0]?.primary_name).toBe("Perpendicular Opening");
  });
});
