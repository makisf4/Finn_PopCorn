import leaderboardRules from "../src/shared/leaderboard-limits.cjs";

const {
  IP_POST_LIMIT,
  NAME_RECORD_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  createFixedWindowLimiter,
  getClientIp,
  isAllowedName,
  normalizeEntries,
  normalizeName,
  normalizeNameKey,
  toRetryAfterSeconds,
  validateRecord,
} = leaderboardRules;

const LEADERBOARD_KEY = "finn_popcorn_leaderboard_v1";

const KV_REST_API_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

// Best effort only: these in-memory counters are per warm serverless instance,
// so concurrent or freshly started instances each enforce their own window.
const ipLimiter = createFixedWindowLimiter({
  limit: IP_POST_LIMIT,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

const nameLimiter = createFixedWindowLimiter({
  limit: NAME_RECORD_LIMIT,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

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

const sendRateLimited = (res, retryAfterSeconds, message) => {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  sendError(res, 429, message);
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
    console.error(`[KV] ${path} failed (${response.status}): ${text.slice(0, 200)}`);
    throw new Error("KV request failed");
  }
  return response.json();
};

const readLeaderboardFromKv = async () => {
  const result = await kvRequest(`/get/${encodeURIComponent(LEADERBOARD_KEY)}`, "GET");
  if (!result || result.result === null) return [];

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

export default async function handler(req, res) {
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

    const ip = getClientIp(req.headers["x-forwarded-for"], req.socket);
    const ipVerdict = ipLimiter.consume(ip);
    if (!ipVerdict.allowed) {
      sendRateLimited(res, toRetryAfterSeconds(ipVerdict.retryAfterMs), "Too many leaderboard requests");
      return;
    }

    let body;
    try {
      body = await parseRequestBody(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid request body";
      sendError(res, message === "Payload too large" ? 413 : 400, message);
      return;
    }
    const action = String(body.action || "record").toLowerCase();

    if (action === "record") {
      const candidateName = normalizeName(typeof body.name === "string" ? body.name : "");
      const candidateScore = Number.isFinite(body.score)
        ? Math.max(0, Math.floor(body.score))
        : 0;
      if (isAllowedName(candidateName) && candidateScore > 0) {
        const nameVerdict = nameLimiter.consume(normalizeNameKey(candidateName));
        if (!nameVerdict.allowed) {
          sendRateLimited(res, toRetryAfterSeconds(nameVerdict.retryAfterMs), "Too many submissions for this name");
          return;
        }
      }
    }

    if (action !== "record") {
      sendError(res, 400, "Unsupported leaderboard action");
      return;
    }

    const verdict = validateRecord(body);
    if (!verdict.ok) {
      sendError(res, 400, verdict.error);
      return;
    }

    const current = await readLeaderboardFromKv();
    const updated = await writeLeaderboardToKv([...current, verdict.entry]);
    sendJson(res, 200, updated);
  } catch (error) {
    console.error("[Leaderboard] Request failed", error);
    sendError(res, 500, "Leaderboard service unavailable");
  }
}
