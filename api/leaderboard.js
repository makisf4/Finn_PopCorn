"use strict";

const LEADERBOARD_KEY = "finn_popcorn_leaderboard_v1";
const MAX_ENTRIES = 10;
const MAX_NAME_LENGTH = 10;
const BLOCKED_NAME_FRAGMENTS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "pussy",
  "fucker",
  "bastard",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "retard",
  "motherfucker",
];

const KV_REST_API_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const setJsonHeaders = (res, statusCode) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
};

const sendJson = (res, statusCode, payload) => {
  setJsonHeaders(res, statusCode);
  res.end(JSON.stringify(payload));
};

const sendError = (res, statusCode, message) => {
  sendJson(res, statusCode, { error: message });
};

const normalizeName = (rawName) => {
  if (typeof rawName !== "string") return "";
  const collapsed = rawName.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, MAX_NAME_LENGTH).trim();
};

const normalizeNameKey = (name) => normalizeName(name).toLowerCase();

const isAllowedName = (name) => {
  if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) return false;
  const compact = name.toLowerCase().replace(/\s+/g, "");
  return !BLOCKED_NAME_FRAGMENTS.some((fragment) => compact.includes(fragment));
};

const sanitizeEntries = (payload) => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) => ({
      name: normalizeName(typeof entry.name === "string" ? entry.name : ""),
      score: Number.isFinite(entry.score) ? Math.max(0, Math.floor(entry.score)) : 0,
      ts: Number.isFinite(entry.ts) ? entry.ts : Date.now(),
    }))
    .filter((entry) => isAllowedName(entry.name));
};

const normalizeEntries = (entries) => {
  const byPlayer = new Map();

  for (const entry of sanitizeEntries(entries)) {
    const key = normalizeNameKey(entry.name);
    const existing = byPlayer.get(key);
    if (!existing) {
      byPlayer.set(key, entry);
      continue;
    }

    if (entry.score > existing.score || (entry.score === existing.score && entry.ts < existing.ts)) {
      byPlayer.set(key, entry);
    }
  }

  return [...byPlayer.values()]
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, MAX_ENTRIES);
};

const applyRename = (entries, fromName, toName) => {
  const fromKey = normalizeNameKey(fromName);
  const toKey = normalizeNameKey(toName);
  if (!fromKey || !toKey) return normalizeEntries(entries);

  if (fromKey === toKey) {
    return normalizeEntries(
      entries.map((entry) =>
        normalizeNameKey(entry.name) === toKey ? { ...entry, name: toName } : entry
      )
    );
  }

  const survivors = [];
  const mergePool = [];

  for (const entry of entries) {
    const key = normalizeNameKey(entry.name);
    if (key === fromKey || key === toKey) {
      mergePool.push(entry);
    } else {
      survivors.push(entry);
    }
  }

  if (mergePool.length === 0) {
    return normalizeEntries(entries);
  }

  let winner = mergePool[0];
  for (let i = 1; i < mergePool.length; i += 1) {
    const candidate = mergePool[i];
    if (candidate.score > winner.score || (candidate.score === winner.score && candidate.ts < winner.ts)) {
      winner = candidate;
    }
  }

  return normalizeEntries([
    ...survivors,
    {
      ...winner,
      name: toName,
    },
  ]);
};

const parseRequestBody = (req) =>
  new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }

    if (typeof req.body === "string") {
      if (!req.body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(req.body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
      return;
    }

    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 16_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", () => reject(new Error("Request stream error")));
  });

const assertKvConfigured = () => {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    throw new Error("KV is not configured. Missing KV_REST_API_URL or KV_REST_API_TOKEN.");
  }
};

const kvRequest = async (path, method = "GET") => {
  assertKvConfigured();
  const response = await fetch(`${KV_REST_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KV request failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return response.json();
};

const readLeaderboardFromKv = async () => {
  const result = await kvRequest(`/get/${encodeURIComponent(LEADERBOARD_KEY)}`, "GET");
  if (!result || result.result == null) return [];

  const parsed = typeof result.result === "string" ? JSON.parse(result.result) : result.result;
  return normalizeEntries(parsed);
};

const writeLeaderboardToKv = async (entries) => {
  const normalized = normalizeEntries(entries);
  const serialized = JSON.stringify(normalized);
  await kvRequest(
    `/set/${encodeURIComponent(LEADERBOARD_KEY)}/${encodeURIComponent(serialized)}`,
    "POST"
  );
  return normalized;
};

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    sendError(res, 405, "Method Not Allowed");
    return;
  }

  try {
    if (req.method === "GET") {
      const entries = await readLeaderboardFromKv();
      sendJson(res, 200, entries);
      return;
    }

    const body = await parseRequestBody(req);
    const action = String(body.action || "record").toLowerCase();
    const current = await readLeaderboardFromKv();

    if (action === "rename") {
      const fromName = normalizeName(typeof body.fromName === "string" ? body.fromName : "");
      const toName = normalizeName(typeof body.toName === "string" ? body.toName : "");

      if (!isAllowedName(fromName) || !isAllowedName(toName)) {
        sendError(res, 400, "Invalid player name");
        return;
      }

      const updated = await writeLeaderboardToKv(applyRename(current, fromName, toName));
      sendJson(res, 200, updated);
      return;
    }

    if (action !== "record") {
      sendError(res, 400, "Unsupported leaderboard action");
      return;
    }

    const name = normalizeName(typeof body.name === "string" ? body.name : "");
    const score = Number.isFinite(body.score) ? Math.max(0, Math.floor(body.score)) : 0;
    const ts = Number.isFinite(body.ts) ? body.ts : Date.now();

    if (!isAllowedName(name)) {
      sendError(res, 400, "Invalid player name");
      return;
    }

    if (score <= 0) {
      sendJson(res, 200, current);
      return;
    }

    const updated = await writeLeaderboardToKv([...current, { name, score, ts }]);
    sendJson(res, 200, updated);
  } catch (error) {
    sendError(res, 500, error instanceof Error ? error.message : "Leaderboard API failure");
  }
};
