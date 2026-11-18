"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, BookOpen, Check, ChevronDown, ChevronRight, Copy, FileText, LayoutDashboard, LogOut, MessageSquare, Search, Sparkles, X } from "lucide-react";
import { api, formattedDate } from "@/lib/client";
import type { Catalog, Question } from "@/lib/domain";
import { groupTopics, matchesTopic, questionVariant, type TopicGroup } from "@/lib/topics";
import { AnswerPanel, type EditorState } from "./answer-panel";

type View = "overview" | "catalog";
const sourceLabels = { regular: "万年老题（常驻）", retained: "保留题", new: "本季新题" };

export function Workspace() {
  const [view, setView] = useState<View>("overview");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("all");
  const [bank, setBank] = useState("all");
  const [collection, setCollection] = useState("all");
  const [unanswered, setUnanswered] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ dirty: false, saving: false });
  const groups = useMemo(() => groupTopics(catalog?.questions ?? []), [catalog]);
  const selectedGroup = groups.find(group => group.id === selectedGroupId);
  const collections = [...new Set(groups.map(group => group.collection))];
  const started = groups.filter(group => group.covered > 0).length;
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
    if (!editor.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editor.dirty]);

  function mayLeave() {
    return !editor.saving && (!editor.dirty || window.confirm("当前内容还没有保存，确定放弃修改吗？"));
  }
  function navigate(next: View) {
    if (next === view || !mayLeave()) return;
    setSelectedId(null); setView(next);
  }
  function showCatalog(nextFamily = "all", onlyUnanswered = false) {
    if (!mayLeave()) return;
    setSearch(""); setFamily(nextFamily); setBank("all"); setCollection("all"); setUnanswered(onlyUnanswered);
    setSelectedGroupId(null); setSelectedId(null); setView("catalog");
  }
  function selectGroup(group: TopicGroup) {
    if (group.id === selectedGroupId || !mayLeave()) return;
    setSelectedGroupId(group.id);
    setSelectedId((group.questions.find(q => q.part === 2) ?? group.questions[0]).id);
    setView("catalog");
    if (window.matchMedia("(max-width: 720px)").matches) window.scrollTo({ top: 0 });
  }
  function selectQuestion(id: string) {
    if (!mayLeave()) return;
    setSelectedId(previous => previous === id ? null : id);
  }
  function openQuestion(id: string) {
    const group = groups.find(item => item.questions.some(q => q.id === id));
    if (!group || !mayLeave()) return;
    setSearch(""); setFamily("all"); setBank("all"); setCollection("all"); setUnanswered(false);
    setSelectedGroupId(group.id); setSelectedId(id); setView("catalog");
    window.scrollTo({ top: 0 });
    setTimeout(() => document.getElementById(`question-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("已复制到剪贴板"); }
    catch { setError("复制失败，请长按或选中文字手动复制"); }
  }
  async function logout() {
    if (!mayLeave()) return;
    try { await api("logout", "POST"); window.location.assign("/ielts"); }
    catch (error) { setError(error instanceof Error ? error.message : "退出失败"); }
  }
  const filtered = useMemo(() => groups.filter(group =>
    (family === "all" || group.family === family) &&
    (bank === "all" || (bank === "new" ? group.bank === "new" : group.bank !== "new")) &&
    (collection === "all" || group.collection === collection) &&
    (!unanswered || group.covered === 0) && matchesTopic(group, search)),
  [groups, family, bank, collection, unanswered, search]);

  function panel(question: Question) {
    return selectedId === question.id ? <AnswerPanel key={question.id} question={question} onState={setEditor}
      onRefresh={loadCatalog} onNotice={setNotice} onCopy={copy} /> : null;
  }
  function smallQuestion(question: Question, index: number) {
    const active = selectedId === question.id;
    return <article className={`subquestion ${active ? "expanded" : ""}`} id={`question-${question.id}`} key={question.id} data-question-id={question.id}>
      <button className="subquestion-toggle" aria-expanded={active} onClick={() => selectQuestion(question.id)}>
        <span className="question-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="subquestion-text" lang="en">{question.prompt}</span>
        <span className={`question-answer-count ${question.answer_count ? "has-answer" : ""}`}>{question.answer_count ? `${question.answer_count} 份答案` : "暂无答案"}</span>
        <ChevronDown size={16} />
      </button>
      {panel(question)}
    </article>;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/ielts" onClick={event => { event.preventDefault(); navigate("overview"); }}>
        <span className="brand-icon"><AudioLines size={24} /></span><span>Speaking Room<small>雅思口语 · 个人答案库</small></span>
      </a>
      <p className="nav-label">YOUR WORKSPACE</p>
      <nav aria-label="主导航">
        <button className={`nav-item ${view === "overview" ? "active" : ""}`} onClick={() => navigate("overview")}><LayoutDashboard size={18} />学习概览{view === "overview" && <span className="nav-dot" />}</button>
        <button className={`nav-item ${view === "catalog" ? "active" : ""}`} onClick={() => navigate("catalog")}><BookOpen size={18} />题目 Catalog<span className="nav-count">{groups.length}</span></button>
      </nav>
      <div className="sidebar-note"><span className="small-icon"><MessageSquare size={19} /></span><p>不必一次说得完美。</p><span>把每一次值得留下的表达，<br />慢慢收集起来。</span><div className="little-wave"><i /><i /><i /><i /><i /><i /><i /></div></div>
      <div className="account"><span className="avatar">A</span><span>admin<small>你的私人空间</small></span><button className="icon-button" aria-label="退出登录" onClick={logout} disabled={editor.saving}><LogOut size={17} /></button></div>
    </aside>
    <main className={`main ${view === "catalog" ? "catalog-main" : ""} ${view === "catalog" && selectedGroup ? "has-question" : ""}`}>
      <header className="topbar"><span>我的学习空间 <ChevronRight size={13} /><strong>{view === "overview" ? "学习概览" : "题目 Catalog"}</strong></span><span className="private-mark"><span />PRIVATE SPACE</span></header>
      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => loadCatalog().catch(error => setError(error.message))}>重新加载</button><button className="icon-button" aria-label="关闭提示" onClick={() => setError("")}><X size={15} /></button></div>}
      {!catalog ? <div className="loading-state"><AudioLines size={28} /><p>{error ? "暂时无法加载题库" : "正在打开你的口语空间…"}</p></div> : view === "overview" ? <>
        <section className="page-heading"><div><p className="eyebrow">SMALL STEPS. BETTER ANSWERS.</p><h1>每一次练习，都算数<span className="accent">。</span></h1><p className="muted">按话题慢慢练，把好答案留在这里。</p></div><button className="button primary" onClick={() => showCatalog()}>打开题库<ArrowUpRight size={17} /></button></section>
        {catalog.questions.some(q => q.is_demo) && <div className="demo-banner"><Sparkles size={16} /><span>当前包含原创示例题，仅供体验界面，不代表真实考季题库。</span></div>}
        <section className="stats-grid" aria-label="学习统计">
          <div className="stat-card"><span className="stat-icon sage"><BookOpen size={19} /></span><span className="stat-label">题库中的话题</span><strong>{groups.length}<small>个</small></strong><span className="stat-caption">小问题收在话题里，不再逐条平铺</span></div>
          <div className="stat-card"><span className="stat-icon peach"><Check size={19} /></span><span className="stat-label">已开始积累的话题</span><strong>{started}<small>个</small></strong><span className="stat-caption">至少一个问题已保存答案</span></div>
          <div className="stat-card"><span className="stat-icon lilac"><FileText size={19} /></span><span className="stat-label">保存的答案</span><strong>{catalog.totalAnswers}<small>份</small></strong><span className="stat-caption">同一道题，也可以有不同思路</span></div>
          <button className="stat-card stat-link" onClick={() => showCatalog("all", true)}><span className="stat-icon sand"><MessageSquare size={19} /></span><span className="stat-label">尚无答案的话题</span><strong>{groups.length - started}<small>个</small></strong><span className="stat-caption">去挑一个话题聊聊<ArrowRight size={14} /></span></button>
        </section>
        <section className="overview-grid">
          <div className="card recent-card"><div className="section-title"><div><span className="eyebrow">YOUR ANSWER COLLECTION</span><h2>最近留下的答案</h2></div><FileText size={20} className="muted" /></div>
            {catalog.recent.length ? <div className="recent-list">{catalog.recent.map(a => <button key={a.id} onClick={() => openQuestion(a.question_id)}><span className="recent-icon"><MessageSquare size={18} /></span><span><strong>{a.title || a.question_title}</strong><small>Part {a.part} · {a.question_title} · {formattedDate(a.updated_at)}</small></span><ArrowUpRight size={17} /></button>)}</div> :
              <div className="empty-answers"><span className="empty-illustration"><MessageSquare size={28} /><span>＋</span></span><h3>第一份好答案，从这里开始</h3><p>和 ChatGPT 练完后，把推荐答案和反馈粘贴回来。<br />不用整理得很完美，先保存就好。</p><button className="button secondary" onClick={() => showCatalog()}>挑一个话题<ArrowRight size={16} /></button></div>}
          </div>
          <div className="card part-card"><div className="section-title"><div><span className="eyebrow">ONE TOPIC AT A TIME</span><h2>从哪个部分开始？</h2></div></div>
            {(["p1", "p23"] as const).map((value, index) => {
              const items = groups.filter(group => group.family === value);
              const count = items.filter(group => group.covered > 0).length;
              return <button className="part-row" key={value} onClick={() => showCatalog(value)}><span className={`part-number part-number-${index + 1}`}>0{index + 1}</span><span><strong>{value === "p1" ? "Part 1 · 日常话题" : "Part 2 + 3 · 主题与延伸"}</strong><small>{count} / {items.length} 个话题已有答案</small><span className="progress"><i style={{ width: `${items.length ? count / items.length * 100 : 0}%` }} /></span></span><ChevronRight size={17} /></button>;
            })}
            <p className="part-note">Part 3 跟着对应的 Part 2 一起看。<br />话题内仍可逐题存答案；有答案不等于已掌握。</p>
          </div>
        </section>
        <section className="workflow-note"><span className="small-icon"><AudioLines size={21} /></span><div><h3>简单一点，才容易坚持。</h3><p>挑一个话题 → 复制问题去练习 → 回来保存答案与 Feedback</p></div><ArrowUpRight size={22} /></section>
      </> : <>
        <section className="page-heading catalog-heading"><div><p className="eyebrow">YOUR SPEAKING CATALOG</p><h1>一个话题，慢慢展开<span className="accent">。</span></h1><p className="muted">Part 1 按话题收纳小问题，Part 2 与 Part 3 连在一起。</p></div><span className="catalog-total">{groups.length} TOPICS</span></section>
        <div className="filters">
          <label className="search-field"><Search size={17} /><input aria-label="搜索题目" placeholder="搜索话题，或话题里的任意问题…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="icon-button" aria-label="清除搜索" onClick={() => setSearch("")}><X size={15} /></button>}</label>
          <div className="filter-row">
            <div className="segmented" aria-label="Part 筛选">{[["all", "全部"], ["p1", "Part 1"], ["p23", "Part 2 + 3"]].map(([value, label]) => <button key={value} aria-pressed={family === value} className={family === value ? "selected" : ""} onClick={() => setFamily(value)}>{label}</button>)}</div>
            <label className="sr-only" htmlFor="bank-filter">题库类型</label><select id="bank-filter" value={bank} onChange={e => setBank(e.target.value)}><option value="all">全部类型</option><option value="new">新题</option><option value="existing">已有题</option></select>
            {collections.length > 1 && <><label className="sr-only" htmlFor="collection-filter">题库资料</label><select id="collection-filter" value={collection} onChange={e => setCollection(e.target.value)}><option value="all">全部题库</option>{collections.map(c => <option key={c}>{c}</option>)}</select></>}
            <label className="checkbox-label"><input type="checkbox" checked={unanswered} onChange={e => setUnanswered(e.target.checked)} />只看尚无答案的话题</label>
          </div>
        </div>
        <section className={`catalog-layout ${selectedGroup ? "has-selection" : ""}`}>
          <div className="question-list"><div className="list-heading"><span>话题列表</span><span>{filtered.length} 个话题</span></div>
            {!filtered.length && <div className="list-empty"><Search size={24} /><p>{groups.length ? "没有找到匹配的话题" : "题库还没有话题"}</p><small>{groups.length ? "试试话题名称或问题中的关键词" : "提供题库资料后，由后台整理录入"}</small></div>}
            {filtered.map(group => <button key={group.id} className={`question-item topic-item ${selectedGroupId === group.id ? "selected" : ""}`} onClick={() => selectGroup(group)}><span className="question-tags"><span className={`part part-${group.family === "p1" ? 1 : 2}`}>{group.family === "p1" ? "PART 1" : "PART 2 + 3"}</span><span className={group.bank === "new" ? "new-tag" : "regular-tag"}>{group.bank === "new" ? "新题" : "已有题"}</span>{group.questions.some(q => q.is_demo) && <span className="demo-tag">示例</span>}</span><strong>{group.title}</strong><span className="question-preview">{group.family === "p1" ? `${group.questions.length} 个小问题` : `${group.questions.filter(q => q.part === 2).length} 张题卡 · ${group.questions.filter(q => q.part === 3).length} 个延伸问题`}</span><span className="question-bottom"><span>按话题积累</span><span className={group.covered ? "has-answer" : ""}>{group.covered ? <><Check size={12} />已存 {group.covered} / {group.questions.length} 题</> : "尚无答案"}</span></span></button>)}
          </div>
          <div className="question-detail">
            {!selectedGroup ? <div className="select-empty"><span className="empty-illustration"><BookOpen size={30} /></span><h2>挑一个话题，开始聊聊看</h2><p>小问题收在各自的话题里。<br />Part 2 题卡和 Part 3 延伸讨论一起展开。</p><span className="tiny-label">ONE TOPIC. A LITTLE MORE CONFIDENCE.</span></div> : <>
              <button className="mobile-back" onClick={() => { if (mayLeave()) { setSelectedId(null); setSelectedGroupId(null); } }}><ArrowLeft size={16} />返回话题列表</button>
              <div className="detail-heading"><div><div className="question-tags"><span className={`part part-${selectedGroup.family === "p1" ? 1 : 2}`}>{selectedGroup.family === "p1" ? "PART 1" : "PART 2 + 3"}</span><span className="topic-label">已存答案 {selectedGroup.covered} / {selectedGroup.questions.length} 题</span></div><h2>{selectedGroup.title}</h2><p className="collection-label">{selectedGroup.collection} · 原资料：{sourceLabels[selectedGroup.bank]}</p></div><button className="button secondary compact" onClick={() => copy(selectedGroup.questions.map(q => `Part ${q.part}${questionVariant(q) ? ` · ${questionVariant(q)}` : ""}\n${q.prompt}`).join("\n\n"))}><Copy size={15} />复制整组</button></div>
              {selectedGroup.questions.some(q => q.is_demo) && <p className="demo-inline">示例题 · 仅供体验，不代表真实考季题库</p>}
              {selectedGroup.family === "p1" ? [...new Set(selectedGroup.questions.map(questionVariant))].map(variant => <section className="topic-section" key={variant}><div className="topic-section-heading"><h3>{variant || "话题里的小问题"}</h3><span>{selectedGroup.questions.filter(q => questionVariant(q) === variant).length} 个问题</span></div>{selectedGroup.questions.filter(q => questionVariant(q) === variant).map(smallQuestion)}</section>) : <>
                {selectedGroup.questions.filter(q => q.part === 2).map(q => <section className="cue-card" key={q.id} id={`question-${q.id}`} data-question-id={q.id}><div className="topic-section-heading"><h3>Part 2 · 个人陈述</h3><span>完整题卡</span></div><div className="prompt-box" lang="en">{q.prompt}</div><button className="cue-answer-toggle" aria-expanded={selectedId === q.id} onClick={() => selectQuestion(q.id)}><MessageSquare size={16} />这张题卡的答案<span>{q.answer_count} 份</span><ChevronDown size={16} /></button>{panel(q)}</section>)}
                <section className="topic-section part3-section"><div className="topic-section-heading"><h3>Part 3 · 延伸讨论</h3><span>{selectedGroup.questions.filter(q => q.part === 3).length} 个问题</span></div><p className="section-explainer">{selectedGroup.questions.some(q => q.part === 2) ? "围绕上方 Part 2 的话题，进一步展开讨论。" : "资料中单独收录的讨论问题。"}</p>{selectedGroup.questions.filter(q => q.part === 3).map(smallQuestion)}</section>
              </>}
              <p className="detail-footnote">答案仍分别保存在每一道题下，原有内容不会因话题分组而改变。</p>
            </>}
          </div>
        </section>
      </>}
      <footer className="workspace-footer"><span>SPEAKING ROOM</span><span>A little practice, a clearer voice.</span></footer>
    </main>
    {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
  </div>;
}
