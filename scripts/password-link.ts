import { randomBytes } from "node:crypto";
import { tokenHash } from "../src/lib/auth";
import { pool, transaction } from "../src/lib/db";

try {
  const url = new URL(process.env.PUBLIC_URL ?? "");
  if (url.protocol !== "https:" || url.pathname !== "/ielts" || url.search || url.hash) {
    throw new Error("PUBLIC_URL must be an HTTPS URL ending in /ielts");
  }
  const token = randomBytes(32).toString("hex");
  const expiresAt = await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(3017,1)");
    const existing = await client.query("SELECT id FROM admin_credentials");
    if (existing.rowCount && !process.argv.includes("--reset")) {
      throw new Error("Password is already configured; use --reset only for an explicitly requested reset");
    }
    await client.query("UPDATE password_tokens SET used_at=now() WHERE used_at IS NULL");
    const result = await client.query<{ expires_at: Date }>(
      "INSERT INTO password_tokens(token_hash,expires_at) VALUES($1,now()+interval '24 hours') RETURNING expires_at",
      [tokenHash(token)]);
    return result.rows[0].expires_at;
  });
  url.pathname += "/password";
  url.hash = new URLSearchParams({ token }).toString();
  console.log(JSON.stringify({ setupUrl: url.href, expiresAt, username: "admin", oneUse: true }));
} finally { await pool.end(); }
