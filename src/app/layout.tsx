import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "투자 시뮬레이터",
  description: "세후 실수령까지 계산하는 개인 투자 시뮬레이터",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <footer className="border-t p-4 text-center text-xs text-zinc-500">
          이 사이트의 모든 계산은 참고용 시뮬레이션이며 투자 권유가 아닙니다. 실제
          투자·세무 결정은 전문가와 상의하세요.
        </footer>
      </body>
    </html>
  );
}
