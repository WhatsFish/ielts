import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { catalogInput, importCatalog } from "../src/lib/catalog-import";
import { pool } from "../src/lib/db";

const file = process.argv[2];
try {
  if (!file || file.startsWith("--")) throw new Error("Usage: tsx scripts/import-catalog.ts /private/catalog.json [--replace-unanswered-demos]");
  if ((await stat(file)).size > 5 * 1024 * 1024) throw new Error("Catalog JSON exceeds 5 MB");
  const input = catalogInput.parse(JSON.parse(await readFile(file, "utf8")));
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SELECT pg_advisory_xact_lock(3017,2)");
    const questions = (await client.query("SELECT * FROM questions ORDER BY id")).rows;
    const answers = (await client.query("SELECT * FROM answers ORDER BY id")).rows;
    const backupDir = "/data/ielts/backups";
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    const backup = path.join(backupDir, `catalog-before-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}.json`);
    await writeFile(backup, JSON.stringify({ questions, answers }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    const result = await importCatalog(client, input, process.argv.includes("--replace-unanswered-demos"));
    await client.query("COMMIT");
    console.log(JSON.stringify({ ...result, backup, preservedAnswers: answers.length }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
} finally { await pool.end(); }
