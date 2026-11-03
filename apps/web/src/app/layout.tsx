import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "Studio HQ", template: "%s · Studio HQ" },
  description: "A full content company staffed by AI agents. You record, the team does the rest.",
};

export const viewport: Viewport = { themeColor: "#0e1430", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getT();
  return (
    <html lang={locale} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Press+Start+2P&display=swap"
        />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
