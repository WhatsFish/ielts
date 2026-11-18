import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { testApp } from "./app-helper.mjs";
import { tokenHash } from "../src/lib/auth";
import { catalogInput, catalogQuestionId, importCatalog } from "../src/lib/catalog-import";

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

test("catalog imports are idempotent and preserve answers on both demos and imported questions", async () => {
  const app = await testApp();
  try {
    const migration = await readFile(new URL("../db/migrations/002-retained-bank.sql", import.meta.url), "utf8");
    await app.pool.query(migration);
    await app.pool.query(migration);
    const demo = (await app.pool.query("SELECT id FROM questions ORDER BY id LIMIT 1")).rows[0].id;
    await app.pool.query("INSERT INTO answers(question_id,body) VALUES($1,'Saved demo answer')", [demo]);
    const input = catalogInput.parse({
      collection: "Integration test collection",
      questions: [
        { part: 1, topic: "Example", title: "Short question", prompt: "What do you enjoy?", bank: "retained" },
        { part: 2, topic: "Example story", title: "An experience", prompt: "Describe an experience.\n\nYou should say:\n- What happened\nAnd explain why it mattered.", bank: "new" },
      ],
    });
    const run = async () => {
      const client = await app.pool.connect();
      try {
        await client.query("BEGIN");
        const result = await importCatalog(client, input, true);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    };
    assert.deepEqual(await run(), { upserted: 2, removedUnansweredDemos: 11 });
    const id = catalogQuestionId(input.collection, input.questions[0]);
    await app.pool.query("INSERT INTO answers(question_id,body) VALUES($1,'Saved imported answer')", [id]);
    input.questions[0].title = "Edited heading";
    assert.deepEqual(await run(), { upserted: 2, removedUnansweredDemos: 0 });
    const rows = (await app.pool.query("SELECT question_id,body FROM answers ORDER BY body")).rows;
    assert.deepEqual(rows, [
      { question_id: demo, body: "Saved demo answer" },
      { question_id: id, body: "Saved imported answer" },
    ]);
    assert.equal((await app.pool.query("SELECT count(*)::int AS n FROM questions")).rows[0].n, 3);
    assert.equal((await app.pool.query("SELECT title FROM questions WHERE id=$1", [id])).rows[0].title, "Edited heading");
  } finally { await app.close(); }
});
