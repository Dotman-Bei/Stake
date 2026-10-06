import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Chrome } from "@/components/Chrome";
import { Footer } from "@/components/Footer";

// Self-hosted at build time: no render-blocking request to Google, no layout shift.
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "STAKE", template: "%s · STAKE" },
  description: "STAKE is a fast, low-cost prediction market built for the BOT Chain ecosystem. Stake BOT on short YES/NO markets, settled on-chain.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#0a0907", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${serif.variable}`}>
      <body>
        <Providers>
          <Chrome footer={<Footer />}>{children}</Chrome>
        </Providers>
      </body>
    </html>
  );
}
