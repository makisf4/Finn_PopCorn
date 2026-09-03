import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTypingTarget } from "../src/input.js";

describe("keyboard input targets", () => {
  it("does not capture movement keys while typing in form controls", () => {
    assert.equal(isTypingTarget({ tagName: "INPUT" }), true);
    assert.equal(isTypingTarget({ tagName: "textarea" }), true);
    assert.equal(isTypingTarget({ tagName: "SELECT" }), true);
    assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  });

  it("captures movement keys from non-editable game targets", () => {
    assert.equal(isTypingTarget({ tagName: "BUTTON" }), false);
    assert.equal(isTypingTarget({ tagName: "CANVAS" }), false);
    assert.equal(isTypingTarget(null), false);
  });
});
