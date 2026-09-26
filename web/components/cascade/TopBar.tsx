"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark"); }, []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("cascade.theme", next); } catch { /* per-visit only */ }
    setDark(!dark);
  };
  return (
    <button type="button" onClick={flip} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}
      className="grid h-8 w-8 place-items-center rounded-full text-ink-2 ring-1 ring-line hover:bg-surface hover:text-ink">
      {dark
        ? <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><circle cx="10" cy="10" r="3.5" fill="currentColor" /><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" /></g></svg>
        : <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1Z" fill="currentColor" /></svg>}
    </button>
  );
}

import { SEPOLIA } from "@/lib/cascade/contracts";
import { IS_FORK } from "@/lib/cascade/wagmi";

import { CopyAddress } from "./primitives";

export function TopBar({ outsider, operator, writesEnabled }: { outsider?: string | null; operator?: string | null; writesEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-ink text-bg">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden><path d="M3 4h10M5.5 8h7.5M8 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </span>
          <span className="font-semibold tracking-tight">Cascade</span>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-ink-2 md:flex" aria-label="Sections">
          {[["The problem", "#problem"], ["Try it", "#try"], ["Behind the scenes", "#trace"], ["Under the hood", "#under-the-hood"]].map(([t, h]) => (
            <a key={h} href={h} className="relative transition-colors hover:text-ink after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-cascade after:transition-[width] after:duration-500 hover:after:w-full">{t}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2" ref={ref}>
          <span className={`hidden items-center gap-2 rounded-full px-2.5 py-1 text-xs sm:inline-flex ${IS_FORK ? "bg-warn-soft text-warn" : "bg-surface text-ink-2 ring-1 ring-line"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${IS_FORK ? "bg-warn" : "bg-ok pulse"}`} />
            {IS_FORK ? "Anvil fork of Sepolia" : "Live · Sepolia"}
          </span>
          <ThemeToggle />
          <div className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className="rounded-full px-3 py-1 text-xs font-medium text-ink-2 ring-1 ring-line hover:bg-surface hover:text-ink">
              Contracts
            </button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}
                  className="absolute right-0 top-9 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-4 shadow-xl">
                  <p className="mb-2 text-xs leading-relaxed text-muted">
                    {IS_FORK ? "A local fork of Sepolia. Transactions are real on the fork only." : "Live contracts on Sepolia (ENSv2 beta). Every action is a real transaction."}
                  </p>
                  <div className="divide-y divide-line">
                    <CopyAddress label="Org registry" value={SEPOLIA.parent} />
                    <CopyAddress label="CascadeSubregistry" value={SEPOLIA.cascade} />
                    <CopyAddress label="TeamRegistry" value={SEPOLIA.team} />
                    {outsider && <CopyAddress label="Outsider" value={outsider} />}
                    {operator && <CopyAddress label="Operator" value={operator} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {writesEnabled === false && (
        <div className="border-t border-line bg-warn-soft">
          <p className="mx-auto max-w-7xl px-4 py-2 text-xs text-warn sm:px-6">
            Read-only here: transactions are turned off on this server. Everything below is still read live. Run <code className="font-mono">npm run ui</code> locally to drive it.
          </p>
        </div>
      )}
    </header>
  );
}
