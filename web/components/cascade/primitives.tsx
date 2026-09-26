"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { etherscanAddress } from "@/lib/cascade/contracts";

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Native EAC vs Cascade — the terminal's two labels, as a quiet dot + word. */
export function Kind({ kind }: { kind: "native" | "cascade" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] ${kind === "cascade" ? "text-cascade" : "text-muted"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${kind === "cascade" ? "bg-cascade" : "bg-faint"}`} />
      {kind === "cascade" ? "Cascade" : "Native EAC"}
    </span>
  );
}

export function CopyAddress({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      if (ref.current) window.getSelection()?.selectAllChildren(ref.current);
    }
  }
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="flex items-center gap-2">
        <a ref={ref} href={etherscanAddress(value)} target="_blank" rel="noreferrer" title={value}
          className="font-mono text-xs text-ink underline decoration-line underline-offset-4 hover:decoration-cascade">{shortAddr(value)}</a>
        <button type="button" onClick={copy} className="w-12 text-right font-mono text-[11px] text-muted hover:text-ink">{copied ? "copied" : "copy"}</button>
      </span>
    </div>
  );
}

/** A small (i) that explains a term on hover, focus or tap. */
export function Tip({ children, label = "Explain" }: { children: ReactNode; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button type="button" aria-label={label} aria-describedby={id}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-muted ring-1 ring-line hover:text-cascade hover:ring-cascade">?</button>
      <AnimatePresence>
        {open && (
          <motion.span id={id} role="tooltip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
            className="absolute bottom-6 left-1/2 z-30 w-64 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-bg shadow-xl">
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Briefly highlights its content when `value` changes — the terminal's "← just changed". */
export function Flash({ value, children, className = "" }: { value: string; children: ReactNode; className?: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1800);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <span className={`relative rounded-md transition-shadow duration-700 ${flash ? "shadow-[0_0_0_3px_var(--warn-soft)]" : ""} ${className}`}>
      {children}
      <AnimatePresence>
        {flash && (
          <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            className="absolute -right-2 top-1/2 translate-x-full -translate-y-1/2 whitespace-nowrap font-mono text-[10px] text-warn">changed</motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
