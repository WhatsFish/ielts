import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";

const questionInput = z.object({
  part: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  topic: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  prompt: z.string().trim().min(1).max(10000),
  bank: z.enum(["regular", "retained", "new"]),
  source_page: z.number().int().positive().optional(),
  source_number: z.number().int().positive().optional(),
});
type ImportQuestion = z.infer<typeof questionInput>;
const normalized = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

export function catalogQuestionId(collection: string, question: Pick<ImportQuestion, "part" | "topic" | "prompt">) {
  const bytes = createHash("sha256").update(JSON.stringify([
    "ielts-catalog-v1", normalized(collection), question.part, normalized(question.topic), normalized(question.prompt),
  ])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const catalogInput = z.object({
  collection: z.string().trim().min(1).max(200),
  source: z.object({
    filename: z.string().min(1).max(500),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    pages: z.number().int().positive(),
  }).optional(),
  questions: z.array(questionInput).min(1).max(10000),
}).superRefine((input, context) => {
  const seen = new Set<string>();
  input.questions.forEach((question, index) => {
    const id = catalogQuestionId(input.collection, question);
    if (seen.has(id)) context.addIssue({ code: "custom", path: ["questions", index], message: "Duplicate question within the same topic and collection" });
    seen.add(id);
    if (input.source && question.source_page && question.source_page > input.source.pages) {
      context.addIssue({ code: "custom", path: ["questions", index, "source_page"], message: "Source page exceeds PDF page count" });
    }
  });
});

export async function importCatalog(client: PoolClient, input: z.infer<typeof catalogInput>, replaceUnansweredDemos = false) {
  await client.query("SELECT pg_advisory_xact_lock(3017,2)");
  for (const [index, question] of input.questions.entries()) {
    await client.query(`INSERT INTO questions(id,part,topic,title,prompt,bank,collection,is_demo,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,$7,false,$8)
      ON CONFLICT(id) DO UPDATE SET part=excluded.part,topic=excluded.topic,title=excluded.title,
        prompt=excluded.prompt,bank=excluded.bank,collection=excluded.collection,is_demo=false,sort_order=excluded.sort_order`,
    [catalogQuestionId(input.collection, question), question.part, question.topic, question.title, question.prompt,
      question.bank, input.collection, index + 1]);
  }
  const removed = replaceUnansweredDemos ? await client.query(
    "DELETE FROM questions q WHERE q.is_demo AND NOT EXISTS(SELECT 1 FROM answers a WHERE a.question_id=q.id) RETURNING id") : null;
  return { upserted: input.questions.length, removedUnansweredDemos: removed?.rowCount ?? 0 };
}
