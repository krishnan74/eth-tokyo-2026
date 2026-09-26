import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";

import { SmoothScroll } from "@/components/pitch/SmoothScroll";

import "./globals.css";
import { Providers } from "./providers";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" });

export const metadata: Metadata = {
  title: "ENS Drive",
  description: "Google Drive–style sharing for ENS names, powered by Cascade — a relationship-based permission layer for ENSv2. Live on Sepolia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <head>
        {/* Light is the default; a saved choice is applied before paint so there's no flash. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("cascade.theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="grain min-h-screen">
        <SmoothScroll />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
