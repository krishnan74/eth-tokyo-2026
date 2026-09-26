"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useRef, useState, type ReactNode, type RefObject } from "react";

import { TEAM_NAME, roleNames } from "@/lib/cascade/contracts";
import type { ActionName, TxEntry } from "@/lib/cascade/hooks";

import { shortAddr } from "../cascade/primitives";
import { EASE } from "../pitch/Reveal";

type Status = "success" | "reverted" | "error" | "noop" | undefined;
type Props = {
  outsider?: string | null;
  member?: boolean;
  grant?: boolean;
  subnames: string[];
  access: Record<string, boolean | undefined>;
  target: string | null;
  setTarget: (l: string) => void;
  stored?: bigint;
  effective?: bigint;
  pending: string | null;
  writesEnabled: boolean;
  lastHijack?: TxEntry;
  act: (a: ActionName, label?: string) => Promise<Status>;
  onReset: () => void;
};

// ── the guided path: a hint and a highlight, never a lock ────────────────────
const STEPS: { action: ActionName; text: string; expect?: "success" | "reverted" }[] = [
  { action: "create", text: "Create a file in the devops folder. Nobody is given access to it." },
  { action: "write", text: "Try to edit it as the outsider.", expect: "reverted" },
  { action: "grant", text: "Drag the outsider into the devops-team group." },
  { action: "write", text: "Edit the same file again.", expect: "success" },
  { action: "revoke", text: "Drag the outsider out of the group." },
  { action: "write", text: "Edit it once more.", expect: "reverted" },
  { action: "hijack", text: "Optional: as the outsider, try to change who the folder is shared with.", expect: "reverted" },
];

