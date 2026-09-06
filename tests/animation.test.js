import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFacingState,
  pickRunFrame,
  updateFacing,
  TURN_DURATION,
} from "../src/shared/animation.js";

test("pickRunFrame returns idle frame when stopped or game over", () => {
  assert.equal(pickRunFrame(4, 0, 0, false), 4);
  assert.equal(pickRunFrame(4, 0, 0, true), 4);
});

test("pickRunFrame cycles run frames while moving", () => {
  const idx = pickRunFrame(4, Math.PI, 1, false);
  assert.equal(idx, 2);
});

test("updateFacing swaps mirror immediately", () => {
  const swap = updateFacing({ facing: -1, progress: 1 }, 1, 0);
  assert.equal(swap.mirrorSign, 1);
});

test("initial swap applies a squash", () => {
  const swap = updateFacing({ facing: -1, progress: 1 }, 1, 0);
  assert.ok(Math.abs(swap.squash - 0.93) < 0.001);
});

test("full turn converges back to scale 1", () => {
  const end = updateFacing({ facing: -1, progress: 0 }, 1, TURN_DURATION);
  assert.ok(Math.abs(end.squash - 1) < 0.001);
});

test("squash eases monotonically to 1", () => {
  let state = updateFacing({ facing: -1, progress: 0 }, 1, 0);
  const values = [state.squash];
  while (values[values.length - 1] < 0.999) {
    state = updateFacing({ facing: state.mirrorSign, progress: state.progress }, state.mirrorSign, 0.011);
    values.push(state.squash);
  }
  for (let i = 1; i < values.length; i += 1) {
    assert.ok(values[i] >= values[i - 1]);
  }
  assert.ok(values[values.length - 1] >= 0.999);
});

test("rapid alternating facing keeps scale bounded", () => {
  let state = createFacingState(-1);
  const squashes = [];
  for (let i = 0; i < 40; i += 1) {
    const target = i % 2 === 0 ? 1 : -1;
    const next = updateFacing(state, target, TURN_DURATION * 0.05);
    state = { facing: next.mirrorSign, progress: next.progress };
    squashValues(next, squashes);
    assert.equal(Math.abs(next.mirrorSign), 1);
  }
  function squashValues(result, out) {
    out.push(result.squash);
  }
});
