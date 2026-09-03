import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bonusDropXRange,
  getBatchRange,
  getBatchRecovery,
  isLastChance,
  secondsToBonusDrop,
  shouldShowBonusBirdAlert,
  getAwardedCatchPoints,
  getComboMultiplier,
  getDifficultyPreset,
  getScoreDifficultyTier,
  getScoreSpeedMultiplier,
  DIFFICULTY_PRESETS,
  DEFAULT_DIFFICULTY,
} from "../src/shared/gameplay.js";
import {
  WAVE_PATTERNS,
  resolveLandingRange,
  resolveZoneFraction,
  selectWavePattern,
  waveZoneOffsets,
} from "../src/shared/waves.js";
import { extendCatchRectToGround } from "../src/shared/catch-region.js";

describe("bounced-kernel catch region", () => {
  it("extends the normal catch region down to the ground", () => {
    assert.deepEqual(
      extendCatchRectToGround({ x: 20, y: 100, w: 80, h: 50 }, 220),
      { x: 20, y: 100, w: 80, h: 120 }
    );
  });

  it("never shrinks an existing catch region", () => {
    assert.equal(
      extendCatchRectToGround({ x: 0, y: 100, w: 40, h: 90 }, 150).h,
      90
    );
  });
});

describe("combo scoring", () => {
  it("uses x1 initially and reaches each streak threshold", () => {
    assert.equal(getComboMultiplier(0), 1);
    assert.equal(getComboMultiplier(4), 1);
    assert.equal(getComboMultiplier(5), 2);
    assert.equal(getComboMultiplier(9), 2);
    assert.equal(getComboMultiplier(10), 3);
    assert.equal(getComboMultiplier(17), 3);
    assert.equal(getComboMultiplier(18), 4);
  });

  it("multiplies catch points using the new streak count", () => {
    assert.equal(getAwardedCatchPoints(5, 1), 5);
    assert.equal(getAwardedCatchPoints(5, 5), 10);
    assert.equal(getAwardedCatchPoints(7, 10), 21);
    assert.equal(getAwardedCatchPoints(10, 18), 40);
  });
});

describe("single game difficulty", () => {
  it("always resolves to the one supported mode", () => {
    assert.equal(getDifficultyPreset(undefined), DEFAULT_DIFFICULTY);
    assert.equal(getDifficultyPreset("old-value"), DEFAULT_DIFFICULTY);
    assert.equal(getDifficultyPreset("easy"), DEFAULT_DIFFICULTY);
    assert.equal(getDifficultyPreset("hard"), DEFAULT_DIFFICULTY);
  });

  it("uses the slightly harder tuned flight and assist values", () => {
    assert.deepEqual(Object.keys(DIFFICULTY_PRESETS), [DEFAULT_DIFFICULTY]);
    assert.deepEqual(DIFFICULTY_PRESETS.normal.flightTime, [2.35, 3.4]);
    assert.equal(DIFFICULTY_PRESETS.normal.assistStrength, 0.95);
  });
});

describe("score-based difficulty ramp", () => {
  it("starts at 4000 and adds one tier every 1000 points", () => {
    assert.equal(getScoreDifficultyTier(3999), 0);
    assert.equal(getScoreDifficultyTier(4000), 1);
    assert.equal(getScoreDifficultyTier(4999), 1);
    assert.equal(getScoreDifficultyTier(5000), 2);
    assert.equal(getScoreDifficultyTier(9000), 6);
  });

  it("makes each tier cumulatively five percent faster", () => {
    assert.equal(getScoreSpeedMultiplier(3999), 1);
    assert.equal(getScoreSpeedMultiplier(4000), 1.05);
    assert.equal(getScoreSpeedMultiplier(5000), 1.05 ** 2);
    assert.equal(getScoreSpeedMultiplier(Number.NaN), 1);
  });
});

describe("getBatchRange", () => {
  it("uses the active wave pattern", () => {
    for (let batch = 1; batch <= WAVE_PATTERNS.length; batch += 1) {
      const minCount = getBatchRange(batch)[0];
      assert.ok(minCount >= 1);
    }
  });

  it("respects the single mode batch count cap", () => {
    assert.ok(getBatchRange(20)[1] <= DIFFICULTY_PRESETS.normal.batchCountCap + 2);
  });
});

describe("waves", () => {
  it("selectWavePattern returns deterministic entries", () => {
    const first = selectWavePattern(1);
    const last = selectWavePattern(100);
    assert.equal(first.name, "Pair");
    assert.equal(last.name, WAVE_PATTERNS[WAVE_PATTERNS.length - 1].name);
  });

  it("converts fractional wave ranges into finite screen coordinates", () => {
    assert.deepEqual(resolveLandingRange([0.15, 0.75], 1000, 60, 840), [150, 750]);
    assert.deepEqual(resolveLandingRange([0.9, 0.1], 1000, 60, 840), [100, 840]);
    assert.deepEqual(resolveLandingRange([NaN, 0.5], 1000, 60, 840), [60, 840]);
  });

  it("waveZoneOffsets and resolveZoneFraction are point-valued", () => {
    const wide = waveZoneOffsets(2);
    const alternating = resolveZoneFraction([-1, 1], 3);
    assert.deepEqual(wide, [0.05, 0.84]);
    assert.ok(Array.isArray(alternating));
  });
});

describe("getBatchRecovery", () => {
  it("pattern recovery is stable across early waves", () => {
    const pattern = selectWavePattern(1);
    assert.equal(getBatchRecovery(1), pattern.recovery);
  });

  it("keeps recovery short enough for continuous play without removing all breathing room", () => {
    for (let batch = 1; batch <= WAVE_PATTERNS.length; batch += 1) {
      const recovery = getBatchRecovery(batch);
      assert.ok(recovery >= 0.9, `batch ${batch} recovery ${recovery} below floor`);
      assert.ok(recovery <= 1.25, `batch ${batch} recovery ${recovery} creates a long pause`);
    }
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
  it("keeps the minimum clear of the machine", () => {
    const [min, max] = bonusDropXRange(320, 240, 80);
    assert.ok(max > min);
  });

  it("stays bounded on desktop widths too", () => {
    const [min, max] = bonusDropXRange(1024, 860, 140);
    assert.ok(max > min);
    assert.ok(max < 1024 * 0.9);
  });

  it("never collapses below the minimum band", () => {
    const [min, max] = bonusDropXRange(320, 0, 80);
    assert.ok(max >= min);
  });
});
