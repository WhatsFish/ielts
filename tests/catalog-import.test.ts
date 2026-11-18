import test from "node:test";
import assert from "node:assert/strict";
import { catalogInput, catalogQuestionId } from "../src/lib/catalog-import";

const question = { part: 1 as const, topic: "Example topic", title: "Example question", prompt: "What do you enjoy?", bank: "retained" as const };

test("stable question IDs keep answers attached across formatting and label updates", () => {
  const first = catalogQuestionId("Example collection", question);
  assert.equal(first, catalogQuestionId("Example collection", { ...question, prompt: " What   do you enjoy? " }));
  assert.notEqual(first, catalogQuestionId("Other collection", question));
  assert.notEqual(first, catalogQuestionId("Example collection", { ...question, topic: "Different context" }));
});

test("catalog validation distinguishes retained questions and rejects duplicate or unlabelled entries", () => {
  assert.equal(catalogInput.safeParse({ collection: "Example", questions: [question] }).success, true);
  assert.equal(catalogInput.safeParse({ collection: "Example", questions: [question, { ...question, title: "Another title" }] }).success, false);
  assert.equal(catalogInput.safeParse({ collection: "Example", questions: [{ ...question, bank: "unknown" }] }).success, false);
  assert.equal(catalogInput.safeParse({ collection: "Example", questions: [] }).success, false);
});
