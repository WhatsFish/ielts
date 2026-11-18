import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { testApp } from "./app-helper.mjs";
import { tokenHash } from "../src/lib/auth";

test("admin setup, private catalog and persisted answer lifecycle", async () => {
  const app = await testApp();
  const password = "IntegrationPassword123";
  const call = (path: string, method = "GET", data?: unknown, cookie?: string, origin = app.origin) =>
    fetch(`${app.url}/api/${path}`, { method, headers: {
      Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}),
    }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  try {
    assert.equal((await call("catalog")).status, 401);
    assert.equal((await call("login", "POST", { username: "admin", password }, undefined, "https://evil.invalid")).status, 403);
    assert.equal((await call("login", "POST", { username: "admin", password })).status, 409);
    const token = randomBytes(32).toString("hex");
    await app.pool.query("INSERT INTO password_tokens(token_hash,expires_at) VALUES($1,now()+interval '1 hour')", [tokenHash(token)]);
    const expired = randomBytes(32).toString("hex");
    await app.pool.query("INSERT INTO password_tokens(token_hash,expires_at) VALUES($1,now()-interval '1 hour')", [tokenHash(expired)]);
    assert.equal((await call("password", "POST", { token: expired, password })).status, 400);
    assert.equal((await call("password", "POST", { token, password: "weak" })).status, 400);
    assert.equal((await call("password", "POST", { token, password })).status, 200);
    assert.equal((await call("password", "POST", { token, password })).status, 400);
    assert.equal((await call("login", "POST", { username: "admin", password: "Incorrect123" })).status, 401);
    const login = await call("login", "POST", { username: "admin", password });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=strict/i);
    assert.match(setCookie, /Path=\/ielts/i);
    const cookie = setCookie.split(";")[0];
    const data = await (await call("catalog", "GET", undefined, cookie)).json();
    assert.equal(data.questions.length, 12);
    assert.equal(data.totalAnswers, 0);
    const id = data.questions[0].id;
    const input = { title: "First version", body: "A first answer.\nAnother paragraph.", feedback: "Feedback\nUse a concrete example." };
    assert.equal((await call(`questions/${id}/answers`, "POST", input)).status, 401);
    assert.equal((await call(`questions/${id}/answers`, "POST", { body: " " }, cookie)).status, 400);
    assert.equal((await call("answers/30170000-0000-4000-8000-999999999999", "DELETE", undefined, cookie)).status, 404);
    const create = await call(`questions/${id}/answers`, "POST", input, cookie);
    assert.equal(create.status, 201);
    const first = await create.json();
    const second = await (await call(`questions/${id}/answers`, "POST", { body: "Another approach." }, cookie)).json();
    const records = await (await call(`questions/${id}/answers`, "GET", undefined, cookie)).json();
    assert.equal(records.length, 2);
    assert.equal(records.find((a: { id: string }) => a.id === first.id).body, input.body);
    const edit = await call(`answers/${first.id}`, "PATCH", { ...input, body: "Updated answer." }, cookie);
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).body, "Updated answer.");
    const catalog = await (await call("catalog", "GET", undefined, cookie)).json();
    assert.equal(catalog.totalAnswers, 2);
    assert.equal(catalog.questions.find((q: { id: string }) => q.id === id).answer_count, 2);
    assert.equal((await call(`answers/${second.id}`, "DELETE", undefined, cookie)).status, 200);
    assert.equal((await call(`questions/${id}/answers`, "GET", undefined, cookie)).status, 200);
    assert.equal((await call("logout", "POST", undefined, cookie)).status, 200);
    assert.equal((await call("catalog", "GET", undefined, cookie)).status, 401);
    assert.equal((await call("logout", "POST", undefined, cookie)).status, 200);
    const { rows } = await app.pool.query("SELECT password_hash FROM admin_credentials");
    assert.notEqual(rows[0].password_hash, password);
    assert.equal((await call("login", "POST", { username: "admin", password })).status, 200);
    for (let i = 0; i < 12; i++) await call("login", "POST", { username: "admin", password: "Incorrect123" });
    assert.equal((await call("login", "POST", { username: "admin", password })).status, 429);
  } finally { await app.close(); }
});
