"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useRef, useState, type ReactNode, type RefObject } from "react";

import { TEAM_NAME } from "@/lib/cascade/contracts";
import type { ActionName, TxEntry } from "@/lib/cascade/hooks";

import { shortAddr } from "../cascade/primitives";
import { ACTIONS } from "../cascade/steps";
import { EASE } from "./Reveal";

type Zone = "pool" | "roster" | "socket";
type Props = {
  outsider?: string | null;
  attacker: string;
  member?: boolean;
  grant?: boolean;
  subnames: string[];
  access: Record<string, boolean | undefined>;
  target: string | null;
  pending: string | null;
  writesEnabled: boolean;
  /** In guided mode, the one action the current step allows; null = free play. */
  allowed: ActionName | null;
  lastHijack?: TxEntry;
  onAct: (a: ActionName, label?: string) => void;
  onBlocked: (a: ActionName) => void;
};

// ── bits ─────────────────────────────────────────────────────────────────────

/** A deterministic two-tone disc from an address — identity without an image. */
function Glyph({ seed, attacker }: { seed: string; attacker?: boolean }) {
  const n = parseInt(seed.slice(2, 8) || "0", 16);
  const a = n % 360, b = (a + 70) % 360;
  return (
    <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-black/5"
      style={{ background: attacker ? "repeating-linear-gradient(45deg, var(--bad) 0 4px, var(--bad-soft) 4px 8px)" : `conic-gradient(from ${a}deg, hsl(${a} 55% 55%), hsl(${b} 55% 42%), hsl(${a} 55% 55%))` }} />
  );
}

function Lock({ open }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 ${open ? "text-ok" : "text-ink-2"}`} aria-hidden>
      <rect x="4" y="9" width="12" height="8" rx="2" fill="currentColor" opacity="0.18" stroke="currentColor" strokeWidth="1.4" />
      <motion.path d="M7 9V6.5a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
        initial={false} animate={{ rotate: open ? -28 : 0, x: open ? -1.5 : 0, y: open ? -1 : 0 }} style={{ originX: "13px", originY: "9px" }}
        transition={{ duration: 0.5, ease: EASE }} />
    </svg>
  );
}

function Spinner() {
  return <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" aria-hidden />;
}

/** A draggable chip. Drops are resolved by hit-testing the zones; Enter does the default move for keyboard users. */
function Chip({ id, label, sub, seed, attacker, disabled, beckon, zones, onDropZone, onKey, setOver }: {
  id: string; label: string; sub: string; seed: string; attacker?: boolean; disabled: boolean; beckon: boolean;
  zones: Record<Zone, RefObject<HTMLDivElement | null>>; onDropZone: (z: Zone | null) => void; onKey: () => void; setOver: (z: Zone | null) => void;
}) {
  const hit = (info: PanInfo): Zone | null => {
    const x = info.point.x - window.scrollX, y = info.point.y - window.scrollY;
    // The socket sits inside the roster, so test the smaller zone first.
    for (const z of ["socket", "roster", "pool"] as Zone[]) {
      const r = zones[z].current?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z;
    }
    return null;
  };
  return (
    <motion.div layoutId={id} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
      aria-label={`${label}. Drag it, or press Enter to ${attacker ? "drop it on the team socket" : "move it"}.`}
      drag={!disabled} dragSnapToOrigin dragMomentum={false} dragElastic={0.18}
      whileDrag={{ scale: 1.07, rotate: attacker ? 3 : -2, zIndex: 60, boxShadow: "0 18px 40px -12px rgba(0,0,0,0.35)" }}
      whileHover={disabled ? undefined : { y: -2 }}
      onDrag={(_, i) => setOver(hit(i))}
      onDragEnd={(_, i) => { const z = hit(i); setOver(null); onDropZone(z); }}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onKey(); } }}
      transition={{ layout: { duration: 0.7, ease: EASE } }}
      className={`relative z-10 flex w-fit touch-none select-none items-center gap-2.5 rounded-full bg-surface py-1.5 pl-1.5 pr-4 ring-1 ${attacker ? "ring-bad/40" : "ring-line"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"} ${beckon ? "beckon" : ""}`}>
      <Glyph seed={seed} attacker={attacker} />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-[11px] text-muted">{sub}</span>
      </span>
    </motion.div>
  );
}

function Ghost({ label }: { label: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
      className="flex w-fit items-center gap-2 rounded-full border border-dashed border-cascade px-3 py-2 text-xs text-cascade">
      <Spinner /> {label}
    </motion.div>
  );
}

