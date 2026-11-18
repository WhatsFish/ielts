"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AudioLines, Check, KeyRound } from "lucide-react";
import { passwordHelp, passwordPattern, validPassword } from "@/lib/domain";
import { api } from "@/lib/client";

export default function PasswordPage() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
    window.history.replaceState(null, "", window.location.pathname);
    setReady(true);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (!validPassword(password)) { setError(passwordHelp); return; }
    if (password !== form.get("confirm")) { setError("两次输入的密码不一致"); return; }
    setBusy(true); setError("");
    try {
      await api("password", "POST", { token, password });
      setDone(true); setToken("");
    } catch (error) { setError(error instanceof Error ? error.message : "保存失败，请重试"); }
    finally { setBusy(false); }
  }
  return <main className="auth-page setup-page"><section className="auth-card">
    <a href="/ielts" className="brand"><span className="brand-icon"><AudioLines size={23} /></span><span>Speaking Room</span></a>
    <span className="small-icon">{done ? <Check /> : <KeyRound />}</span>
    <p className="eyebrow">YOUR SPACE, YOUR PASSWORD</p><h1>{done ? "密码设置好了" : "设置你的登录密码"}</h1>
    {done ? <><p className="muted" role="status">以后使用 admin 和这个密码登录。此链接已失效。</p><a className="button primary full" href="/ielts">前往登录</a></> : <>
      <p className="muted">账户固定为 <strong>admin</strong>。密码由你自己保管，不需要发到聊天中。</p>
      <p className="auth-footnote">{passwordHelp}。链接 24 小时内有效，使用后立即失效。</p>
      {ready && !token && <p className="error-message" role="alert">请重新打开完整的专属设置链接。为保护凭证，刷新此页后需要重新打开原链接。</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {token && <form onSubmit={submit}><fieldset disabled={busy}>
        <label>账户<input value="admin" readOnly autoComplete="username" /></label>
        <label>新密码<input name="password" type="password" autoComplete="new-password" pattern={passwordPattern} title={passwordHelp} minLength={9} maxLength={256} required /></label>
        <label>确认新密码<input name="confirm" type="password" autoComplete="new-password" pattern={passwordPattern} title={passwordHelp} minLength={9} maxLength={256} required /></label>
        <button className="button primary full">{busy ? "正在保存…" : "保存密码"}</button>
      </fieldset></form>}
    </>}
  </section></main>;
}
