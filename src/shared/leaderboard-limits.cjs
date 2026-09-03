"use strict";

// Server-side leaderboard abuse-resistance helpers, shared by the ESM dev
// server (server.mjs) and the CommonJS Vercel function (api/leaderboard.js).

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const IP_POST_LIMIT = 50;
const NAME_RECORD_LIMIT = 5;
const TIMESTAMP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TIMESTAMP_MAX_SKEW_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 10;
const MAX_NAME_LENGTH = 10;
const MAX_SCORE = 1_000_000;
const MAX_RUN_SECONDS = 6 * 60 * 60;
const DIFFICULTIES = new Set(["normal"]);
const BLOCKED_NAME_FRAGMENTS = [
  "fuck", "shit", "bitch", "cunt", "dick", "pussy", "fucker",
  "bastard", "whore", "slut", "nigger", "nigga", "retard", "motherfucker",
];

const normalizeName = (rawName) => {
  if (typeof rawName !== "string") return "";
  return rawName.replace(/\s+/gu, " ").trim().slice(0, MAX_NAME_LENGTH).trim();
};

const normalizeNameKey = (name) => normalizeName(name).toLocaleLowerCase("und");

const isAllowedName = (name) => {
  if (!name || name.length > MAX_NAME_LENGTH || !/^[\p{L}]+(?: [\p{L}]+)*$/u.test(name)) return false;
  const compact = name.toLocaleLowerCase("und").replace(/\s+/gu, "");
  return !BLOCKED_NAME_FRAGMENTS.some((fragment) => compact.includes(fragment));
};

const normalizeDifficulty = (value) => (DIFFICULTIES.has(value) ? value : "normal");

const sanitizeEntries = (payload, now = Date.now()) => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) => ({
      name: normalizeName(entry && typeof entry.name === "string" ? entry.name : ""),
      score: entry && Number.isFinite(entry.score) ? Math.max(0, Math.floor(entry.score)) : 0,
      ts: normalizeTimestamp(entry && entry.ts, now),
      difficulty: normalizeDifficulty(entry && entry.difficulty),
    }))
    .filter((entry) => isAllowedName(entry.name) && entry.score > 0 && entry.score <= MAX_SCORE);
};

const normalizeEntries = (entries, now = Date.now()) => {
  const byPlayer = new Map();
  for (const entry of sanitizeEntries(entries, now)) {
    const key = normalizeNameKey(entry.name);
    const existing = byPlayer.get(key);
    if (!existing || entry.score > existing.score || (entry.score === existing.score && entry.ts < existing.ts)) {
      byPlayer.set(key, entry);
    }
  }
  return [...byPlayer.values()]
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, MAX_ENTRIES);
};

const validateRecord = (payload, now = Date.now()) => {
  const name = normalizeName(payload && payload.name);
  const score = payload && Number.isFinite(payload.score) ? Math.floor(payload.score) : 0;
  const requestedDifficulty = payload && payload.difficulty;
  const difficulty = requestedDifficulty === undefined || requestedDifficulty === null
    ? "normal"
    : requestedDifficulty;
  if (!isAllowedName(name)) return { ok: false, error: "Invalid player name" };
  if (!Number.isInteger(score) || score <= 0 || score > MAX_SCORE) {
    return { ok: false, error: "Invalid score" };
  }
  if (!DIFFICULTIES.has(difficulty)) return { ok: false, error: "Invalid difficulty" };

  const telemetryProvided = ["duration", "catches", "misses", "bestCombo"].some(
    (key) => Object.prototype.hasOwnProperty.call(payload, key)
  );
  if (telemetryProvided) {
    const duration = Number(payload.duration);
    const catches = Number(payload.catches);
    const misses = Number(payload.misses);
    const bestCombo = Number(payload.bestCombo);
    const telemetryValid = Number.isFinite(duration)
      && duration >= 1
      && duration <= MAX_RUN_SECONDS
      && Number.isInteger(catches)
      && catches >= 0
      && Number.isInteger(misses)
      && misses >= 0
      && misses <= 3
      && Number.isInteger(bestCombo)
      && bestCombo >= 1
      && bestCombo <= Math.max(1, catches)
      && score <= catches * 40 + duration * 4 + 100;
    if (!telemetryValid) return { ok: false, error: "Implausible run data" };
  }

  return {
    ok: true,
    entry: {
      name,
      score,
      ts: normalizeTimestamp(payload.ts, now),
      difficulty,
    },
  };
};

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
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  MAX_SCORE,
  MAX_RUN_SECONDS,
  IP_POST_LIMIT,
  NAME_RECORD_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  TIMESTAMP_MAX_AGE_MS,
  TIMESTAMP_MAX_SKEW_MS,
  createFixedWindowLimiter,
  getClientIp,
  isAllowedName,
  normalizeDifficulty,
  normalizeEntries,
  normalizeName,
  normalizeNameKey,
  normalizeTimestamp,
  sanitizeEntries,
  toRetryAfterSeconds,
  validateRecord,
};
