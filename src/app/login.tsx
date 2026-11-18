"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, AudioLines, LockKeyhole } from "lucide-react";
import { api } from "@/lib/client";

export function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await api("login", "POST", { username: "admin", password: form.get("password") });
      window.location.assign("/ielts");
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录失败，请重试");
      setBusy(false);
    }
  }
  return <main className="auth-page">
    <section className="auth-story">
      <a href="/ielts" className="brand"><span className="brand-icon"><AudioLines size={23} /></span><span>Speaking Room<small>YOUR PERSONAL SPEAKING SPACE</small></span></a>
      <div><p className="eyebrow">A LITTLE PRACTICE, EVERY DAY.</p><h1>让每一次开口，<br />都有迹可循。</h1>
        <p>找一道题，认真说一说。<br />把值得留下的答案，放在这里。</p></div>
      <span className="story-footer">IELTS SPEAKING / 私人口语答案库</span>
    </section>
    <section className="auth-card">
      <span className="small-icon"><LockKeyhole size={21} /></span>
      <p className="eyebrow">WELCOME BACK</p><h2>回到你的口语空间</h2>
      <p className="muted">用你设置的密码登录，继续积累好答案。</p>
      <form onSubmit={submit}><fieldset disabled={busy}>
        <label>账户<input name="username" value="admin" readOnly autoComplete="username" /></label>
        <label>密码<input name="password" type="password" autoComplete="current-password" required maxLength={256} placeholder="输入你的登录密码" /></label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="button primary full" type="submit">{busy ? "正在登录…" : "进入 Speaking Room"}<ArrowUpRight size={17} /></button>
      </fieldset></form>
      <p className="auth-footnote">第一次使用？请通过专属的一次性链接设置密码。<br />这里没有公开注册入口。</p>
    </section>
  </main>;
}
