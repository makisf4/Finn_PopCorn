import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedName, normalizeName } from "../src/shared/nickname.js";

test("Latin letters and spaces accepted", () => {
  assert.equal(isAllowedName("Finn"), true);
  assert.equal(isAllowedName("Finn Lex"), true);
});

test("Greek letters accepted", () => {
  assert.equal(isAllowedName("Φίλης"), true);
  assert.equal(isAllowedName("Θοδωρής"), true);
});

test("digits rejected", () => {
  assert.equal(isAllowedName("Finn1"), false);
});

test("HTML tags rejected", () => {
  assert.equal(isAllowedName("<script>"), false);
  assert.equal(isAllowedName("x<img"), false);
});

test("empty name rejected", () => {
  assert.equal(isAllowedName(""), false);
  assert.equal(isAllowedName("  "), false);
});

test("normalizeName collapses whitespace and trim", () => {
  assert.equal(normalizeName("  Finn   "), "Finn");
  assert.equal(normalizeName("Finn  Lex"), "Finn Lex");
});

test("blocked fragments are matched case-insensitively and compacted", () => {
  assert.equal(isAllowedName("FuckYou"), false);
  assert.ok(isAllowedName("Mule"));
});

export function frontLogs() {
  return null;
}
