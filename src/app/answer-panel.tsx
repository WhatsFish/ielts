"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, Check, Copy, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, formattedDate } from "@/lib/client";
import type { Answer, Question } from "@/lib/domain";

const emptyDraft = { title: "", body: "", feedback: "" };
export interface EditorState { dirty: boolean; saving: boolean }

export function AnswerPanel({ question, onState, onRefresh, onNotice, onCopy }: {
  question: Question;
  onState: (state: EditorState) => void;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
  onCopy: (text: string) => void;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [initialDraft, setInitialDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const dirty = editing !== null && JSON.stringify(draft) !== JSON.stringify(initialDraft);
  useEffect(() => {
    onState({ dirty, saving });
    return () => onState({ dirty: false, saving: false });
  }, [dirty, saving, onState]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError("");
    api<Answer[]>(`questions/${question.id}/answers`, "GET", undefined, controller.signal)
      .then(setAnswers)
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [question.id, loadKey]);

  function closeEditor() {
    setEditing(null); setDraft(emptyDraft); setInitialDraft(emptyDraft);
  }
  function mayLeave() {
    return !saving && (!dirty || window.confirm("当前内容还没有保存，确定放弃修改吗？"));
  }
  function editAnswer(answer?: Answer) {
    if (!mayLeave()) return;
    const next = answer ? { title: answer.title, body: answer.body, feedback: answer.feedback } : emptyDraft;
    setDraft(next); setInitialDraft(next); setEditing(answer?.id ?? "new");
    setTimeout(() => document.getElementById("answer-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError("");
    try {
      const saved = await api<Answer>(editing === "new" ? `questions/${question.id}/answers` : `answers/${editing}`,
        editing === "new" ? "POST" : "PATCH", draft);
      setAnswers(previous => editing === "new" ? [saved, ...previous] : previous.map(a => a.id === saved.id ? saved : a));
      closeEditor(); onNotice("答案已保存");
      try { await onRefresh(); }
      catch { setError("答案已保存，但概览刷新失败；请刷新页面"); }
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败，内容仍保留，请重试"); }
    finally { setSaving(false); }
  }
  async function remove(answer: Answer) {
    if (!mayLeave() || !window.confirm(`删除「${answer.title || "未命名答案"}」？删除后无法恢复。`)) return;
    setSaving(true); setError("");
    try {
      await api(`answers/${answer.id}`, "DELETE");
      setAnswers(previous => previous.filter(a => a.id !== answer.id));
      if (editing === answer.id) closeEditor();
      onNotice("答案已删除");
      try { await onRefresh(); }
      catch { setError("答案已删除，但概览刷新失败；请刷新页面"); }
    } catch (error) { setError(error instanceof Error ? error.message : "删除失败"); }
    finally { setSaving(false); }
  }
  return <div className="question-answers">
    <div className="answer-section-title"><div><h3>我的答案<span>{loading ? "…" : answers.length}</span></h3><p>仅保存在当前这道题下，支持多个版本。</p></div><div className="panel-actions"><button className="button secondary compact" onClick={() => onCopy(question.prompt)}><Copy size={14} />复制题目</button><button className="button primary compact" onClick={() => editAnswer()} disabled={saving || loading || !!loadError}><Plus size={15} />添加答案</button></div></div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {editing !== null && <form id="answer-editor" className="answer-editor" onSubmit={save}><fieldset disabled={saving}><div className="editor-title"><h3>{editing === "new" ? "留下一份新答案" : "编辑这份答案"}</h3><button type="button" className="icon-button" aria-label="关闭编辑" onClick={() => { if (mayLeave()) closeEditor(); }}><X size={17} /></button></div>
      <label>标题 <span className="optional">可选</span><input value={draft.title} maxLength={120} placeholder="例如：旅行经历版 / 第二次练习" onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>推荐答案 / 练习内容<textarea required maxLength={40000} rows={9} value={draft.body} placeholder="把 ChatGPT 推荐的答案粘贴到这里，也可以直接粘贴整段练习内容。" onChange={e => setDraft({ ...draft, body: e.target.value })} /></label>
      <label>Feedback / 我的思路 <span className="optional">可选</span><textarea rows={5} maxLength={40000} value={draft.feedback} placeholder="评分、改进建议、自己的思路，都可以放在这里。" onChange={e => setDraft({ ...draft, feedback: e.target.value })} /></label>
      <div className="editor-footer"><span>{dirty ? "有未保存的内容" : "保存后可随时回来查看"}</span><button className="button primary" disabled={!draft.body.trim()}>{saving ? "保存中…" : "保存答案"}<Check size={16} /></button></div>
    </fieldset></form>}
    {loading ? <p className="muted loading-answers">正在加载答案…</p> : loadError ? <div className="error-message" role="alert">{loadError}<button onClick={() => setLoadKey(k => k + 1)}>重试</button></div> :
      !answers.length && editing === null ? <div className="answer-empty"><MessageSquare size={24} /><h4>这道题，还在等你的第一份答案</h4><p>先复制题目去练习，回来直接粘贴就好。</p><button className="text-button" onClick={() => editAnswer()}>添加第一份答案<ArrowDown size={14} /></button></div> :
        answers.map((a, index) => <article className="answer-card" key={a.id}><div className="saved-answer-heading"><div><span className="eyebrow">ANSWER {String(answers.length - index).padStart(2, "0")}</span><h4>{a.title || "未命名答案"}</h4><time dateTime={a.updated_at}>{formattedDate(a.updated_at)} · 已保存</time></div><div className="answer-actions"><button className="icon-button" aria-label={`复制答案 ${a.title || index + 1}`} onClick={() => onCopy(a.body)}><Copy size={15} /></button><button className="icon-button" aria-label={`编辑答案 ${a.title || index + 1}`} disabled={saving} onClick={() => editAnswer(a)}><Pencil size={15} /></button><button className="icon-button danger" aria-label={`删除答案 ${a.title || index + 1}`} disabled={saving} onClick={() => remove(a)}><Trash2 size={15} /></button></div></div>
          <div className="answer-body" lang="en">{a.body}</div>{a.feedback && <div className="feedback-box"><span><MessageSquare size={14} />FEEDBACK / 我的思路</span><div>{a.feedback}</div></div>}
        </article>)}
  </div>;
}
