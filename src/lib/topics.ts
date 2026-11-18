import type { Question } from "./domain";

export interface TopicGroup {
  id: string;
  title: string;
  family: "p1" | "p23";
  bank: Question["bank"];
  collection: string;
  questions: Question[];
  covered: number;
}

export function questionVariant(question: Question) {
  return question.part === 1 ? question.topic.match(/ · (学生版|工作版)$/)?.[1] ?? "" : "";
}

export function groupTopics(questions: Question[]): TopicGroup[] {
  const groups = new Map<string, TopicGroup>();
  for (const question of questions) {
    const family = question.part === 1 ? "p1" : "p23";
    const topic = question.part === 1 ? question.topic.replace(/ · (学生版|工作版)$/, "") : question.topic;
    const id = JSON.stringify([question.collection, family, question.bank, topic]);
    let group = groups.get(id);
    if (!group) {
      group = { id, title: topic, family, bank: question.bank, collection: question.collection, questions: [], covered: 0 };
      groups.set(id, group);
    }
    group.questions.push(question);
    if (question.part === 2) group.title = question.title;
    if (question.answer_count > 0) group.covered++;
  }
  return [...groups.values()];
}

export function matchesTopic(group: TopicGroup, search: string) {
  const needle = search.toLocaleLowerCase().trim();
  return !needle || [group.title, ...group.questions.flatMap(q => [q.topic, q.title, q.prompt])]
    .some(text => text.toLocaleLowerCase().includes(needle));
}
