import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { query, transaction } from "./db";
import { AppError, passwordHelp, validPassword } from "./domain";

const derive = promisify(scrypt);
export const cookieName = "ielts_session";
export const sessionSeconds = 86400 * 30;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = await derive(password, salt, 64) as Buffer;
  return `${salt}:${digest.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) return false;
  const [salt, digest] = stored.split(":");
  return timingSafeEqual(Buffer.from(digest, "hex"), await derive(password, salt, 64) as Buffer);
}

export async function authenticated(token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  return (await query("SELECT token_hash FROM sessions WHERE token_hash=$1 AND expires_at>now()", [tokenHash(token)])).length > 0;
}

export function checkOrigin(request: Request) {
  const configured = process.env.PUBLIC_URL;
  if (!configured) throw new AppError(503, "configuration", "服务尚未配置");
  if (request.headers.get("origin") !== new URL(configured).origin) {
    throw new AppError(403, "origin", "请求来源不受信任，请刷新页面重试");
  }
}

export async function login(username: string, password: string) {
  const [limit] = await query<{ attempts: number }>(
    `INSERT INTO login_limits(id) VALUES(true) ON CONFLICT(id) DO UPDATE SET
      attempts=CASE WHEN login_limits.started_at<now()-interval '15 minutes' THEN 1 ELSE login_limits.attempts+1 END,
      started_at=CASE WHEN login_limits.started_at<now()-interval '15 minutes' THEN now() ELSE login_limits.started_at END
      RETURNING attempts`);
  if (limit.attempts > 12) throw new AppError(429, "rate_limit", "尝试过于频繁，请 15 分钟后再试");
  const [credentials] = await query<{ password_hash: string }>("SELECT password_hash FROM admin_credentials WHERE id=true");
  if (!credentials) throw new AppError(409, "setup_required", "尚未设置密码，请使用专属链接完成首次设置");
  if (!(await verifyPassword(password, credentials.password_hash)) || username !== "admin") {
    throw new AppError(401, "credentials", "用户名或密码不正确");
  }
  const token = randomBytes(32).toString("hex");
  await transaction(async client => {
    await client.query("DELETE FROM login_limits");
    await client.query("DELETE FROM sessions WHERE expires_at<=now()");
    await client.query("INSERT INTO sessions(token_hash,expires_at) VALUES($1,now()+$2*interval '1 second')", [tokenHash(token), sessionSeconds]);
  });
  return token;
}

export async function setPassword(token: string, password: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AppError(400, "setup_token", "设置链接无效或已过期");
  if (!validPassword(password)) throw new AppError(400, "password", passwordHelp);
  const hash = await hashPassword(password);
  await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(3017,1)");
    const result = await client.query(
      "SELECT token_hash FROM password_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE",
      [tokenHash(token)]);
    if (!result.rowCount) throw new AppError(400, "setup_token", "设置链接无效、已使用或已过期");
    await client.query(`INSERT INTO admin_credentials(id,password_hash) VALUES(true,$1)
      ON CONFLICT(id) DO UPDATE SET password_hash=$1,updated_at=now()`, [hash]);
    await client.query("UPDATE password_tokens SET used_at=now() WHERE used_at IS NULL");
    await client.query("DELETE FROM sessions");
    await client.query("DELETE FROM login_limits");
  });
}
