"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="auth-page"><section className="auth-card">
    <p className="eyebrow">SPEAKING ROOM</p><h1>暂时没能打开</h1>
    <p className="muted">服务连接异常，请稍后重试。已保存的内容不会因此丢失。</p>
    <button className="button primary" onClick={reset}>重新加载</button>
  </section></main>;
}
