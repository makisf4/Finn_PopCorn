import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { circleRectCollision, clamp, formatMisses, lerp, rand, randInt, smoothstep } from "../src/utils.js";

describe("clamp", () => {
  it("keeps values inside the range and limits both ends", () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
  });
});

describe("interpolation helpers", () => {
  it("linearly interpolates between two values", () => {
    assert.equal(lerp(10, 20, 0.25), 12.5);
  });

  it("smoothly clamps and interpolates across the edges", () => {
    assert.equal(smoothstep(0, 10, -1), 0);
    assert.equal(smoothstep(0, 10, 5), 0.5);
    assert.equal(smoothstep(0, 10, 11), 1);
  });
});

describe("random helpers", () => {
  it("returns a value within the inclusive range", () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    try {
      assert.equal(rand(2, 6), 4);
      assert.equal(randInt(2, 6), 4);
    } finally {
      Math.random = originalRandom;
    }
  });
});

describe("circleRectCollision", () => {
  const rect = { x: 10, y: 10, w: 20, h: 20 };

  it("detects overlap, edge contact, and separation", () => {
    assert.equal(circleRectCollision({ x: 20, y: 20, r: 2 }, rect), true);
    assert.equal(circleRectCollision({ x: 7, y: 20, r: 3 }, rect), true);
    assert.equal(circleRectCollision({ x: 6, y: 20, r: 3 }, rect), false);
  });
});

describe("formatMisses", () => {
  it("formats the miss counter for the HUD", () => {
    assert.equal(formatMisses(2, 3), "2 / 3");
  });
});
