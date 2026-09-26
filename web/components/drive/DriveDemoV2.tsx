"use client";

// The shared-drive demo on CascadeSubregistryV2 (roadmap branch): two folder levels, two groups (one of
// them nested), and sharing at the top folder that cascades into the subfolder's files.
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useRef, useState, type ReactNode, type RefObject } from "react";

import type { V2ActionName, V2Result, V2Status } from "@/lib/cascade/v2hooks";
import type { V2State } from "@/lib/cascade/v2server";

import { shortAddr } from "../cascade/primitives";
import { EASE } from "../pitch/Reveal";
import { Avatar, FileIcon, Folder, GroupIcon, Pane, Row, Spinner } from "./DriveDemo";

type Props = {
  state: V2State | null;
  files: string[];
  target: string | null;
  setTarget: (l: string) => void;
  pending: V2ActionName | null;
  last: { action: V2ActionName; result: V2Result } | null;
  act: (a: V2ActionName, label?: string) => Promise<V2Status>;
};

const STEPS: { action: V2ActionName; text: string; expect?: "success" | "reverted" }[] = [
  { action: "create", text: "Create a file in the platform folder. Nobody is given access to it." },
  { action: "setSubregistry", text: "As the outsider, try to edit it.", expect: "reverted" },
  { action: "joinDev", text: "Drag the outsider into dev-team — platform is shared with it (can edit)." },
  { action: "setSubregistry", text: "Edit the file again.", expect: "success" },
  { action: "setResolver", text: "Now try to set its resolver. dev-team can't do that.", expect: "reverted" },
  { action: "joinSre", text: "Drag the outsider into sre — a team inside security. acme-labs.eth, the folder above, is shared with security." },
  { action: "setResolver", text: "Set the resolver again — the sharing on the parent folder cascades down.", expect: "success" },
  { action: "depth1", text: "Turn off “sharing from acme-labs.eth reaches platform”." },
  { action: "setResolver", text: "Try the resolver once more.", expect: "reverted" },
  { action: "depth2", text: "Turn the cascade back on." },
  { action: "hijack", text: "Optional: as the outsider, try to add a group that says yes to everyone.", expect: "reverted" },
];

type Zone = "dev" | "sre" | "people";

/** A draggable "Outsider" chip; `from` is where it sits, dropping it on another zone moves it. */
function Chip({ from, label, outsider, disabled, beckon, zones, setOver, onDrop }: {
  from: Zone; label?: string; outsider?: string; disabled: boolean; beckon: boolean;
  zones: Record<Zone, RefObject<HTMLDivElement | null>>; setOver: (z: Zone | null) => void; onDrop: (from: Zone, to: Zone | null) => void;
}) {
  const hit = (info: PanInfo): Zone | null => {
    const x = info.point.x - window.scrollX, y = info.point.y - window.scrollY;
    // sre sits inside security's pane, so test it before the others.
    for (const z of ["sre", "dev", "people"] as Zone[]) {
      const r = zones[z].current?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z;
    }
    return null;
  };
  return (
    <motion.div role="button" tabIndex={disabled ? -1 : 0} aria-label={`Outsider${label ? ` (${label})` : ""}. Drag to a group or back to People.`}
      drag={!disabled} dragSnapToOrigin dragMomentum={false} dragElastic={0.18}
      whileDrag={{ scale: 1.06, zIndex: 60, boxShadow: "0 16px 36px -12px rgba(0,0,0,0.3)" }}
      onDrag={(_, i) => setOver(hit(i))} onDragEnd={(_, i) => { setOver(null); onDrop(from, hit(i)); }}
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3, ease: EASE }}
      className={`flex w-full touch-none select-none items-center gap-2.5 rounded-xl bg-surface px-2.5 py-2 ring-1 ring-line ${disabled ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"} ${beckon ? "beckon" : ""}`}>
      <Avatar letter="O" tone="outsider" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-medium">Outsider</span>
        <span className="truncate font-mono text-[11px] text-muted">{label ?? (outsider ? shortAddr(outsider) : "…")}</span>
      </span>
      <span className="ml-auto text-muted" aria-hidden>⠿</span>
    </motion.div>
  );
}