// ── icons ────────────────────────────────────────────────────────────────────
export const Folder = ({ className = "h-5 w-5" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2h8.7A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z" fill="currentColor" /></svg>
);
export const FileIcon = ({ className = "h-5 w-5" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden><path d="M6.5 3h7l5 5v11.5A1.5 1.5 0 0 1 17 21H6.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Z" fill="currentColor" opacity=".18" /><path d="M13.5 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 3h7l5 5v11.5A1.5 1.5 0 0 1 17 21H6.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Z" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
);
export const GroupIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><circle cx="9" cy="9" r="3.2" fill="currentColor" /><circle cx="16.5" cy="10" r="2.6" fill="currentColor" opacity=".55" /><path d="M3.5 18.5a5.5 5.5 0 0 1 11 0M13.8 18.5a4.3 4.3 0 0 1 7-3.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export function Avatar({ letter, tone }: { letter: string; tone: "outsider" | "admin" }) {
  return <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${tone === "outsider" ? "bg-[#6a5acd]" : "bg-[#3a4543]"}`}>{letter}</span>;
}
export const Spinner = () => <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" aria-hidden />;

// ── the draggable person ─────────────────────────────────────────────────────
type Zone = "group" | "people";
function PersonChip({ outsider, disabled, beckon, zones, setOver, onDrop, onKey }: {
  outsider?: string | null; disabled: boolean; beckon: boolean;
  zones: Record<Zone, RefObject<HTMLDivElement | null>>; setOver: (z: Zone | null) => void; onDrop: (z: Zone | null) => void; onKey: () => void;
}) {
  const hit = (info: PanInfo): Zone | null => {
    const x = info.point.x - window.scrollX, y = info.point.y - window.scrollY;
    for (const z of ["group", "people"] as Zone[]) {
      const r = zones[z].current?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z;
    }
    return null;
  };
  return (
    <motion.div layoutId="outsider" role="button" tabIndex={disabled ? -1 : 0} aria-label="Outsider. Drag between People and the group, or press Enter to move."
      drag={!disabled} dragSnapToOrigin dragMomentum={false} dragElastic={0.18}
      whileDrag={{ scale: 1.06, zIndex: 60, boxShadow: "0 16px 36px -12px rgba(0,0,0,0.3)" }}
      onDrag={(_, i) => setOver(hit(i))} onDragEnd={(_, i) => { setOver(null); onDrop(hit(i)); }}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onKey(); } }}
      transition={{ layout: { duration: 0.6, ease: EASE } }}
      className={`flex w-full touch-none select-none items-center gap-2.5 rounded-xl bg-surface px-2.5 py-2 ring-1 ring-line ${disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"} ${beckon ? "beckon" : ""}`}>
      <Avatar letter="O" tone="outsider" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-medium">Outsider</span>
        <span className="truncate font-mono text-[11px] text-muted">{outsider ? shortAddr(outsider) : "…"}</span>
      </span>
      <span className="ml-auto text-muted" aria-hidden>⠿</span>
    </motion.div>
  );
}

export function Pane({ zoneRef, over, title, children }: { zoneRef?: RefObject<HTMLDivElement | null>; over?: boolean; title: ReactNode; children: ReactNode }) {
  return (
    <div ref={zoneRef} className={`flex flex-col gap-2 rounded-2xl p-3 transition-[background-color,box-shadow] duration-300 ${over ? "bg-cascade-soft shadow-[inset_0_0_0_2px_var(--cascade)]" : "bg-paper"}`}>
      <span className="px-1 text-xs font-medium text-ink-2">{title}</span>
      {children}
    </div>
  );
}

// ── the drive ────────────────────────────────────────────────────────────────
export function DriveDemo(p: Props) {
  const group = useRef<HTMLDivElement>(null), people = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState<Zone | null>(null);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ text: string; good: boolean } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const busy = !!p.pending || !p.writesEnabled;
  const inGroup = p.member === true;
  const current = STEPS[step];
  const beckon = (a: ActionName) => !busy && current?.action === a;

  async function run(a: ActionName, label?: string) {
    if (busy) return;
    setResult(null);
    const status = await p.act(a, label);
    const s = STEPS[step];
    if (s && s.action === a && status && status !== "noop" && status !== "error") {
      const good = !s.expect || s.expect === status;
      setResult({ good, text: s.expect ? `${describe(a, status).replace(/\.$/, "")} — ${good ? "as expected" : "not what we expected"}.` : describe(a, status) });
      setStep((i) => Math.min(i + 1, STEPS.length));
    } else if (status && status !== "noop") {
      setResult({ good: status !== "error", text: describe(a, status) });
    }
  }
  const moveOutsider = () => run(inGroup ? "revoke" : "grant");

  const chip = (
    <PersonChip outsider={p.outsider} disabled={busy || p.member === undefined} beckon={beckon(inGroup ? "revoke" : "grant")}
      zones={{ group, people }} setOver={setOver} onKey={moveOutsider}
      onDrop={(z) => { if (!inGroup && z === "group") run("grant"); if (inGroup && z === "people") run("revoke"); }} />
  );
  const sel = p.target;
  const selOpen = sel ? p.access[sel] : undefined;
  const refused = p.lastHijack && (p.lastHijack.status === "reverted" || p.lastHijack.status === "error");

  return (
    <div className="flex flex-col gap-4">
      {/* guide: one line, never a lock */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs text-cascade">{Math.min(step + 1, STEPS.length)}/{STEPS.length}</span>
          <AnimatePresence mode="wait">
            <motion.span key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm">
              {current ? current.text : "That's the whole idea. Play freely, or reset and run it again."}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          {current && <button type="button" onClick={() => setStep((i) => i + 1)} className="rounded-full px-3 py-1.5 text-xs text-muted hover:text-ink">Skip</button>}
          <button type="button" onClick={() => { setStep(0); setResult(null); p.onReset(); }} disabled={busy}
            className="rounded-full px-3 py-1.5 text-xs text-ink-2 ring-1 ring-line hover:text-ink disabled:opacity-40">{p.pending === "reset" ? "Resetting…" : "Start over"}</button>
        </div>
      </div>
      <AnimatePresence>
        {result && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className={`overflow-hidden rounded-xl px-4 py-2 text-sm ${result.good ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{result.text}</motion.p>
        )}
      </AnimatePresence>

      {/* the drive window */}
      <div className="overflow-hidden rounded-3xl bg-surface shadow-[0_1px_0_var(--line),0_24px_60px_-36px_rgba(13,20,19,0.3)] ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <nav className="flex items-center gap-1.5 text-sm" aria-label="Path">
            <span className="text-muted">acme-corp.eth</span><span className="text-faint">/</span>
            <span className="flex items-center gap-1.5 font-medium text-ink"><Folder className="h-4 w-4 text-[#e0a526]" />devops</span>
          </nav>
          <button type="button" onClick={() => setShareOpen(true)} title="Who is this folder shared with?"
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs transition hover:ring-1 hover:ring-cascade ${p.grant ? "bg-cascade-soft text-cascade" : "bg-sunken text-muted"}`}>
            <GroupIcon />
            {p.grant === undefined ? "…" : p.grant ? <>Shared with <strong className="font-semibold">devops-team</strong> · Can edit</> : "Not shared with a group"}
            <span className="ml-1 rounded-full bg-surface px-2 py-0.5 font-medium text-ink">Share</span>
          </button>
        </div>

        <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
          {/* sidebar */}
          <aside className="flex flex-col gap-3 border-b border-line p-4 lg:border-b-0 lg:border-r">
            <FolderTree grant={p.grant} />
            <button type="button" onClick={() => run("create")} disabled={busy}
              className={`flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-paper shadow-sm transition active:scale-[0.98] disabled:opacity-40 ${beckon("create") ? "beckon" : ""}`}>
              {p.pending === "create" ? <><Spinner /> Creating…</> : <><span className="text-lg leading-none">+</span> New file</>}
            </button>
            <Pane zoneRef={group} over={over === "group" && !inGroup} title={<span className="flex items-center gap-1.5"><GroupIcon /> devops-team</span>}>
              <div className="flex min-h-12 flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {inGroup && chip}
                  {p.pending === "grant" && <motion.span key="g" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-xl border border-dashed border-cascade px-3 py-2 text-xs text-cascade"><Spinner /> adding…</motion.span>}
                </AnimatePresence>
                {!inGroup && p.pending !== "grant" && <span className="px-1 text-xs text-muted">No members yet. Drop someone here.</span>}
              </div>
            </Pane>
            <Pane zoneRef={people} over={over === "people" && inGroup} title="People">
              <div className="flex min-h-12 flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {!inGroup && chip}
                  {p.pending === "revoke" && <motion.span key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted"><Spinner /> removing…</motion.span>}
                </AnimatePresence>
                {inGroup && p.pending !== "revoke" && <span className="px-1 text-xs text-muted">Drag the outsider back here to remove them.</span>}
              </div>
            </Pane>
            <button type="button" onClick={moveOutsider} disabled={busy || p.member === undefined} className="text-left text-xs text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40">
              {inGroup ? "Remove outsider from group" : "Add outsider to group"} (instead of dragging)
            </button>
          </aside>

          {/* files */}
          <section className="flex min-w-0 flex-col border-b border-line lg:border-b-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line px-5 py-2.5 text-xs text-muted">
              <span>Name</span><span>Outsider can…</span>
            </div>
            {p.subnames.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-sm text-muted">
                <Folder className="h-10 w-10 text-[#e0a526]/60" />
                This folder is empty. Press <span className="font-medium text-ink">+ New file</span>.
              </div>
            )}
            <ul className="flex flex-col">
              <AnimatePresence initial={false}>
                {p.subnames.map((l) => {
                  const open = p.access[l];
                  const active = l === sel;
                  return (
                    <motion.li key={l} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
                      onClick={() => p.setTarget(l)}
                      className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-3 transition-colors last:border-b-0 ${active ? "bg-cascade-soft/60" : "hover:bg-paper"}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <FileIcon className="h-5 w-5 shrink-0 text-[#4a7fd6]" />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate text-sm font-medium">{l}</span>
                          <span className="truncate font-mono text-[11px] text-muted">{l}.{TEAM_NAME}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`hidden rounded-full px-2 py-0.5 text-[11px] sm:inline ${open ? "bg-ok-soft text-ok" : "bg-sunken text-muted"}`}>
                          {open === undefined ? "…" : open ? "edit" : "no access"}
                        </span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); p.setTarget(l); run("write", l); }} disabled={busy}
                          className={`inline-flex items-center gap-1.5 rounded-full bg-cascade px-3 py-1.5 text-xs font-medium text-on-cascade transition active:scale-95 disabled:opacity-40 ${beckon("write") && (active || !sel) ? "beckon" : ""}`}>
                          {p.pending === "write" && active ? <><Spinner /> editing…</> : "Edit as outsider"}
                        </button>
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>

          {/* details: who has access */}
          <aside className="flex flex-col gap-4 p-5 lg:border-l lg:border-line">
            {!sel && <p className="text-sm text-muted">Select a file to see who has access.</p>}
            {sel && (
              <>
                <div className="flex items-center gap-2.5">
                  <FileIcon className="h-6 w-6 text-[#4a7fd6]" />
                  <span className="min-w-0 truncate text-sm font-semibold">{sel}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-ink-2">Who has access</span>
                  <Row icon={<Avatar letter="A" tone="admin" />} who="Admin" sub="operator" right="Owner" />
                  <Row icon={<span className="grid h-7 w-7 place-items-center rounded-full bg-cascade-soft text-cascade"><GroupIcon /></span>} who="devops-team" sub="from the devops folder" right={p.grant ? "Can edit" : "—"} />
                  <Row icon={<Avatar letter="O" tone="outsider" />} who="Outsider" sub={selOpen ? "via devops-team" : "not in the group"}
                    right={<span className={selOpen ? "text-ok" : "text-muted"}>{selOpen === undefined ? "…" : selOpen ? "Can edit" : "No access"}</span>} />
                </div>
                <div className="flex flex-col gap-1.5 rounded-2xl bg-paper p-3 text-xs">
                  <span className="font-medium text-ink-2">Outsider on this file, in ENS terms</span>
                  <span className="flex justify-between gap-2"><span className="text-muted">given directly</span><span className="font-mono">{fmt(p.stored)}</span></span>
                  <span className="flex justify-between gap-2"><span className="text-muted">via the group</span><span className={`font-mono ${p.effective && p.effective !== p.stored ? "text-cascade" : ""}`}>{fmt(p.effective && p.stored !== undefined ? p.effective & ~p.stored : p.effective)}</span></span>
                  <span className="mt-1 leading-snug text-muted">Nothing is ever written to the file. Access comes from the group, checked live every time.</span>
                </div>
              </>
            )}
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
              <span className="text-xs font-medium text-ink-2">Try an attack</span>
              <button type="button" onClick={() => run("hijack")} disabled={busy}
                className={`rounded-xl px-3 py-2 text-left text-xs text-bad ring-1 ring-bad/40 transition hover:bg-bad-soft disabled:opacity-40 ${beckon("hijack") ? "beckon" : ""}`}>
                {p.pending === "hijack" ? "Trying…" : "As the outsider, change who the folder is shared with"}
              </button>
              {refused && !p.pending && <span className="text-[11px] leading-snug text-bad">Refused on-chain{p.lastHijack?.reason ? ` (${p.lastHijack.reason})` : ""}. Only an admin can change the folder&apos;s group.</span>}
            </div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} grant={p.grant} inGroup={inGroup} onAttack={() => { setShareOpen(false); run("hijack"); }} busy={busy} />}
      </AnimatePresence>

      {/* the mapping, stated once */}
      <p className="text-xs leading-relaxed text-muted">
        <span className="font-medium text-ink-2">In ENS terms:</span> folder = a name with its own registry (<span className="font-mono">devops.acme-corp.eth</span>) · file = a subname · group = the <span className="font-mono">TeamRegistry</span> contract · “Can edit” = the <span className="font-mono">SET_SUBREGISTRY</span> role · editing = repointing the subname. Every action is a real transaction on the ENSv2 beta (Sepolia).
      </p>
    </div>
  );
}

/** Folders nest like ENSv2 registries. The parent-folder cascade is the roadmap — shown, clearly not built. */
function FolderTree({ grant }: { grant?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-paper p-3 text-sm">
      <span className="px-1 pb-1 text-xs font-medium text-ink-2">Folders</span>
      <span className="flex items-center gap-2 px-1 text-ink-2"><Folder className="h-4 w-4 text-[#e0a526]" />acme-corp.eth</span>
      <span className="ml-4 flex items-center gap-2 rounded-lg bg-cascade-soft/70 px-2 py-1 font-medium">
        <Folder className="h-4 w-4 text-[#e0a526]" />devops
        {grant && <span className="ml-auto text-cascade" title="Shared with devops-team"><GroupIcon /></span>}
      </span>
      <p className="mt-2 rounded-lg border border-dashed border-line px-2 py-1.5 text-[11px] leading-snug text-muted">
        <span className="font-medium text-ink-2">Next — not built yet:</span> share <span className="font-mono">acme-corp.eth</span> itself, and access cascades into every subfolder. Today it&apos;s one level: a folder&apos;s own files.
      </p>
    </div>
  );
}

/** Drive's most familiar dialog, reading live chain state. Read-only: only an admin can change the group. */
function ShareDialog({ onClose, grant, inGroup, onAttack, busy }: { onClose: () => void; grant?: boolean; inGroup: boolean; onAttack: () => void; busy: boolean }) {
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()} role="presentation">
      <motion.div role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25, ease: EASE }}
        className="flex w-full max-w-md flex-col gap-5 rounded-3xl bg-surface p-6 shadow-2xl ring-1 ring-line">
        <h3 id="share-title" className="text-lg font-semibold">Share “devops”</h3>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-ink-2">People and groups with access</span>
          <Row icon={<Avatar letter="A" tone="admin" />} who="Admin" sub="operator" right="Owner" />
          <Row icon={<span className="grid h-7 w-7 place-items-center rounded-full bg-cascade-soft text-cascade"><GroupIcon /></span>} who="devops-team"
            sub={inGroup ? "1 member: Outsider" : "no members yet"} right={grant === undefined ? "…" : grant ? "Can edit" : "—"} />
        </div>
        <p className="rounded-2xl bg-paper p-3 text-xs leading-relaxed text-ink-2">
          Applies to every file in <span className="font-medium text-ink">devops</span> — including files created later. Nothing is shared file by file.
          <span className="mt-1.5 block text-muted">In ENS terms: the parent registry grants <span className="font-mono">TeamRegistry</span> the <span className="font-mono">SET_SUBREGISTRY</span> role on <span className="font-mono">devops</span>; Cascade gives that role to the team&apos;s members on every subname.</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onAttack} disabled={busy} className="text-xs text-bad underline-offset-2 hover:underline disabled:opacity-40">Try changing the group as the outsider</button>
          <button type="button" onClick={onClose} autoFocus className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper">Done</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Row({ icon, who, sub, right }: { icon: ReactNode; who: string; sub: string; right: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="flex min-w-0 flex-col leading-tight"><span className="text-sm">{who}</span><span className="truncate text-[11px] text-muted">{sub}</span></span>
      <span className="ml-auto text-xs text-ink-2">{right}</span>
    </div>
  );
}

const fmt = (b?: bigint) => (b === undefined ? "…" : roleNames(b).join(", ") || "none");

function describe(a: ActionName, s: Status) {
  const ok = s === "success";
  switch (a) {
    case "create": return ok ? "File created. Nobody was given access to it." : "Couldn't create the file.";
    case "write": return ok ? "Edit saved — the outsider could edit because they're in the group." : "Edit refused — the outsider has no access.";
    case "grant": return ok ? "Outsider added to devops-team. Every file in the folder is now editable by them." : "Couldn't add to the group.";
    case "revoke": return ok ? "Outsider removed from devops-team. Their access is gone from every file." : "Couldn't remove from the group.";
    case "hijack": return ok ? "Unexpected: the change went through." : "Refused — only an admin can change who the folder is shared with.";
    case "reset": return ok ? "Reset: the outsider is out of the group." : "Reset failed.";
  }
}
