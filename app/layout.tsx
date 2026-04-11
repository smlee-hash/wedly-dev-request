import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WEDLY 개발 요청",
  description: "오류/개선 요청 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F8F9FA]">{children}</body>
    </html>
  );
}
