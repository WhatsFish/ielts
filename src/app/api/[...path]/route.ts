import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { authenticated, checkOrigin, cookieName, login, sessionSeconds, setPassword, tokenHash } from "@/lib/auth";
import { query } from "@/lib/db";
import { answerInput, AppError, uuid } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { path: string[] } };
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new AppError(415, "content_type", "请使用 JSON 提交");
  }
  if (!request.body) throw new AppError(400, "body", "请求内容为空");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) {
        await reader.cancel();
        throw new AppError(413, "body_size", "内容过长，请分条保存");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError(400, "json", "提交内容格式不正确"); }
}

function failure(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof ZodError) return json({ error: error.issues[0]?.message ?? "输入内容不正确" }, 400);
  console.error("[ielts] request_failed", error instanceof Error ? error.name : "unknown");
  return json({ error: "服务暂时不可用，请稍后重试" }, 503);
}

async function requireLogin(request: NextRequest) {
  if (!(await authenticated(request.cookies.get(cookieName)?.value))) {
    throw new AppError(401, "login", "登录已过期，请重新登录；未保存的内容仍保留在当前页面");
  }
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const route = params.path.join("/");
    if (route === "health") {
      const rows = await query("SELECT version FROM schema_version WHERE version=1");
      if (!rows.length) throw new AppError(503, "schema", "数据库未就绪");
      return json({ status: "ok" });
    }
    await requireLogin(request);
    if (route === "catalog") {
      const [questions, recent, totals] = await Promise.all([
        query(`SELECT q.*,count(a.id)::int AS answer_count FROM questions q
          LEFT JOIN answers a ON a.question_id=q.id GROUP BY q.id ORDER BY q.sort_order,q.id`),
        query(`SELECT a.*,q.title AS question_title,q.part FROM answers a
          JOIN questions q ON q.id=a.question_id ORDER BY a.updated_at DESC,a.id LIMIT 5`),
        query<{ total: number }>("SELECT count(*)::int AS total FROM answers"),
      ]);
      return json({ questions, recent, totalAnswers: totals[0].total });
    }
    if (params.path.length === 3 && params.path[0] === "questions" && params.path[2] === "answers") {
      const id = uuid.parse(params.path[1]);
      if (!(await query("SELECT id FROM questions WHERE id=$1", [id])).length) throw new AppError(404, "question", "题目不存在");
      return json(await query("SELECT * FROM answers WHERE question_id=$1 ORDER BY created_at DESC,id", [id]));
    }
    throw new AppError(404, "route", "页面不存在");
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    checkOrigin(request);
    const route = params.path.join("/");
    if (route === "login") {
      const input = z.object({ username: z.string().max(80), password: z.string().min(1).max(256) }).parse(await body(request));
      const token = await login(input.username, input.password);
      const response = json({ ok: true });
      response.cookies.set(cookieName, token, {
        httpOnly: true, secure: true, sameSite: "strict", path: "/ielts", maxAge: sessionSeconds,
      });
      return response;
    }
    if (route === "password") {
      const input = z.object({ token: z.string().length(64), password: z.string().max(256) }).parse(await body(request));
      await setPassword(input.token, input.password);
      return json({ ok: true });
    }
    if (route === "logout") {
      const token = request.cookies.get(cookieName)?.value;
      if (token) await query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(token)]);
      const response = json({ ok: true });
      response.cookies.set(cookieName, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/ielts", maxAge: 0 });
      return response;
    }
    await requireLogin(request);
    if (params.path.length === 3 && params.path[0] === "questions" && params.path[2] === "answers") {
      const id = uuid.parse(params.path[1]);
      const input = answerInput.parse(await body(request));
      const rows = await query(`INSERT INTO answers(question_id,title,body,feedback)
        SELECT id,$2,$3,$4 FROM questions WHERE id=$1 RETURNING *`, [id, input.title, input.body, input.feedback]);
      if (!rows.length) throw new AppError(404, "question", "题目不存在");
      return json(rows[0], 201);
    }
    throw new AppError(404, "route", "操作不存在");
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    checkOrigin(request);
    await requireLogin(request);
    if (params.path.length !== 2 || params.path[0] !== "answers") throw new AppError(404, "route", "操作不存在");
    const id = uuid.parse(params.path[1]);
    const input = answerInput.parse(await body(request));
    const rows = await query(`UPDATE answers SET title=$2,body=$3,feedback=$4,updated_at=now() WHERE id=$1 RETURNING *`,
      [id, input.title, input.body, input.feedback]);
    if (!rows.length) throw new AppError(404, "answer", "这条答案已经不存在");
    return json(rows[0]);
  } catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    checkOrigin(request);
    await requireLogin(request);
    if (params.path.length !== 2 || params.path[0] !== "answers") throw new AppError(404, "route", "操作不存在");
    const rows = await query("DELETE FROM answers WHERE id=$1 RETURNING id", [uuid.parse(params.path[1])]);
    if (!rows.length) throw new AppError(404, "answer", "这条答案已经不存在");
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
