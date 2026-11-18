import test from "node:test";
import assert from "node:assert/strict";
import { answerInput, validPassword } from "../src/lib/domain";
import { hashPassword, tokenHash, verifyPassword } from "../src/lib/auth";

test("pasted answers preserve line breaks and allow optional feedback and title", () => {
  assert.deepEqual(answerInput.parse({ body: "  First line\nSecond line  " }), {
    title: "", body: "First line\nSecond line", feedback: "",
  });
  assert.equal(answerInput.safeParse({ body: " \n " }).success, false);
  assert.equal(answerInput.safeParse({ body: "x", feedback: "x".repeat(40001) }).success, false);
});

test("password policy matches the OurDays admin setup policy", () => {
  for (const password of ["abc123456", "MyPassword123"]) assert.equal(validPassword(password), true);
  for (const password of ["abc123", "abcdefghi", "123456789", "abc12345!", "密码abc123456"]) assert.equal(validPassword(password), false);
});

test("passwords and session tokens are hashed rather than stored in plaintext", async () => {
  const hash = await hashPassword("TestPassword123");
  assert.equal(await verifyPassword("TestPassword123", hash), true);
  assert.equal(await verifyPassword("WrongPassword123", hash), false);
  assert.equal(await verifyPassword("TestPassword123", "malformed"), false);
  assert.notEqual(hash, await hashPassword("TestPassword123"));
  assert.match(tokenHash("test"), /^[a-f0-9]{64}$/);
});
