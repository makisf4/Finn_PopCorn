"use strict";

// Server-side leaderboard abuse-resistance helpers, shared by the ESM dev
// server (server.mjs) and the CommonJS Vercel function (api/leaderboard.js).

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const IP_POST_LIMIT = 50;
const NAME_RECORD_LIMIT = 5;
const TIMESTAMP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TIMESTAMP_MAX_SKEW_MS = 5 * 60 * 1000;

const normalizeTimestamp = (ts, now = Date.now()) => {
  if (!Number.isFinite(ts)) return now;
  if (ts < now - TIMESTAMP_MAX_AGE_MS || ts > now + TIMESTAMP_MAX_SKEW_MS) return now;
  return ts;
};

const toRetryAfterSeconds = (retryAfterMs) => Math.max(1, Math.ceil(retryAfterMs / 1000));

const createFixedWindowLimiter = ({ windowMs = RATE_LIMIT_WINDOW_MS, limit, now = Date.now } = {}) => {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new TypeError("windowMs must be a positive number of milliseconds");
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new TypeError("limit must be a positive integer");
  }
  if (typeof now !== "function") {
    throw new TypeError("now must be a function returning epoch milliseconds");
  }

  const hits = new Map();

  const consume = (key) => {
    const at = now();
    const windowStart = Math.floor(at / windowMs) * windowMs;

    for (const [hitKey, hit] of hits) {
      if (hit.windowStart !== windowStart) hits.delete(hitKey);
    }

    const hit = hits.get(key);
    if (!hit) {
      hits.set(key, { windowStart, count: 1 });
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }
    if (hit.count >= limit) {
      return { allowed: false, remaining: 0, retryAfterMs: hit.windowStart + windowMs - at };
    }

    hit.count += 1;
    return { allowed: true, remaining: limit - hit.count, retryAfterMs: 0 };
  };

  return { consume };
};

const getClientIp = (forwardedFor, socket) => {
  if (typeof forwardedFor === "string") {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }
  if (socket && typeof socket.remoteAddress === "string" && socket.remoteAddress) {
    return socket.remoteAddress;
  }
  return "unknown";
};

module.exports = {
  IP_POST_LIMIT,
  NAME_RECORD_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  TIMESTAMP_MAX_AGE_MS,
  TIMESTAMP_MAX_SKEW_MS,
  createFixedWindowLimiter,
  getClientIp,
  normalizeTimestamp,
  toRetryAfterSeconds,
};