import { z } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const uuid = z.string().uuid();
export const answerInput = z.object({
  title: z.string().trim().max(120).default(""),
  body: z.string().trim().min(1, "请粘贴答案或练习内容").max(40000, "答案最多 40000 个字符"),
  feedback: z.string().trim().max(40000, "反馈最多 40000 个字符").default(""),
});
export const passwordPattern = "(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{9,256}";
export const passwordHelp = "至少 9 位，仅包含英文字母和数字，且两者都要有";
export const validPassword = (value: string) => new RegExp(`^${passwordPattern}$`).test(value);

export interface Question {
  id: string;
  part: 1 | 2 | 3;
  topic: string;
  title: string;
  prompt: string;
  bank: "regular" | "new";
  collection: string;
  is_demo: boolean;
  answer_count: number;
}
export interface Answer {
  id: string;
  question_id: string;
  title: string;
  body: string;
  feedback: string;
  created_at: string;
  updated_at: string;
}
export interface RecentAnswer extends Answer {
  question_title: string;
  part: number;
}
export interface Catalog {
  questions: Question[];
  recent: RecentAnswer[];
  totalAnswers: number;
}
