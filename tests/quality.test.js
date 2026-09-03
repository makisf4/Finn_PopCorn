import { test } from "node:test";
import assert from "node:assert/strict";
import { getQuality, computeAutoQuality, validateQuality } from "../src/shared/quality.js";

test("getQuality maps low quality to reduced bloom and shadows", () => {
  assert.equal(getQuality("low").bloom, 0);
  assert.ok(getQuality("low").shadowMapSize < getQuality("high").shadowMapSize);
});

test("getQuality defaults to auto", () => {
  assert.equal(getQuality(null).dprCap, 2);
  assert.equal(getQuality("unknown").particleScale, 1);
});

test("computeAutoQuality demotes high-quality only for low FPS", () => {
  assert.equal(computeAutoQuality(60), "high");
  assert.equal(computeAutoQuality(29), "low");
  assert.equal(computeAutoQuality(40), "auto");
});

test("validateQuality falls back to auto", () => {
  assert.equal(validateQuality("high"), "high");
  assert.equal(validateQuality("low"), "low");
  assert.equal(validateQuality("auto"), "auto");
  assert.equal(validateQuality("turbo"), "auto");
});