function ZoneBox({ zoneRef, over, title, hint, children, className = "", accent }: {
  zoneRef: RefObject<HTMLDivElement | null>; over: boolean; title: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; accent?: boolean;
}) {
  return (
    <div ref={zoneRef} className={`relative flex flex-col gap-4 rounded-2xl p-5 transition-[background-color,box-shadow] duration-300 ${
      over ? "bg-cascade-soft shadow-[inset_0_0_0_2px_var(--cascade)]" : accent ? "bg-surface shadow-[inset_0_0_0_1px_var(--line)]" : "bg-paper shadow-[inset_0_0_0_1px_var(--line)]"} ${className}`}>
      <div className="flex flex-col gap-1">
        {title}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── board ────────────────────────────────────────────────────────────────────

export function DemoBoard(p: Props) {
  const pool = useRef<HTMLDivElement>(null), roster = useRef<HTMLDivElement>(null), socket = useRef<HTMLDivElement>(null);
  const zones = { pool, roster, socket };
  const [over, setOver] = useState<Zone | null>(null);
  const busy = !!p.pending || !p.writesEnabled;
  const can = (a: ActionName) => !busy && (p.allowed === null || p.allowed === a);
  const want = (a: ActionName) => { if (can(a)) p.onAct(a); else if (!busy) p.onBlocked(a); };

  const who = p.outsider ?? "0x0000000000";
  const inTeam = p.member === true;

  const outsiderChip = (
    <Chip id="outsider" label="Outsider" sub={p.outsider ? shortAddr(p.outsider) : "…"} seed={who}
      disabled={busy || p.member === undefined} beckon={p.allowed === (inTeam ? "revoke" : "grant") && !busy}
      zones={zones} setOver={setOver}
      onDropZone={(z) => { if (!inTeam && z === "roster") want("grant"); if (inTeam && z === "pool") want("revoke"); }}
      onKey={() => want(inTeam ? "revoke" : "grant")} />
  );

  const hijack = p.lastHijack;
  const refused = hijack && (hijack.status === "reverted" || hijack.status === "error");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_4.5rem_minmax(0,1.35fr)] lg:gap-0">
      {/* ── left: outside the team ─────────────────────────────── */}
      <div className="flex flex-col gap-5 lg:pr-5">
        <ZoneBox zoneRef={pool} over={over === "pool" && inTeam}
          title={<span className="label">Outside the team</span>}
          hint="EAC knows this address, and nothing else about it.">
          <div className="flex min-h-12 flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {!inTeam && outsiderChip}
              {p.pending === "revoke" && <Ghost key="g-revoke" label="leaving the team…" />}
            </AnimatePresence>
            {inTeam && p.pending !== "revoke" && <span className="text-xs text-muted">Drag the outsider back here to remove them.</span>}
          </div>
        </ZoneBox>
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-bad/40 p-5">
          <span className="label !text-bad">Attacker&apos;s contract</span>
          <Chip id="attacker" label="AlwaysTrueTeam" sub={`${shortAddr(p.attacker)} · says yes to everyone`} seed={p.attacker} attacker
            disabled={busy} beckon={p.allowed === "hijack" && !busy} zones={zones} setOver={setOver}
            onDropZone={(z) => { if (z === "socket") want("hijack"); }} onKey={() => want("hijack")} />
          <span className="text-xs text-muted">Drop it on the team socket to try to hijack Cascade.</span>
        </div>
      </div>

      {/* ── middle: the team roster ────────────────────────────── */}
      <ZoneBox zoneRef={roster} over={over === "roster" && !inTeam} accent
        title={<span className="flex items-center justify-between gap-2"><span className="label">Team roster</span><span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted">native EAC</span></span>}
        hint={<>TeamRegistry — members hold <span className="font-mono">MEMBER</span>, an ordinary EAC role.</>}>
        <div className="flex min-h-28 flex-col gap-2 rounded-xl border border-dashed border-line p-3">
          <AnimatePresence mode="popLayout">
            {inTeam && outsiderChip}
            {p.pending === "grant" && <Ghost key="g-grant" label="joining — waiting for the block…" />}
          </AnimatePresence>
          {!inTeam && p.pending !== "grant" && (
            <span className="m-auto text-center text-sm text-muted">{p.member === undefined ? "Reading the roster…" : "Drop the outsider here"}</span>
          )}
        </div>

        {/* the team pointer socket */}
        <div ref={socket} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-shadow ${over === "socket" ? "bg-bad-soft shadow-[inset_0_0_0_2px_var(--bad)]" : "bg-sunken"}`}>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-surface ring-1 ring-line">
            <span className={`h-2.5 w-2.5 rounded-full ${p.pending === "hijack" ? "bg-warn pulse" : "bg-cascade"}`} />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-xs font-medium">Team socket</span>
            <span className="text-[11px] text-muted">which roster Cascade reads · guarded by <span className="font-mono">ROLE_SET_TEAM</span></span>
          </span>
        </div>
        <AnimatePresence>
          {p.pending === "hijack" && <Ghost key="g-hijack" label="attempting setTeam…" />}
          {!p.pending && refused && (
            <motion.p key={hijack!.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} transition={{ duration: 0.5 }}
              className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">
              Refused on-chain{hijack!.reason ? <>: <span className="font-mono">{hijack!.reason}</span></> : ""}. The socket still points at TeamRegistry.
            </motion.p>
          )}
        </AnimatePresence>
      </ZoneBox>

      {/* ── connector: the parent's grant to the team ──────────── */}
      <div className="flex items-center justify-center gap-3 py-2 lg:flex-col lg:gap-1.5 lg:px-1 lg:py-0">
        <div className={`h-10 w-[3px] rounded-full lg:hidden ${p.grant ? "flow-y" : "border-l-2 border-dashed border-faint"}`} />
        <span className="text-[11px] text-muted lg:order-first">{p.grant === undefined ? "…" : p.grant ? "editor role" : "no grant"}</span>
        <div className={`hidden h-[3px] w-full rounded-full lg:block ${p.grant ? "flow-x" : "border-t-2 border-dashed border-faint"}`} />
      </div>

      {/* ── right: the namespace ───────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-[inset_0_0_0_1px_var(--line)] lg:ml-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="label">Namespace</span>
            <span className="font-mono text-[15px] font-medium">{TEAM_NAME}</span>
            <span className="text-xs text-muted">The parent grants the <em>team</em> its editor role (<span className="font-mono">SET_SUBREGISTRY</span>). Stock EAC.</span>
          </div>
        </div>

        <ul className="flex flex-col">
          <AnimatePresence initial={false}>
            {p.subnames.map((l) => {
              const open = p.access[l];
              const isTarget = l === p.target;
              return (
                <motion.li key={l} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: EASE }}
                  className="relative flex items-stretch gap-3 pl-4">
                  {/* tree line: the team's authority reaching this name */}
                  <span className={`absolute bottom-0 left-0 top-0 w-[3px] rounded-full ${p.grant ? "flow-y opacity-70" : "bg-line"}`} />
                  <span className={`absolute left-0 top-1/2 h-[2px] w-3 ${p.grant ? "bg-cascade/60" : "bg-line"}`} />
                  <div className={`my-1 flex flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors duration-500 ${
                    open ? "bg-ok-soft" : isTarget ? "bg-paper ring-1 ring-line" : "bg-paper"}`}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Lock open={open} />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate font-mono text-[13px]"><span className="font-medium">{l}</span><span className="text-muted">.devops…</span></span>
                        <span className={`text-[11px] ${open ? "text-ok" : "text-muted"}`}>
                          {open === undefined ? "reading…" : open ? "outsider can manage it" : "outsider locked out"}
                        </span>
                      </span>
                    </span>
                    <button type="button" onClick={() => { if (can("write")) p.onAct("write", l); else if (!busy) p.onBlocked("write"); }}
                      disabled={busy} aria-label={`Write to ${l} as the outsider`}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-on-cascade transition active:scale-95 disabled:opacity-40 bg-cascade ${
                        p.allowed === "write" && isTarget && !busy ? "beckon" : ""}`}>
                      {p.pending === "write" && isTarget ? <><Spinner /> writing…</> : "Write"}
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        <button type="button" onClick={() => want("create")} disabled={busy}
          className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-ink-2 transition hover:border-cascade hover:text-cascade disabled:opacity-40 ${p.allowed === "create" && !busy ? "beckon" : ""}`}>
          {p.pending === "create" ? <><Spinner /> registering…</> : <>+ New subname</>}
        </button>
        {p.subnames.length > 1 && <p className="text-[11px] text-muted">Every subname answers the same way — they all follow the one relationship.</p>}
        {p.subnames.length === 0 && <p className="text-xs text-muted">No subnames yet. {ACTIONS.create.consequence}</p>}
      </div>
    </div>
  );
}
