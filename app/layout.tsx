import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DemoTools } from "@/components/DemoTools";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Dividendi | Recover your unclaimed dividends",
  description: "We search every Nigerian registrar for dividends owed to you, file the claim, and chase it until you're paid. 10% of what arrives, nothing if nothing does.",
  icons: { icon: "/logo-mark.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#122135" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          {children}
          <DemoTools />
        </Providers>
      </body>
    </html>
  );
}
