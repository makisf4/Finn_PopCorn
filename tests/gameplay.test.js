import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bonusDropXRange,
  getBatchRange,
  getBatchRecovery,
  isLastChance,
  secondsToBonusDrop,
  shouldShowBonusBirdAlert,
  BATCH_COUNT_CAP,
  MAX_RAMP_BATCH,
} from "../src/shared/gameplay.js";

describe("getBatchRange", () => {
  it("keeps the early, gentle opening batches as today", () => {
    assert.deepEqual(getBatchRange(1), [2, 3]);
    assert.deepEqual(getBatchRange(2), [4, 5]);
    assert.deepEqual(getBatchRange(3), [8, 9]);
  });

  it("ramps counts up through batch 10", () => {
    assert.deepEqual(getBatchRange(4), [11, 13]);
    assert.deepEqual(getBatchRange(5), [13, 15]);
    assert.equal(getBatchRange(10)[0], 25);
    assert.equal(getBatchRange(10)[1], 27);
  });

  it("stops growing after batch 10 for every later batch", () => {
    for (let batch = 11; batch <= 200; batch += 1) {
      assert.deepEqual(getBatchRange(batch), getBatchRange(MAX_RAMP_BATCH));
    }
  });

  it("never exceeds the overall single-batch cap", () => {
    for (let batch = 1; batch <= 500; batch += 1) {
      const [minCount, maxCount] = getBatchRange(batch);
      assert.ok(minCount <= BATCH_COUNT_CAP);
      assert.ok(maxCount <= BATCH_COUNT_CAP + 2);
      assert.ok(minCount >= 2);
      assert.ok(minCount <= maxCount);
    }
  });
});

describe("getBatchRecovery", () => {
  it("reproduces the current curve through batch 10", () => {
    for (let batch = 1; batch <= 10; batch += 1) {
      assert.equal(getBatchRecovery(batch), Math.max(1, 2.8 - batch * 0.075));
    }
  });

  it("gently shortens later recovery without going below the floor", () => {
    for (let batch = 11; batch <= 400; batch += 1) {
      const recovery = getBatchRecovery(batch);
      assert.ok(recovery >= 1.2, `batch ${batch} recovery ${recovery} below floor`);
      assert.ok(
        recovery <= getBatchRecovery(batch - 1),
        `batch ${batch} recovery ${recovery} not non-increasing`
      );
    }
    assert.ok(getBatchRecovery(400) >= 1.2);
  });
});

describe("isLastChance", () => {
  it("flags only the pre-final miss", () => {
    assert.equal(isLastChance(2, 3), true);
    assert.equal(isLastChance(1, 3), false);
    assert.equal(isLastChance(0, 3), false);
    assert.equal(isLastChance(3, 3), false);
    assert.equal(isLastChance(4, 5), true);
    assert.equal(isLastChance(3, 5), false);
  });
});

describe("secondsToBonusDrop / shouldShowBonusBirdAlert", () => {
  it("computes time to the drop point from horizontal speed", () => {
    assert.equal(secondsToBonusDrop({ x: 100, vx: 20, dropX: 112, dropped: false }), 0.6);
    assert.equal(secondsToBonusDrop({ x: 100, vx: -20, dropX: 88, dropped: false }), 0.6);
  });

  it("never alerts once the bird has dropped", () => {
    assert.equal(secondsToBonusDrop({ x: 100, vx: 20, dropX: 101, dropped: true }), Infinity);
    assert.equal(shouldShowBonusBirdAlert({ x: 100, vx: 20, dropX: 101, dropped: true }), false);
  });

  it("never alerts for stationary birds", () => {
    assert.equal(secondsToBonusDrop({ x: 100, vx: 0, dropX: 112, dropped: false }), Infinity);
    assert.equal(shouldShowBonusBirdAlert({ x: 100, vx: 0, dropX: 112, dropped: false }), false);
  });

  it("alerts only inside the 0.6s lead and from either direction", () => {
    const inside = { x: 100, vx: 20, dropX: 109, dropped: false };
    const outside = { x: 100, vx: 20, dropX: 130, dropped: false };
    const fromLeft = { x: 100, vx: -20, dropX: 89, dropped: false };
    assert.equal(shouldShowBonusBirdAlert(inside), true);
    assert.equal(shouldShowBonusBirdAlert(outside), false);
    assert.equal(shouldShowBonusBirdAlert(fromLeft), true);
  });
});

describe("bonusDropXRange", () => {
  it("clamps the drop point clear of the machine on narrow screens", () => {
    const [min, max] = bonusDropXRange(320, 240, 80);
    assert.equal(min, 320 * 0.16);
    assert.equal(max, 240 - 20);
    assert.ok(max < 246, "drop stays left of the machine front");
    assert.ok(max > min);
  });

  it("keeps a usable spread and stays clear on desktop widths too", () => {
    const [min, max] = bonusDropXRange(1024, 860, 140);
    assert.equal(min, 1024 * 0.16);
    assert.equal(max, 860 - 140 * 0.25);
    assert.ok(max > min);
    assert.ok(max < 1024 * 0.84);
  });

  it("never collapses below the minimum band on tiny widths", () => {
    const [min, max] = bonusDropXRange(320, 0, 80);
    assert.ok(max >= min);
    assert.ok(max >= 320 * 0.16);
  });
});