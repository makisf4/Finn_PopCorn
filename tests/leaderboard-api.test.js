import assert from "node:assert/strict";
import { describe, it } from "node:test";
import handler from "../api/leaderboard.js";

function responseRecorder() {
  const headers = new Map();
  let body = "";
  return {
    statusCode: 200,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value));
    },
    end(chunk = "") {
      body += String(chunk);
    },
    snapshot() {
      return { statusCode: this.statusCode, headers, body };
    },
  };
}

function request(body) {
  return {
    method: "POST",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    body,
  };
}

describe("leaderboard API input boundary", () => {
  it("rejects the removed public rename action before accessing storage", async () => {
    const res = responseRecorder();
    await handler(request({ action: "rename", fromName: "Finn", toName: "Max" }), res);
    const result = res.snapshot();
    assert.equal(result.statusCode, 400);
    assert.deepEqual(JSON.parse(result.body), { error: "Unsupported leaderboard action" });
  });

  it("rejects implausible run telemetry before accessing storage", async () => {
    const res = responseRecorder();
    await handler(request({
      action: "record",
      name: "Φίλης",
      score: 999999,
      difficulty: "normal",
      duration: 2,
      catches: 1,
      misses: 0,
      bestCombo: 1,
    }), res);
    const result = res.snapshot();
    assert.equal(result.statusCode, 400);
    assert.deepEqual(JSON.parse(result.body), { error: "Implausible run data" });
  });

  it("returns a generic storage error without leaking configuration details", async () => {
    const res = responseRecorder();
    const originalError = console.error;
    console.error = () => {};
    try {
      await handler({ method: "GET", headers: {}, socket: {} }, res);
    } finally {
      console.error = originalError;
    }
    const result = res.snapshot();
    assert.equal(result.statusCode, 500);
    assert.deepEqual(JSON.parse(result.body), { error: "Leaderboard service unavailable" });
  });
});
