import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Speaking Room · 雅思口语答案库",
  description: "一个安静的地方，收好每一次口语练习。",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC;
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  return <html lang="zh-CN"><body>{children}
    {src && websiteId && <Script src={src} data-website-id={websiteId} data-auto-track="false" strategy="afterInteractive" />}
  </body></html>;
}
