import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { LiquidGlassFilter } from "@/components/spotlit/LiquidGlassFilter";
import { env } from "@/lib/env";
import "./globals.css";

const instrument = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});
const inter = localFont({
  src: [{ path: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: { default: "Spotlit: get spotlit by agents", template: "%s · Spotlit" },
  description:
    "AI assistants are starting to choose where people eat, drink and go out. Spotlit shows independent venues how often agents choose them, why they pick a rival, and fixes it with Qloo taste data.",
  openGraph: {
    title: "Spotlit: get spotlit by agents",
    description: "Agent visibility for independent venues. Built on Qloo Taste AI, A2A and MCP.",
    images: ["/brand/halftone-spotlight-hero-1920x1080.webp"],
  },
};

export const viewport: Viewport = { themeColor: "#0B0B0C" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        <LiquidGlassFilter />
        {children}
      </body>
    </html>
  );
}
