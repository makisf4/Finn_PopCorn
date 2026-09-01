import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IP_POST_LIMIT,
  NAME_RECORD_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  TIMESTAMP_MAX_AGE_MS,
  TIMESTAMP_MAX_SKEW_MS,
  createFixedWindowLimiter,
  getClientIp,
  normalizeTimestamp,
  toRetryAfterSeconds,
} from "../src/shared/leaderboard-limits.cjs";

describe("leaderboard limit constants", () => {
  it("pin the documented windows and quotas", () => {
    assert.equal(RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
    assert.equal(IP_POST_LIMIT, 50);
    assert.equal(NAME_RECORD_LIMIT, 5);
    assert.equal(TIMESTAMP_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000);
    assert.equal(TIMESTAMP_MAX_SKEW_MS, 5 * 60 * 1000);
  });
});

describe("normalizeTimestamp", () => {
  const now = Date.parse("2026-09-01T12:00:00.000Z");

  it("accepts timestamps inside the plausible window unchanged", () => {
    assert.equal(normalizeTimestamp(now, now), now);
    assert.equal(normalizeTimestamp(now - 1, now), now - 1);
    assert.equal(normalizeTimestamp(now + 1, now), now + 1);
    assert.equal(normalizeTimestamp(now - TIMESTAMP_MAX_AGE_MS, now), now - TIMESTAMP_MAX_AGE_MS);
    assert.equal(normalizeTimestamp(now + TIMESTAMP_MAX_SKEW_MS, now), now + TIMESTAMP_MAX_SKEW_MS);
    assert.equal(normalizeTimestamp(now - TIMESTAMP_MAX_AGE_MS + 1, now), now - TIMESTAMP_MAX_AGE_MS + 1);
    assert.equal(normalizeTimestamp(now + TIMESTAMP_MAX_SKEW_MS - 1, now), now + TIMESTAMP_MAX_SKEW_MS - 1);
  });

  it("replaces timestamps outside the window with server time", () => {
    assert.equal(normalizeTimestamp(now - TIMESTAMP_MAX_AGE_MS - 1, now), now);
    assert.equal(normalizeTimestamp(now + TIMESTAMP_MAX_SKEW_MS + 1, now), now);
    assert.equal(normalizeTimestamp(1200, now), now);
    assert.equal(normalizeTimestamp(Date.now() * 100, now), now);
  });

  it("replaces non-finite and non-numeric values with server time", () => {
    for (const invalid of [undefined, null, NaN, Infinity, -Infinity, "", "1700000000000", {}, [], true]) {
      assert.equal(normalizeTimestamp(invalid, now), now);
    }
  });

  it("defaults to the current server clock when no now is injected", () => {
    const before = Date.now();
    const replaced = normalizeTimestamp(undefined);
    const after = Date.now();
    assert.ok(replaced >= before && replaced <= after);
  });
});

describe("createFixedWindowLimiter", () => {
  it("allows up to the limit in one window and blocks the rest", () => {
    let at = 0;
    const limiter = createFixedWindowLimiter({ windowMs: 600_000, limit: 3, now: () => at });

    assert.deepEqual(limiter.consume("a"), { allowed: true, remaining: 2, retryAfterMs: 0 });
    assert.deepEqual(limiter.consume("a"), { allowed: true, remaining: 1, retryAfterMs: 0 });
    assert.deepEqual(limiter.consume("a"), { allowed: true, remaining: 0, retryAfterMs: 0 });
    assert.deepEqual(limiter.consume("a"), { allowed: false, remaining: 0, retryAfterMs: 600_000 });
  });

  it("resets the counter when the fixed window rolls over", () => {
    let at = 100;
    const limiter = createFixedWindowLimiter({ windowMs: 1_000, limit: 2, now: () => at });

    assert.equal(limiter.consume("a").allowed, true);
    assert.equal(limiter.consume("a").allowed, true);
    assert.equal(limiter.consume("a").allowed, false);

    at = 1_000;
    assert.deepEqual(limiter.consume("a"), { allowed: true, remaining: 1, retryAfterMs: 0 });
    assert.deepEqual(limiter.consume("a"), { allowed: true, remaining: 0, retryAfterMs: 0 });
    assert.equal(limiter.consume("a").allowed, false);
  });

  it("keeps keys isolated within and across limiter instances", () => {
    const at = 5_000;
    const limiter = createFixedWindowLimiter({ windowMs: 600_000, limit: 1, now: () => at });

    assert.equal(limiter.consume("ip-a").allowed, true);
    assert.equal(limiter.consume("ip-a").allowed, false);
    assert.equal(limiter.consume("ip-b").allowed, true);
    assert.equal(limiter.consume("ip-b").allowed, false);

    const other = createFixedWindowLimiter({ windowMs: 600_000, limit: 1, now: () => at });
    assert.equal(other.consume("ip-a").allowed, true);
  });

  it("reports the remaining retry milliseconds until the window resets", () => {
    let at = 1_800_100;
    const limiter = createFixedWindowLimiter({ windowMs: 600_000, limit: 1, now: () => at });

    limiter.consume("a");
    const blockedEarly = limiter.consume("a");
    assert.equal(blockedEarly.retryAfterMs, 2_400_000 - 1_800_100);
    assert.equal(toRetryAfterSeconds(blockedEarly.retryAfterMs), 600);

    at = 2_399_999;
    const blockedLate = limiter.consume("a");
    assert.equal(blockedLate.retryAfterMs, 1);
    assert.equal(toRetryAfterSeconds(blockedLate.retryAfterMs), 1);
  });

  it("rejects invalid limiter configuration", () => {
    assert.throws(() => createFixedWindowLimiter({ windowMs: 0, limit: 1, now: () => 0 }), TypeError);
    assert.throws(() => createFixedWindowLimiter({ windowMs: 100, limit: 0, now: () => 0 }), TypeError);
    assert.throws(() => createFixedWindowLimiter({ windowMs: 100, limit: 1, now: "nope" }), TypeError);
  });
});

describe("toRetryAfterSeconds", () => {
  it("rounds partial seconds up and never reports zero", () => {
    assert.equal(toRetryAfterSeconds(0), 1);
    assert.equal(toRetryAfterSeconds(1), 1);
    assert.equal(toRetryAfterSeconds(1_500), 2);
    assert.equal(toRetryAfterSeconds(60_000), 60);
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for value", () => {
    assert.equal(getClientIp("203.0.113.7, 70.41.3.18, 150.172.238.178", null), "203.0.113.7");
    assert.equal(getClientIp("  198.51.100.4 ,203.0.113.7", null), "198.51.100.4");
    assert.equal(getClientIp("192.0.2.10", null), "192.0.2.10");
    assert.equal(getClientIp("::1", null), "::1");
  });

  it("falls back to the socket address when the header is missing or blank", () => {
    assert.equal(getClientIp(undefined, { remoteAddress: "127.0.0.1" }), "127.0.0.1");
    assert.equal(getClientIp("", { remoteAddress: "127.0.0.1" }), "127.0.0.1");
    assert.equal(getClientIp("   ", { remoteAddress: "::1" }), "::1");
    assert.equal(getClientIp(",192.0.2.10", { remoteAddress: "127.0.0.1" }), "127.0.0.1");
  });

  it("returns a stable fallback when no address is available", () => {
    assert.equal(getClientIp(undefined, undefined), "unknown");
    assert.equal(getClientIp(undefined, {}), "unknown");
    assert.equal(getClientIp("", null), "unknown");
  });
});