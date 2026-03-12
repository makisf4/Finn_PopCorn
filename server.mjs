import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const dataDir = path.join(rootDir, "data");
const leaderboardFile = path.join(dataDir, "leaderboard.json");

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8080);

const MAX_ENTRIES = 10;
const MAX_NAME_LENGTH = 10;
const MAX_BODY_BYTES = 16_000;
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

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

let writeQueue = Promise.resolve();

const queueWrite = (task) => {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
};

const sendText = (res, statusCode, message) => {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(message);
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
    if (!existing || entry.score > existing.score || (entry.score === existing.score && entry.ts < existing.ts)) {
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

const ensureLeaderboardFile = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(leaderboardFile);
  } catch {
    await fs.writeFile(leaderboardFile, "[]\n", "utf8");
  }
};

const readLeaderboard = async () => {
  await ensureLeaderboardFile();
  try {
    const raw = await fs.readFile(leaderboardFile, "utf8");
    return normalizeEntries(JSON.parse(raw));
  } catch {
    return [];
  }
};

const writeLeaderboard = async (entries) => {
  await ensureLeaderboardFile();
  const normalized = normalizeEntries(entries);
  await fs.writeFile(leaderboardFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
};

const readRequestJson = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });

const handleLeaderboard = async (req, res) => {
  if (req.method === "GET") {
    const entries = await readLeaderboard();
    sendJson(res, 200, entries);
    return;
  }

  if (req.method === "POST") {
    let payload;
    try {
      payload = await readRequestJson(req);
    } catch (error) {
      sendText(res, error.message === "Payload too large" ? 413 : 400, error.message);
      return;
    }

    const action = String(payload.action || "record").toLowerCase();

    const entries = await queueWrite(async () => {
      const current = await readLeaderboard();

      if (action === "rename") {
        const fromName = normalizeName(typeof payload.fromName === "string" ? payload.fromName : "");
        const toName = normalizeName(typeof payload.toName === "string" ? payload.toName : "");
        if (!isAllowedName(fromName) || !isAllowedName(toName)) {
          throw new Error("Invalid player name");
        }
        return writeLeaderboard(applyRename(current, fromName, toName));
      }

      if (action !== "record") {
        throw new Error("Unsupported leaderboard action");
      }

      const name = normalizeName(typeof payload.name === "string" ? payload.name : "");
      const score = Number.isFinite(payload.score) ? Math.max(0, Math.floor(payload.score)) : 0;
      const ts = Number.isFinite(payload.ts) ? payload.ts : Date.now();
      if (!isAllowedName(name)) {
        throw new Error("Invalid player name");
      }
      if (score <= 0) {
        return current;
      }

      return writeLeaderboard([...current, { name, score, ts }]);
    }).catch((error) => {
      if (error.message === "Invalid player name" || error.message === "Unsupported leaderboard action") {
        throw error;
      }
      throw error;
    });

    sendJson(res, 200, entries);
    return;
  }

  sendText(res, 405, "Method Not Allowed");
};

const toSafeFilePath = (pathname) => {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const normalized = path.normalize(path.join(rootDir, requested));
  if (!normalized.startsWith(rootDir)) {
    return null;
  }
  return normalized;
};

const serveStatic = async (res, url) => {
  const filePath = toSafeFilePath(url.pathname);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    sendText(res, 404, "Not Found");
    return;
  }

  const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
  try {
    await fs.access(finalPath);
  } catch {
    sendText(res, 404, "Not Found");
    return;
  }

  const ext = path.extname(finalPath).toLowerCase();
  const contentType = contentTypes[ext] || "application/octet-stream";
  const cacheControl = ext === ".html" ? "no-cache" : "public, max-age=3600";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  });

  const stream = createReadStream(finalPath);
  stream.on("error", () => {
    if (!res.headersSent) {
      sendText(res, 500, "Server Error");
      return;
    }
    res.destroy();
  });
  stream.pipe(res);
};

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendText(res, 400, "Bad Request");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/leaderboard") {
    try {
      await handleLeaderboard(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Leaderboard API failure";
      if (message === "Invalid player name" || message === "Unsupported leaderboard action") {
        sendText(res, 400, message);
        return;
      }
      sendText(res, 500, message);
    }
    return;
  }

  await serveStatic(res, url);
});

server.listen(port, host, () => {
  console.log(`Finn server running at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
});
