import type { Metadata, Viewport } from "next";
import { Providers } from "@/core/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOBI.AI",
  description: "MOBI.AI",
};

// 확대를 막지 않는다 (접근성). viewportFit: cover 는 하단 고정 버튼이 safe-area 를 쓰기 위해 필요하다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-dvh flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
