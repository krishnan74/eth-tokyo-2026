"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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
          {[["The gap", "#gap"], ["The idea", "#idea"], ["Live demo", "#demo"], ["How it fits", "#fit"], ["Roadmap", "#roadmap"], ["The ask", "#ask"]].map(([t, h]) => (
            <a key={h} href={h} className="relative transition-colors hover:text-ink after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-cascade after:transition-[width] after:duration-500 hover:after:w-full">{t}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2" ref={ref}>
          <span className={`hidden items-center gap-2 rounded-full px-2.5 py-1 text-xs sm:inline-flex ${IS_FORK ? "bg-warn-soft text-warn" : "bg-surface text-ink-2 ring-1 ring-line"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${IS_FORK ? "bg-warn" : "bg-ok pulse"}`} />
            {IS_FORK ? "Anvil fork of Sepolia" : "Live · Sepolia"}
          </span>
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
