"use client";

import { useId, useState, type ReactNode } from "react";

import { etherscanAddress } from "@/lib/cascade/contracts";

export function Card({ title, eyebrow, children, className = "", action }: { title?: ReactNode; eyebrow?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-lg border border-rule bg-surface p-5 ${className}`}>
      {(title || eyebrow) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {eyebrow && <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{eyebrow}</span>}
            {title && <h2 className="text-lg font-semibold leading-snug">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** The terminal's [NATIVE EAC] / [CASCADE] labels. */
export function KindTag({ kind }: { kind: "native" | "cascade" }) {
  return kind === "native"
    ? <span className="rounded bg-native-soft px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-wide text-native">NATIVE EAC</span>
    : <span className="rounded bg-cascade-soft px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-wide text-cascade">CASCADE</span>;
}

export function Address({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const short = `${value.slice(0, 6)}…${value.slice(-4)}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.getSelection()?.selectAllChildren(document.getElementById(`addr-${value}`)!);
    }
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      {label && <span className="font-sans text-muted">{label}</span>}
      <a id={`addr-${value}`} href={etherscanAddress(value)} target="_blank" rel="noreferrer" className="text-ink underline decoration-rule underline-offset-2 hover:decoration-cascade" title={value}>{short}</a>
      <button type="button" onClick={copy} className="rounded px-1 text-muted hover:text-cascade" aria-label={`Copy ${value}`}>{copied ? "copied" : "copy"}</button>
    </span>
  );
}

/** An always-available one-line explanation of a term, on hover or keyboard focus. */
export function InfoTip({ text, label = "What is this?" }: { text: string; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label={label} aria-describedby={id}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-rule text-[10px] font-semibold text-muted hover:border-cascade hover:text-cascade">i</button>
      <span id={id} role="tooltip"
        className={`absolute bottom-6 left-1/2 z-20 w-64 -translate-x-1/2 rounded-md border border-rule bg-surface p-2.5 text-left text-xs leading-relaxed text-ink shadow-lg ${open ? "" : "hidden"}`}>
        {text}
      </span>
    </span>
  );
}

export const Check = ({ v }: { v: boolean | undefined | "checking" | "pending" }) => {
  if (v === "checking") return <span className="font-mono text-xs text-warn">checking…</span>;
  if (v === "pending") return <span className="font-mono text-xs text-muted">·</span>;
  if (v === undefined) return <span className="font-mono text-xs text-muted">skipped</span>;
  return v ? <span className="font-mono text-sm font-semibold text-ok">✓ yes</span> : <span className="font-mono text-sm font-semibold text-bad">✗ no</span>;
};