const teamName = (s: V2State | null, addr?: string) =>
  !s || !addr ? "" : s.teams.find((t) => t.address.toLowerCase() === addr.toLowerCase())?.name ?? shortAddr(addr);

export function DriveDemoV2(p: Props) {
  const dev = useRef<HTMLDivElement>(null), sre = useRef<HTMLDivElement>(null), people = useRef<HTMLDivElement>(null);
  const zones = { dev, sre, people };
  const [over, setOver] = useState<Zone | null>(null);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ text: string; good: boolean } | null>(null);
  const [shareOpen, setShareOpen] = useState<"platform" | "acme-labs" | null>(null);

  const s = p.state;
  const busy = !!p.pending || !s?.writesEnabled;
  const inDev = s?.teams.find((t) => t.name === "dev-team")?.member;
  const inSre = s?.sre.member;
  const cascadeOn = s ? s.depth >= 2 : undefined;
  const devGrant = s?.teams.find((t) => t.name === "dev-team")?.grants.find((g) => g.level === 1);
  const secGrant = s?.teams.find((t) => t.name === "security")?.grants.find((g) => g.level === 2);
  const current = STEPS[step];
  const beckon = (a: V2ActionName) => !busy && current?.action === a;
  const file = s?.files.find((f) => f.label === p.target);

  async function run(a: V2ActionName, label?: string) {
    if (busy) return;
    setResult(null);
    const status = await p.act(a, label);
    const st = STEPS[step];
    if (st && st.action === a && status && status !== "noop" && status !== "error") {
      const good = !st.expect || st.expect === status;
      setResult({ good, text: st.expect ? `${describe(a, status)} — ${good ? "as expected" : "not what we expected"}.` : `${describe(a, status)}.` });
      setStep((i) => Math.min(i + 1, STEPS.length));
    } else if (status === "error") {
      setResult({ good: false, text: p.last?.result.error ?? "Something went wrong." });
    } else if (status && status !== "noop") {
      setResult({ good: true, text: `${describe(a, status)}.` });
    }
  }

  function drop(from: Zone, to: Zone | null) {
    if (!to || to === from) return;
    if (from === "people" && to === "dev" && !inDev) run("joinDev");
    else if (from === "people" && to === "sre" && !inSre) run("joinSre");
    else if (from === "dev" && to === "people") run("leaveDev");
    else if (from === "sre" && to === "people") run("leaveSre");
  }

  const chipProps = { outsider: s?.outsider, disabled: busy || !s, zones, setOver, onDrop: drop };
  const allIn = inDev && inSre;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs text-cascade">{Math.min(step + 1, STEPS.length)}/{STEPS.length}</span>
          <AnimatePresence mode="wait">
            <motion.span key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm">
              {current ? current.text : "That's the whole idea. Play freely, or start over and run it again."}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          {current && <button type="button" onClick={() => setStep((i) => i + 1)} className="rounded-full px-3 py-1.5 text-xs text-muted hover:text-ink">Skip</button>}
          <button type="button" onClick={() => { setStep(0); setResult(null); run("reset"); }} disabled={busy}
            className="rounded-full px-3 py-1.5 text-xs text-ink-2 ring-1 ring-line hover:text-ink disabled:opacity-40">{p.pending === "reset" ? "Resetting…" : "Start over"}</button>
        </div>
      </div>
      <AnimatePresence>
        {(result || p.pending) && (
          <motion.p key={p.pending ?? result?.text} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className={`flex items-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-sm ${p.pending ? "bg-cascade-soft text-cascade" : result?.good ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
            {p.pending ? <><Spinner /> Waiting for Sepolia (~12 s)…</> : result?.text}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-3xl bg-surface shadow-[0_1px_0_var(--line),0_24px_60px_-36px_rgba(13,20,19,0.3)] ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <nav className="flex items-center gap-1.5 text-sm" aria-label="Path">
            <span className="text-muted">acme-labs.eth</span><span className="text-faint">/</span>
            <span className="flex items-center gap-1.5 font-medium text-ink"><Folder className="h-4 w-4 text-[#e0a526]" />platform</span>
          </nav>
          <button type="button" onClick={() => setShareOpen("platform")} title="Who is this folder shared with?"
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs transition hover:ring-1 hover:ring-cascade ${devGrant ? "bg-cascade-soft text-cascade" : "bg-sunken text-muted"}`}>
            <GroupIcon />
            {!s ? "…" : <>Shared with <strong className="font-semibold">dev-team</strong>{cascadeOn && secGrant ? <> + <strong className="font-semibold">security</strong> (from acme-labs.eth)</> : null}</>}
            <span className="ml-1 rounded-full bg-surface px-2 py-0.5 font-medium text-ink">Share</span>
          </button>
        </div>

        <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
          <aside className="flex flex-col gap-3 border-b border-line p-4 lg:border-b-0 lg:border-r">
            {/* folders: two real levels, each shared with a group */}
            <div className="flex flex-col gap-1 rounded-2xl bg-paper p-3 text-sm">
              <span className="px-1 pb-1 text-xs font-medium text-ink-2">Folders</span>
              <button type="button" onClick={() => setShareOpen("acme-labs")} className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-left text-ink-2 hover:bg-sunken">
                <Folder className="h-4 w-4 text-[#e0a526]" />acme-labs.eth
                {secGrant && <span className="ml-auto flex items-center gap-1 text-[11px] text-cascade" title="Shared with security"><GroupIcon />security</span>}
              </button>
              <span className="ml-4 flex items-center gap-2 rounded-lg bg-cascade-soft/70 px-2 py-1 font-medium">
                <Folder className="h-4 w-4 text-[#e0a526]" />platform
                {devGrant && <span className="ml-auto flex items-center gap-1 text-[11px] text-cascade" title="Shared with dev-team"><GroupIcon />dev-team</span>}
              </span>
              <label className={`mt-2 flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[11px] leading-snug ring-1 ${cascadeOn ? "bg-cascade-soft/50 text-ink-2 ring-cascade/40" : "text-muted ring-line"} ${busy ? "cursor-not-allowed opacity-60" : ""} ${beckon("depth1") || beckon("depth2") ? "beckon" : ""}`}>
                <input type="checkbox" className="mt-0.5 accent-[var(--cascade)]" checked={!!cascadeOn} disabled={busy || cascadeOn === undefined}
                  onChange={() => run(cascadeOn ? "depth1" : "depth2")} />
                <span>Sharing on <span className="font-mono">acme-labs.eth</span> reaches <span className="font-mono">platform</span>&apos;s files
                  <span className="block text-muted">{p.pending === "depth1" || p.pending === "depth2" ? "changing…" : cascadeOn === undefined ? "…" : cascadeOn ? "on — inherits from 2 levels" : "off — this folder only"}</span></span>
              </label>
            </div>
            <button type="button" onClick={() => run("create")} disabled={busy}
              className={`flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-paper shadow-sm transition active:scale-[0.98] disabled:opacity-40 ${beckon("create") ? "beckon" : ""}`}>
              {p.pending === "create" ? <><Spinner /> Creating…</> : <><span className="text-lg leading-none">+</span> New file</>}
            </button>

            {/* groups: dev-team, and security which contains sre */}
            <Pane zoneRef={dev} over={over === "dev" && !inDev} title={<span className="flex items-center gap-1.5"><GroupIcon /> dev-team <span className="font-normal text-muted">· platform</span></span>}>
              <div className="flex min-h-11 flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {inDev && <Chip key="dev" from="dev" label="member" {...chipProps} beckon={false} />}
                </AnimatePresence>
                {!inDev && <span className="px-1 text-xs text-muted">{p.pending === "joinDev" ? "adding…" : "Drop someone here."}</span>}
              </div>
            </Pane>
            <Pane title={<span className="flex items-center gap-1.5"><GroupIcon /> security <span className="font-normal text-muted">· acme-labs.eth</span></span>}>
              <div ref={sre} className={`ml-2 flex flex-col gap-2 rounded-xl border-l-2 p-2 transition-colors ${over === "sre" && !inSre ? "border-cascade bg-cascade-soft" : "border-line"}`}>
                <span className="text-[11px] font-medium text-ink-2">sre <span className="font-normal text-muted">(a team inside security)</span></span>
                <div className="flex min-h-11 flex-col gap-2">
                  <AnimatePresence mode="popLayout">
                    {inSre && <Chip key="sre" from="sre" label="member" {...chipProps} beckon={false} />}
                  </AnimatePresence>
                  {!inSre && <span className="px-1 text-xs text-muted">{p.pending === "joinSre" ? "adding…" : "Drop someone here."}</span>}
                </div>
              </div>
            </Pane>
            <Pane zoneRef={people} over={over === "people"} title="People">
              <div className="flex min-h-11 flex-col gap-2">
                {!allIn && <Chip from="people" {...chipProps} beckon={beckon("joinDev") || beckon("joinSre")} />}
                {allIn && <span className="px-1 text-xs text-muted">In both groups. Drag a member chip back here to remove.</span>}
              </div>
            </Pane>
          </aside>

          {/* files */}
          <section className="flex min-w-0 flex-col border-b border-line lg:border-b-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line px-5 py-2.5 text-xs text-muted">
              <span>Name</span><span>Outsider can…</span>
            </div>
            <ul className="flex flex-col">
              <AnimatePresence initial={false}>
                {p.files.map((l) => {
                  const f = s?.files.find((x) => x.label === l);
                  const active = l === p.target;
                  return (
                    <motion.li key={l} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
                      onClick={() => p.setTarget(l)}
                      className={`flex cursor-pointer flex-col gap-2 border-b border-line px-5 py-3 transition-colors last:border-b-0 ${active ? "bg-cascade-soft/60" : "hover:bg-paper"}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <FileIcon className="h-5 w-5 shrink-0 text-[#4a7fd6]" />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate text-sm font-medium">{l}</span>
                          <span className="truncate font-mono text-[11px] text-muted">{l}.platform.acme-labs.eth</span>
                        </span>
                        <span className="ml-auto flex gap-1.5">
                          <Badge on={f?.setSubregistry.allowed} text="edit" />
                          <Badge on={f?.setResolver.allowed} text="resolver" />
                        </span>
                      </span>
                      <span className="flex flex-wrap justify-end gap-2">
                        <ActBtn onClick={() => { p.setTarget(l); run("setSubregistry", l); }} disabled={busy} beckon={beckon("setSubregistry") && (active || !p.target)} busy={p.pending === "setSubregistry" && active}>Edit as outsider</ActBtn>
                        <ActBtn onClick={() => { p.setTarget(l); run("setResolver", l); }} disabled={busy} beckon={beckon("setResolver") && (active || !p.target)} busy={p.pending === "setResolver" && active}>Set resolver as outsider</ActBtn>
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>

          {/* who has access */}
          <aside className="flex flex-col gap-4 p-5 lg:border-l lg:border-line">
            {!p.target && <p className="text-sm text-muted">Select a file to see who has access.</p>}
            {p.target && (
              <>
                <div className="flex items-center gap-2.5">
                  <FileIcon className="h-6 w-6 text-[#4a7fd6]" />
                  <span className="min-w-0 truncate text-sm font-semibold">{p.target}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-ink-2">Who has access</span>
                  <Row icon={<Avatar letter="A" tone="admin" />} who="Admin" sub="operator" right="Owner" />
                  <Row icon={<GroupDot />} who="dev-team" sub="from platform" right={!s ? "…" : devGrant ? "Can edit" : "—"} />
                  <Row icon={<GroupDot />} who="security" sub={cascadeOn === undefined ? "from acme-labs.eth" : cascadeOn ? "from acme-labs.eth (cascades down)" : "from acme-labs.eth — not reaching here"} right={!s ? "…" : secGrant && cascadeOn ? "Can set resolver" : "—"} />
                </div>
                <div className="flex flex-col gap-2 rounded-2xl bg-paper p-3 text-xs">
                  <span className="font-medium text-ink-2">Outsider on this file</span>
                  {[{ what: "Edit (SET_SUBREGISTRY)", e: file?.setSubregistry }, { what: "Set resolver (SET_RESOLVER)", e: file?.setResolver }].map(({ what, e }) => (
                    <span key={what} className="flex flex-col gap-0.5">
                      <span className="flex justify-between gap-2"><span className="text-muted">{what}</span>
                        <span className={e?.allowed ? "text-ok" : "text-muted"}>{e ? (e.allowed ? "yes" : "no") : "…"}</span></span>
                      {e?.allowed && !e.native && (
                        <span className="text-right font-mono text-[11px] text-cascade">
                          via {teamName(s, e.team)}{teamName(s, e.team) === "security" ? " ⊃ sre" : ""} · level {e.level} ({e.level === 1 ? "platform" : "acme-labs.eth"})
                        </span>
                      )}
                    </span>
                  ))}
                  <span className="mt-1 leading-snug text-muted">Nothing is written to the file. Access comes from the groups and the folders above, checked live every time.</span>
                </div>
              </>
            )}
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
              <span className="text-xs font-medium text-ink-2">Try an attack</span>
              <button type="button" onClick={() => run("hijack")} disabled={busy}
                className={`rounded-xl px-3 py-2 text-left text-xs text-bad ring-1 ring-bad/40 transition hover:bg-bad-soft disabled:opacity-40 ${beckon("hijack") ? "beckon" : ""}`}>
                {p.pending === "hijack" ? "Trying…" : "As the outsider, add a group that says yes to everyone"}
              </button>
              {p.last?.action === "hijack" && p.last.result.status === "reverted" && !p.pending && (
                <span className="text-[11px] leading-snug text-bad">Refused on-chain{p.last.result.expectedRevertReason ? ` (${p.last.result.expectedRevertReason})` : ""}. Only an admin can change which groups a folder is shared with.</span>
              )}
            </div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {shareOpen && <ShareDialogV2 folder={shareOpen} onClose={() => setShareOpen(null)} devGrant={!!devGrant} secGrant={!!secGrant} cascadeOn={!!cascadeOn} inDev={!!inDev} inSre={!!inSre} />}
      </AnimatePresence>

      <p className="text-xs leading-relaxed text-muted">
        <span className="font-medium text-ink-2">In ENS terms:</span> folders = names with their own registries (<span className="font-mono">acme-labs.eth</span>, <span className="font-mono">platform.acme-labs.eth</span>) · file = a subname · groups = team contracts (<span className="font-mono">TeamRegistry</span>; security is a <span className="font-mono">NestedTeam</span> containing sre) · “Can edit” = <span className="font-mono">SET_SUBREGISTRY</span>, granted on <span className="font-mono">platform</span> · “Can set resolver” = <span className="font-mono">SET_RESOLVER</span>, granted on <span className="font-mono">acme-labs.eth</span> itself · the cascade switch = <span className="font-mono">CascadeSubregistryV2.setDepth(2 / 1)</span>. Every action is a real transaction on the ENSv2 beta (Sepolia). Roadmap branch — the submitted demo runs the one-level version.
      </p>
    </div>
  );
}

const GroupDot = () => <span className="grid h-7 w-7 place-items-center rounded-full bg-cascade-soft text-cascade"><GroupIcon /></span>;

function Badge({ on, text }: { on?: boolean; text: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-ok-soft text-ok" : "bg-sunken text-muted"}`}>{on === undefined ? "…" : on ? text : `no ${text}`}</span>;
}

function ActBtn({ onClick, disabled, beckon, busy, children }: { onClick: () => void; disabled: boolean; beckon: boolean; busy: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full bg-cascade px-3 py-1.5 text-xs font-medium text-on-cascade transition active:scale-95 disabled:opacity-40 ${beckon ? "beckon" : ""}`}>
      {busy ? <><Spinner /> sending…</> : children}
    </button>
  );
}

function ShareDialogV2({ folder, onClose, devGrant, secGrant, cascadeOn, inDev, inSre }: {
  folder: "platform" | "acme-labs"; onClose: () => void; devGrant: boolean; secGrant: boolean; cascadeOn: boolean; inDev: boolean; inSre: boolean;
}) {
  const top = folder === "acme-labs";
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()} role="presentation">
      <motion.div role="dialog" aria-modal="true" aria-labelledby="share-v2-title" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25, ease: EASE }}
        className="flex w-full max-w-md flex-col gap-5 rounded-3xl bg-surface p-6 shadow-2xl ring-1 ring-line">
        <h3 id="share-v2-title" className="text-lg font-semibold">Share “{top ? "acme-labs.eth" : "platform"}”</h3>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-ink-2">People and groups with access</span>
          <Row icon={<Avatar letter="A" tone="admin" />} who="Admin" sub="operator" right="Owner" />
          {top ? (
            <Row icon={<GroupDot />} who="security" sub={inSre ? "via sre: Outsider" : "contains sre · no members yet"} right={secGrant ? "Can set resolver" : "—"} />
          ) : (
            <>
              <Row icon={<GroupDot />} who="dev-team" sub={inDev ? "1 member: Outsider" : "no members yet"} right={devGrant ? "Can edit" : "—"} />
              <Row icon={<GroupDot />} who="security" sub={cascadeOn ? "inherited from acme-labs.eth" : "on acme-labs.eth — not reaching here"} right={secGrant && cascadeOn ? "Can set resolver" : "—"} />
            </>
          )}
        </div>
        <p className="rounded-2xl bg-paper p-3 text-xs leading-relaxed text-ink-2">
          {top
            ? <>Applies to every folder and file under <span className="font-medium text-ink">acme-labs.eth</span> whose folder lets it cascade — including ones created later.</>
            : <>Applies to every file in <span className="font-medium text-ink">platform</span>, including files created later. Sharing from the parent folder is added on top, when the cascade is on.</>}
          <span className="mt-1.5 block text-muted">
            In ENS terms: {top ? <>the <span className="font-mono">.eth</span> registry grants the security team contract <span className="font-mono">SET_RESOLVER</span> on <span className="font-mono">acme-labs</span>; CascadeSubregistryV2 walks up two levels (checking each parent points back down) and gives it to security&apos;s members, including sre&apos;s.</>
              : <>acme-labs.eth&apos;s registry grants the dev-team contract <span className="font-mono">SET_SUBREGISTRY</span> on <span className="font-mono">platform</span>; CascadeSubregistryV2 gives it to dev-team&apos;s members on every file.</>}
          </span>
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} autoFocus className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper">Done</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function describe(a: V2ActionName, s: V2Status) {
  const ok = s === "success";
  switch (a) {
    case "create": return ok ? "File created in platform. Nobody was given access to it" : "Couldn't create the file";
    case "setSubregistry": return ok ? "Edit saved — allowed through dev-team, shared on platform" : "Edit refused — no group gives the outsider that role";
    case "setResolver": return ok ? "Resolver set — allowed through security ⊃ sre, shared on acme-labs.eth two levels up" : "Resolver refused — no group reaching this file gives that role";
    case "joinDev": return ok ? "Outsider added to dev-team" : "Couldn't add to dev-team";
    case "leaveDev": return ok ? "Outsider removed from dev-team" : "Couldn't remove from dev-team";
    case "joinSre": return ok ? "Outsider added to sre, which is inside security" : "Couldn't add to sre";
    case "leaveSre": return ok ? "Outsider removed from sre" : "Couldn't remove from sre";
    case "depth1": return ok ? "Cascade off: platform's files only look at platform's sharing" : "Couldn't change the cascade";
    case "depth2": return ok ? "Cascade on: sharing on acme-labs.eth reaches platform's files again" : "Couldn't change the cascade";
    case "hijack": return ok ? "Unexpected: the change went through" : "Refused — only an admin can add a group";
    case "reset": return ok ? "Reset: outsider in no group, cascade on" : "Reset failed";
  }
}
