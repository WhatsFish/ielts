"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, BookOpen, Check, ChevronRight, Copy, FileText, LayoutDashboard, LogOut, MessageSquare, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { api, formattedDate } from "@/lib/client";
import type { Answer, Catalog, Question } from "@/lib/domain";

type View = "overview" | "catalog";
const emptyDraft = { title: "", body: "", feedback: "" };

function Part({ value }: { value: number }) {
  return <span className={`part part-${value}`}>PART {value}</span>;
}

export function Workspace() {
  const [view, setView] = useState<View>("overview");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [part, setPart] = useState("all");
  const [bank, setBank] = useState("all");
  const [topic, setTopic] = useState("all");
  const [collection, setCollection] = useState("all");
  const [unanswered, setUnanswered] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [initialDraft, setInitialDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const dirty = editing !== null && JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const question = catalog?.questions.find(q => q.id === selectedId);

  const loadCatalog = useCallback(async () => {
    const data = await api<Catalog>("catalog");
    setCatalog(data); setError("");
  }, []);
  useEffect(() => { loadCatalog().catch(error => setError(error.message)); }, [loadCatalog]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setAnswersLoading(true); setAnswersError(""); setAnswers([]);
    api<Answer[]>(`questions/${selectedId}/answers`, "GET", undefined, controller.signal)
      .then(setAnswers)
      .catch(error => { if (!controller.signal.aborted) setAnswersError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setAnswersLoading(false); });
    return () => controller.abort();
  }, [selectedId, loadKey]);

  function mayLeave() {
    return !saving && (!dirty || window.confirm("当前内容还没有保存，确定放弃修改吗？"));
  }
  function closeEditor() {
    setEditing(null); setDraft(emptyDraft); setInitialDraft(emptyDraft);
  }
  function navigate(next: View) {
    if (!mayLeave()) return;
    closeEditor(); setView(next);
  }
  function selectQuestion(q: Question) {
    if (!mayLeave()) return;
    closeEditor(); setSelectedId(q.id); setView("catalog");
    if (window.matchMedia("(max-width: 720px)").matches) window.scrollTo({ top: 0 });
  }
  function openQuestion(id: string) {
    const q = catalog?.questions.find(item => item.id === id);
    if (q) {
      setSearch(""); setPart("all"); setBank("all"); setTopic("all"); setCollection("all"); setUnanswered(false);
      selectQuestion(q);
    }
  }
  function editAnswer(answer?: Answer) {
    if (!mayLeave()) return;
    const next = answer ? { title: answer.title, body: answer.body, feedback: answer.feedback } : emptyDraft;
    setDraft(next); setInitialDraft(next); setEditing(answer?.id ?? "new");
    setTimeout(() => document.getElementById("answer-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("已复制到剪贴板"); }
    catch { setError("复制失败，请长按或选中文字手动复制"); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question || !editing) return;
    setSaving(true); setError("");
    try {
      const saved = await api<Answer>(
        editing === "new" ? `questions/${question.id}/answers` : `answers/${editing}`,
        editing === "new" ? "POST" : "PATCH", draft);
      setAnswers(previous => editing === "new" ? [saved, ...previous] : previous.map(a => a.id === saved.id ? saved : a));
      closeEditor(); setNotice("答案已保存");
      try { await loadCatalog(); }
      catch { setError("答案已保存，但概览刷新失败；请点击重新加载"); }
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败，内容仍保留，请重试"); }
    finally { setSaving(false); }
  }
  async function remove(answer: Answer) {
    if (!mayLeave() || !window.confirm(`删除「${answer.title || "未命名答案"}」？删除后无法恢复。`)) return;
    setSaving(true);
    try {
      await api(`answers/${answer.id}`, "DELETE");
      setAnswers(previous => previous.filter(a => a.id !== answer.id));
      if (editing === answer.id) closeEditor();
      setNotice("答案已删除");
      try { await loadCatalog(); }
      catch { setError("答案已删除，但概览刷新失败；请点击重新加载"); }
    } catch (error) { setError(error instanceof Error ? error.message : "删除失败"); }
    finally { setSaving(false); }
  }
  async function logout() {
    if (!mayLeave()) return;
    try { await api("logout", "POST"); window.location.assign("/ielts"); }
    catch (error) { setError(error instanceof Error ? error.message : "退出失败"); }
  }

  const questions = catalog?.questions ?? [];
  const topics = [...new Set(questions.map(q => q.topic))];
  const collections = [...new Set(questions.map(q => q.collection))];
  const answered = questions.filter(q => q.answer_count > 0).length;
  const filtered = useMemo(() => {
    const needle = search.toLocaleLowerCase().trim();
    return (catalog?.questions ?? []).filter(q =>
      (part === "all" || q.part === Number(part)) && (bank === "all" || q.bank === bank) &&
      (topic === "all" || q.topic === topic) && (collection === "all" || q.collection === collection) &&
      (!unanswered || q.answer_count === 0) &&
      (!needle || `${q.title} ${q.prompt} ${q.topic}`.toLocaleLowerCase().includes(needle)));
  }, [catalog, part, bank, topic, collection, unanswered, search]);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/ielts" onClick={event => { event.preventDefault(); navigate("overview"); }}>
        <span className="brand-icon"><AudioLines size={24} /></span><span>Speaking Room<small>雅思口语 · 个人答案库</small></span>
      </a>
      <p className="nav-label">YOUR WORKSPACE</p>
      <nav aria-label="主导航">
        <button className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => navigate("overview")}><LayoutDashboard size={18} />学习概览{view === "overview" && <span className="nav-dot" />}</button>
        <button className={`nav-item ${view === "catalog" ? "active" : ""}`} onClick={() => navigate("catalog")}><BookOpen size={18} />题目 Catalog<span className="nav-count">{questions.length}</span></button>
      </nav>
      <div className="sidebar-note"><span className="small-icon"><MessageSquare size={19} /></span><p>不必一次说得完美。</p><span>把每一次值得留下的表达，<br />慢慢收集起来。</span><div className="little-wave"><i /><i /><i /><i /><i /><i /><i /></div></div>
      <div className="account"><span className="avatar">A</span><span>admin<small>你的私人空间</small></span><button className="icon-button" aria-label="退出登录" onClick={logout} disabled={saving}><LogOut size={17} /></button></div>
    </aside>
    <main className={`main ${view === "catalog" ? "catalog-main" : ""} ${view === "catalog" && question ? "has-question" : ""}`}>
      <header className="topbar"><span>我的学习空间 <ChevronRight size={13} /><strong>{view === "overview" ? "学习概览" : "题目 Catalog"}</strong></span><span className="private-mark"><span />PRIVATE SPACE</span></header>
      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => loadCatalog().catch(error => setError(error.message))}>重新加载</button><button className="icon-button" aria-label="关闭提示" onClick={() => setError("")}><X size={15} /></button></div>}
      {!catalog ? <div className="loading-state"><AudioLines size={28} /><p>{error ? "暂时无法加载题库" : "正在打开你的口语空间…"}</p></div> : view === "overview" ? <>
        <section className="page-heading"><div><p className="eyebrow">SMALL STEPS. BETTER ANSWERS.</p><h1>每一次练习，都算数<span className="accent">。</span></h1><p className="muted">找题、开口，把好答案留在这里。按自己的节奏来。</p></div><button className="button primary" onClick={() => navigate("catalog")}>打开题库<ArrowUpRight size={17} /></button></section>
        {questions.some(q => q.is_demo) && <div className="demo-banner"><Sparkles size={16} /><span>当前包含原创示例题，仅供体验界面，不代表真实考季题库。正式资料提供后再替换。</span></div>}
        <section className="stats-grid" aria-label="学习统计">
          <div className="stat-card"><span className="stat-icon sage"><BookOpen size={19} /></span><span className="stat-label">题库中的题目</span><strong>{questions.length}<small>道</small></strong><span className="stat-caption">每一道题，都是一个开始</span></div>
          <div className="stat-card"><span className="stat-icon peach"><Check size={19} /></span><span className="stat-label">已有答案的题目</span><strong>{answered}<small>道</small></strong><span className="stat-caption">已留下可随时查看的内容</span></div>
          <div className="stat-card"><span className="stat-icon lilac"><FileText size={19} /></span><span className="stat-label">保存的答案</span><strong>{catalog.totalAnswers}<small>份</small></strong><span className="stat-caption">同一道题，也可以有不同思路</span></div>
          <button className="stat-card stat-link" onClick={() => { setUnanswered(true); navigate("catalog"); }}><span className="stat-icon sand"><MessageSquare size={19} /></span><span className="stat-label">还没有答案</span><strong>{questions.length - answered}<small>道</small></strong><span className="stat-caption">去挑一道聊聊<ArrowRight size={14} /></span></button>
        </section>
        <section className="overview-grid">
          <div className="card recent-card"><div className="section-title"><div><span className="eyebrow">YOUR ANSWER COLLECTION</span><h2>最近留下的答案</h2></div><FileText size={20} className="muted" /></div>
            {catalog.recent.length ? <div className="recent-list">{catalog.recent.map(a => <button key={a.id} onClick={() => openQuestion(a.question_id)}><span className="recent-icon"><MessageSquare size={18} /></span><span><strong>{a.title || a.question_title}</strong><small>Part {a.part} · {a.question_title} · {formattedDate(a.updated_at)}</small></span><ArrowUpRight size={17} /></button>)}</div> :
              <div className="empty-answers"><span className="empty-illustration"><MessageSquare size={28} /><span>＋</span></span><h3>第一份好答案，从这里开始</h3><p>和 ChatGPT 练完后，把推荐答案和反馈粘贴回来。<br />不用整理得很完美，先保存就好。</p><button className="button secondary" onClick={() => navigate("catalog")}>挑一道题<ArrowRight size={16} /></button></div>}
          </div>
          <div className="card part-card"><div className="section-title"><div><span className="eyebrow">ONE PART AT A TIME</span><h2>从哪个 Part 开始？</h2></div></div>
            {[1, 2, 3].map(p => {
              const items = questions.filter(q => q.part === p);
              const count = items.filter(q => q.answer_count > 0).length;
              return <button className="part-row" key={p} onClick={() => { setPart(String(p)); setUnanswered(false); navigate("catalog"); }}><span className={`part-number part-number-${p}`}>0{p}</span><span><strong>{p === 1 ? "日常话题" : p === 2 ? "个人陈述" : "深入讨论"}</strong><small>{count} / {items.length} 道已有答案</small><span className="progress"><i style={{ width: `${items.length ? count / items.length * 100 : 0}%` }} /></span></span><ChevronRight size={17} /></button>;
            })}
            <p className="part-note">保存答案 ≠ 已经掌握。这里只记录你的积累。</p>
          </div>
        </section>
        <section className="workflow-note"><span className="small-icon"><AudioLines size={21} /></span><div><h3>简单一点，才容易坚持。</h3><p>复制题目 → 去 ChatGPT 语音练习 → 回来保存答案与 Feedback</p></div><ArrowUpRight size={22} /></section>
      </> : <>
        <section className="page-heading catalog-heading"><div><p className="eyebrow">YOUR SPEAKING CATALOG</p><h1>一道题，多一种表达<span className="accent">。</span></h1><p className="muted">在这里找题，也在这里收好答案。</p></div><span className="catalog-total">{questions.length} QUESTIONS</span></section>
        <div className="filters">
          <label className="search-field"><Search size={17} /><input aria-label="搜索题目" placeholder="搜索题目、话题或英文关键词…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="icon-button" aria-label="清除搜索" onClick={() => setSearch("")}><X size={15} /></button>}</label>
          <div className="filter-row">
            <div className="segmented" aria-label="Part 筛选">{["all", "1", "2", "3"].map(p => <button key={p} aria-pressed={part === p} className={part === p ? "selected" : ""} onClick={() => setPart(p)}>{p === "all" ? "全部" : `Part ${p}`}</button>)}</div>
            <label className="sr-only" htmlFor="bank-filter">题库类型</label><select id="bank-filter" value={bank} onChange={e => setBank(e.target.value)}><option value="all">全部类型</option><option value="regular">常驻题</option><option value="new">新增题</option></select>
            <label className="sr-only" htmlFor="topic-filter">话题</label><select id="topic-filter" value={topic} onChange={e => setTopic(e.target.value)}><option value="all">全部话题</option>{topics.map(t => <option key={t}>{t}</option>)}</select>
            {collections.length > 1 && <><label className="sr-only" htmlFor="collection-filter">题库资料</label><select id="collection-filter" value={collection} onChange={e => setCollection(e.target.value)}><option value="all">全部题库</option>{collections.map(c => <option key={c}>{c}</option>)}</select></>}
            <label className="checkbox-label"><input type="checkbox" checked={unanswered} onChange={e => setUnanswered(e.target.checked)} />只看暂无答案</label>
          </div>
        </div>
        <section className={`catalog-layout ${question ? "has-selection" : ""}`}>
          <div className="question-list"><div className="list-heading"><span>题目列表</span><span>{filtered.length} 道</span></div>
            {!filtered.length && <div className="list-empty"><Search size={24} /><p>{questions.length ? "没有找到匹配的题目" : "题库还没有题目"}</p><small>{questions.length ? "试试其他关键词或筛选条件" : "提供题库资料后，由后台整理录入"}</small></div>}
            {filtered.map(q => <button key={q.id} className={`question-item ${selectedId === q.id ? "selected" : ""}`} onClick={() => selectQuestion(q)}><span className="question-tags"><Part value={q.part} /><span className={q.bank === "new" ? "new-tag" : "regular-tag"}>{q.bank === "new" ? "新增" : "常驻"}</span>{q.is_demo && <span className="demo-tag">示例</span>}</span><strong>{q.title}</strong><span className="question-preview" lang="en">{q.prompt.split("\n")[0]}</span><span className="question-bottom"><span>{q.topic}</span><span className={q.answer_count ? "has-answer" : ""}>{q.answer_count ? <><Check size={12} />{q.answer_count} 份答案</> : "暂无答案"}</span></span></button>)}
          </div>
          <div className="question-detail">
            {!question ? <div className="select-empty"><span className="empty-illustration"><BookOpen size={30} /></span><h2>挑一道题，开始说说看</h2><p>点击左侧题目，查看题干、复制问题，<br />或者保存你练习后的答案和反馈。</p><span className="tiny-label">ONE QUESTION. A LITTLE MORE CONFIDENCE.</span></div> : <>
              <button className="mobile-back" onClick={() => { if (mayLeave()) { closeEditor(); setSelectedId(null); } }}><ArrowLeft size={16} />返回题目列表</button>
              <div className="detail-heading"><div><div className="question-tags"><Part value={question.part} /><span className="topic-label">{question.topic}</span></div><h2>{question.title}</h2><p className="collection-label">{question.collection}</p></div><button className="button secondary compact" onClick={() => copy(question.prompt)}><Copy size={15} />复制题目</button></div>
              {question.is_demo && <p className="demo-inline">示例题 · 仅供体验，不代表真实考季题库</p>}
              <div className="prompt-box" lang="en">{question.prompt}</div>
              <div className="answer-section-title"><div><h3>我的答案<span>{answersLoading ? "…" : answers.length}</span></h3><p>保留不同版本，也留住不同思路。</p></div><button className="button primary compact" onClick={() => editAnswer()} disabled={saving}><Plus size={16} />添加答案</button></div>
              {editing !== null && <form id="answer-editor" className="answer-editor" onSubmit={save}><fieldset disabled={saving}><div className="editor-title"><h3>{editing === "new" ? "留下一份新答案" : "编辑这份答案"}</h3><button type="button" className="icon-button" aria-label="关闭编辑" onClick={() => { if (mayLeave()) closeEditor(); }}><X size={17} /></button></div>
                <label>标题 <span className="optional">可选</span><input value={draft.title} maxLength={120} placeholder="例如：旅行经历版 / 第二次练习" onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
                <label>推荐答案 / 练习内容<textarea required maxLength={40000} rows={9} value={draft.body} placeholder="把 ChatGPT 推荐的答案粘贴到这里，也可以直接粘贴整段练习内容。" onChange={e => setDraft({ ...draft, body: e.target.value })} /></label>
                <label>Feedback / 我的思路 <span className="optional">可选</span><textarea rows={5} maxLength={40000} value={draft.feedback} placeholder="评分、改进建议、自己的思路，都可以放在这里。" onChange={e => setDraft({ ...draft, feedback: e.target.value })} /></label>
                <div className="editor-footer"><span>{dirty ? "有未保存的内容" : "保存后可随时回来查看"}</span><button className="button primary" disabled={!draft.body.trim()}>{saving ? "保存中…" : "保存答案"}<Check size={16} /></button></div>
              </fieldset></form>}
              {answersLoading ? <p className="muted loading-answers">正在加载答案…</p> : answersError ? <div className="error-message" role="alert">{answersError}<button onClick={() => setLoadKey(k => k + 1)}>重试</button></div> :
                !answers.length && editing === null ? <div className="answer-empty"><MessageSquare size={26} /><h4>这道题，还在等你的第一份答案</h4><p>先复制题目去练习，回来直接粘贴就好。</p><button className="text-button" onClick={() => editAnswer()}>添加第一份答案<ArrowDown size={14} /></button></div> :
                  answers.map((a, index) => <article className="answer-card" key={a.id}><div className="saved-answer-heading"><div><span className="eyebrow">ANSWER {String(answers.length - index).padStart(2, "0")}</span><h4>{a.title || "未命名答案"}</h4><time dateTime={a.updated_at}>{formattedDate(a.updated_at)} · 已保存</time></div><div className="answer-actions"><button className="icon-button" aria-label={`复制答案 ${a.title || index + 1}`} onClick={() => copy(a.body)}><Copy size={15} /></button><button className="icon-button" aria-label={`编辑答案 ${a.title || index + 1}`} disabled={saving} onClick={() => editAnswer(a)}><Pencil size={15} /></button><button className="icon-button danger" aria-label={`删除答案 ${a.title || index + 1}`} disabled={saving} onClick={() => remove(a)}><Trash2 size={15} /></button></div></div>
                    <div className="answer-body" lang="en">{a.body}</div>{a.feedback && <div className="feedback-box"><span><MessageSquare size={14} />FEEDBACK / 我的思路</span><div>{a.feedback}</div></div>}
                  </article>)}
              <p className="detail-footnote">内容仅你登录后可见。先存下来，不必一次整理完美。</p>
            </>}
          </div>
        </section>
      </>}
      <footer className="workspace-footer"><span>SPEAKING ROOM</span><span>A little practice, a clearer voice.</span></footer>
    </main>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
  </div>;
}
