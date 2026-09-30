import assert from "node:assert/strict";
import test from "node:test";
import { AppError, requireAccountAccess } from "./index.js";

test("permission and account membership are both required", () => {
  assert.doesNotThrow(() => requireAccountAccess(["view_mailbox"], "view_mailbox", false, ["a"], "a"));
  assert.doesNotThrow(() => requireAccountAccess(["view_mailbox"], "view_mailbox", true, [], "future"));
  assert.throws(() => requireAccountAccess([], "view_mailbox", true, [], "a"), (error) => error instanceof AppError && error.code === "forbidden");
  assert.throws(() => requireAccountAccess(["view_mailbox"], "view_mailbox", false, ["a"], "b"), (error) => error instanceof AppError && error.code === "forbidden");
});
