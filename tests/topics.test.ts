import test from "node:test";
import assert from "node:assert/strict";
import type { Question } from "../src/lib/domain";
import { groupTopics, matchesTopic, questionVariant } from "../src/lib/topics";

const question = (id: string, part: 1 | 2 | 3, topic: string, answer_count = 0): Question => ({
  id, part, topic, answer_count, title: `Title ${id}`, prompt: `Prompt ${id}`,
  bank: "retained", collection: "Test", is_demo: false,
});

test("Part 1 student and work variants are one topic, without changing question identities", () => {
  const questions = [question("a", 1, "Work or studies · 学生版", 2), question("b", 1, "Work or studies · 工作版")];
  const groups = groupTopics(questions);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, "Work or studies");
  assert.equal(groups[0].covered, 1);
  assert.deepEqual(groups[0].questions, questions);
  assert.equal(questionVariant(questions[0]), "学生版");
});

test("Part 2 and its Part 3 questions stay together, even if a search matches only an extension", () => {
  const questions = [question("a", 2, "A story"), question("b", 3, "A story"), question("c", 1, "A story")];
  questions[1].prompt = "A unique extension keyword";
  const groups = groupTopics(questions);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].family, "p23");
  assert.deepEqual(groups[0].questions.map(q => q.id), ["a", "b"]);
  assert.equal(matchesTopic(groups[0], "unique extension"), true);
  assert.equal(matchesTopic(groups[1], "unique extension"), false);
});

test("source collections and categories never merge, and orphan discussions are not dropped", () => {
  const a = question("a", 2, "Shared");
  const b = { ...question("b", 3, "Shared"), collection: "Other" };
  const c = { ...question("c", 2, "Shared"), bank: "new" as const };
  assert.equal(groupTopics([a, b, c]).length, 3);
  assert.equal(groupTopics([b])[0].questions[0].id, "b");
});
