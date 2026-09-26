"use client";

// The cascade drive (CascadeSubregistryV2): two folder levels, two groups (security-council contains auditors), and
// sharing on the parent folder that flows into the subfolder's files. The main path uses one verb —
// "can edit" — at both levels; the resolver permission, the nested team, new files and the attack are
// all still here, one step off the main path.
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useRef, useState, type ReactNode, type RefObject } from "react";

import type { V2ActionName, V2Result, V2Status } from "@/lib/cascade/v2hooks";
import type { TraceState } from "@/lib/cascade/hooks";
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
  elapsed: number;
  last: { action: V2ActionName; result: V2Result; seconds: number } | null;
  trace: TraceState;
  act: (a: V2ActionName, label?: string) => Promise<V2Status>;
};

const STEPS: { action: V2ActionName; text: string; expect?: "success" | "reverted" }[] = [
  { action: "setSubregistry", text: "You run orbit-dao. Alex just joined as a contributor — every click is a real transaction. First, Alex tries to edit vault: nobody has shared anything with them.", expect: "reverted" },
  { action: "joinDev", text: "Drag Alex into core-devs — protocol is shared with it. Watch all three contracts' names." },
  { action: "setSubregistry", text: "Alex edits vault again.", expect: "success" },
  { action: "moveDevToSre", text: "Move Alex from core-devs into auditors — a team inside security-council. orbit-dao.eth, the folder above, is shared with security-council." },
  { action: "setSubregistry", text: "Alex edits again — the sharing on the parent folder flows down.", expect: "success" },
  { action: "depth1", text: "Turn off “Sharing flows into subfolders”." },
  { action: "setSubregistry", text: "Alex tries once more.", expect: "reverted" },
  { action: "depth2", text: "Turn it back on." },
];

type Zone = "dev" | "sre" | "people";

function Chip({ from, sub, outsider, name, joining, disabled, beckon, zones, setOver, onDrop }: {
  from: Zone; sub?: string; outsider?: string; name?: string | null; joining?: boolean; disabled: boolean; beckon: boolean;
  zones: Record<Zone, RefObject<HTMLDivElement | null>>; setOver: (z: Zone | null) => void; onDrop: (from: Zone, to: Zone | null) => void;
}) {
  const hit = (info: PanInfo): Zone | null => {
    const x = info.point.x - window.scrollX, y = info.point.y - window.scrollY;
    for (const z of ["sre", "dev", "people"] as Zone[]) { // sre sits inside security-council's pane: test it first
      const r = zones[z].current?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z;
    }
    return null;
  };
  return (
    <motion.div role="button" tabIndex={disabled ? -1 : 0} aria-label="Alex, the new teammate. Drag to a group, between groups, or back to People."
      drag={!disabled} dragSnapToOrigin dragMomentum={false} dragElastic={0.18}
      whileDrag={{ scale: 1.06, zIndex: 60, boxShadow: "0 16px 36px -12px rgba(0,0,0,0.3)" }}
      onDrag={(_, i) => setOver(hit(i))} onDragEnd={(_, i) => { setOver(null); onDrop(from, hit(i)); }}
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3, ease: EASE }}
      className={`flex w-full touch-none select-none items-center gap-2.5 rounded-xl bg-surface px-2.5 py-2 ${joining ? "outline-dashed outline-1 outline-cascade" : "ring-1 ring-line"} ${disabled && !joining ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"} ${beckon ? "beckon" : ""}`}>
      <Avatar letter="Al" tone="outsider" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-medium">Alex</span>
        <span className="truncate font-mono text-[11px] text-muted">{joining ? <span className="flex items-center gap-1.5 text-cascade"><Spinner /> joining · confirming on Sepolia</span> : sub ?? name ?? (outsider ? `new contributor · ${shortAddr(outsider)}` : "…")}</span>
      </span>
      <span className="ml-auto text-muted" aria-hidden>⠿</span>
    </motion.div>
  );
}

const nameOf = (s: V2State | null, addr?: string) =>
  !s || !addr ? "" : s.teams.find((t) => t.address.toLowerCase() === addr.toLowerCase())?.name ?? shortAddr(addr);

export function DriveDemoV2(p: Props) {
  const dev = useRef<HTMLDivElement>(null), sre = useRef<HTMLDivElement>(null), people = useRef<HTMLDivElement>(null);
  const zones = { dev, sre, people };
  const [over, setOver] = useState<Zone | null>(null);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ text: string; good: boolean } | null>(null);
  const [shareOpen, setShareOpen] = useState<"protocol" | "orbit-dao" | null>(null);
  const [more, setMore] = useState(false);
  // Optimistic membership while a join/move is confirming: the chip moves on drop; files' access badges
  // only ever show confirmed state. Cleared when the action returns (the hook refreshes state first).
  const [opt, setOpt] = useState<{ dev?: boolean; sre?: boolean } | null>(null);

  const s = p.state;
  const loading = !s;
  const busy = !!p.pending || !s?.writesEnabled;
  const inDev = opt?.dev ?? s?.teams.find((t) => t.name === "core-devs")?.member;
  const inSre = opt?.sre ?? s?.sre.member;
  const cascadeOn = s ? s.depth >= 2 : undefined;
  const devShared = !!s?.teams.find((t) => t.name === "core-devs")?.grants.some((g) => g.level === 1 && g.roles.includes("SET_SUBREGISTRY"));
  const secShared = !!s?.teams.find((t) => t.name === "security-council")?.grants.some((g) => g.level === 2 && g.roles.includes("SET_SUBREGISTRY"));
  const current = STEPS[step];
  const beckon = (...a: V2ActionName[]) => !busy && !!current && a.includes(current.action);
  const file = s?.files.find((f) => f.label === p.target);
  const edit = file?.setSubregistry;
  const via = (e?: { allowed: boolean; native: boolean; team: string; level: number }) =>
    !e ? "…" : !e.allowed ? "not in a group with access" : e.native ? "given directly"
      : `via ${nameOf(s, e.team) === "security-council" ? "auditors → security-council" : nameOf(s, e.team)}`;

  async function run(a: V2ActionName, label?: string) {
    if (busy) return;
    setResult(null);
    const status = await p.act(a, label);
    const st = STEPS[step];
    if (st && st.action === a && status && status !== "noop" && status !== "error") {
      const good = !st.expect || st.expect === status;
      setResult({ good, text: st.expect ? `${describe(a, status)} — ${good ? "as expected" : "not what we expected"}.` : `${describe(a, status)}.` });
      setStep((i) => Math.min(i + 1, STEPS.length));
    } else if (status === "error") setResult({ good: false, text: "Something went wrong — see below." });
    else if (status && status !== "noop") setResult({ good: true, text: `${describe(a, status)}.` });
  }

  function drop(from: Zone, to: Zone | null) {
    if (!to || to === from || busy) return;
    const move = (a: V2ActionName, o: { dev?: boolean; sre?: boolean }) => { setOpt(o); run(a).finally(() => setOpt(null)); };
    if (from === "people" && to === "dev" && !inDev) move("joinDev", { dev: true });
    else if (from === "people" && to === "sre" && !inSre) move("joinSre", { sre: true });
    else if (from === "dev" && to === "sre" && !inSre) move("moveDevToSre", { dev: false, sre: true });
    else if (from === "sre" && to === "dev" && !inDev) move("moveSreToDev", { sre: false, dev: true });
    else if (from === "dev" && to === "people") move("leaveDev", { dev: false });
    else if (from === "sre" && to === "people") move("leaveSre", { sre: false });
  }

  const chipProps = { outsider: s?.outsider, name: s?.outsiderName, disabled: busy || loading, zones, setOver, onDrop: drop };
  const lastErr = p.last?.result.error;

  return (
    <div className="flex flex-col gap-4">
      {/* guide: one line, never a lock */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs text-cascade">{Math.min(step + 1, STEPS.length)}/{STEPS.length}</span>
          <AnimatePresence mode="wait">
            <motion.span key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm">
              {current ? current.text : "That's the cascade: two shares set up once, and every change after that is one move of one person. Play freely — add a file, try the attack, or start over."}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
          {current && <button type="button" onClick={() => setStep((i) => i + 1)} className="rounded-full px-3 py-1.5 text-xs text-muted hover:text-ink">Skip</button>}
          <button type="button" onClick={() => { setStep(0); setResult(null); run("reset"); }} disabled={busy}
            className="rounded-full px-3 py-1.5 text-xs text-ink-2 ring-1 ring-line hover:text-ink disabled:opacity-40">{p.pending === "reset" ? "Resetting…" : "Start over"}</button>
        </div>
      </div>

      {/* status: live progress while a transaction is out, then the outcome and what the contracts did */}
      <AnimatePresence mode="wait">
        {p.pending ? (
          <motion.div key="pending" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 overflow-hidden rounded-xl bg-cascade-soft px-4 py-2 text-sm text-cascade">
            <Spinner /> Sent to Sepolia — waiting for the next block · <span className="font-mono tabular">{p.elapsed}s</span>
          </motion.div>
        ) : result ? (
          <motion.div key={result.text} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className={`flex flex-col gap-1 overflow-hidden rounded-xl px-4 py-2 text-sm ${result.good ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
            <span>{result.text}</span>
            {p.last?.result.hash && (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] opacity-80">
                <span>mined in block {p.last.result.block} · {p.last.seconds}s</span>
                <a href={`https://sepolia.etherscan.io/tx/${p.last.result.hash}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">Etherscan ↗</a>
                <span>what the contracts did: bottom-right ↘</span>
              </span>
            )}
            {lastErr && <span className="text-xs">{lastErr}</span>}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* the drive window */}
      <div className="relative overflow-hidden rounded-3xl bg-surface shadow-[0_1px_0_var(--line),0_24px_60px_-36px_rgba(13,20,19,0.3)] ring-1 ring-line">
        {loading && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-surface/80 backdrop-blur-[2px]">
            <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm text-ink-2 ring-1 ring-line"><Spinner /> Reading the contracts on Sepolia…</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <nav className="flex items-center gap-1.5 text-sm" aria-label="Path">
            <button type="button" onClick={() => setShareOpen("orbit-dao")} className="text-muted hover:text-ink">orbit-dao.eth</button><span className="text-faint">/</span>
            <span className="flex items-center gap-1.5 font-medium text-ink"><Folder className="h-4 w-4 text-[#e0a526]" />protocol</span>
          </nav>
          <button type="button" onClick={() => setShareOpen("protocol")} title="Who is this folder shared with?"
            className="flex items-center gap-2 rounded-full bg-cascade-soft px-3 py-1 text-xs text-cascade transition hover:ring-1 hover:ring-cascade">
            <GroupIcon />
            {!s ? "…" : <>Shared with <strong className="font-semibold">core-devs</strong>{cascadeOn && secShared ? <> · and <strong className="font-semibold">security-council</strong> from above</> : null}</>}
            <span className="ml-1 rounded-full bg-surface px-2 py-0.5 font-medium text-ink">Share</span>
          </button>
        </div>

        <p className="border-b border-line bg-paper px-5 py-2 text-xs text-ink-2"><span className="font-medium text-ink">The setup:</span> protocol is shared with core-devs, and orbit-dao.eth — the folder above — with security-council, which includes auditors. Two shares, made once. Everything below is just who&apos;s in which team.</p>
        <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
          <aside className="flex flex-col gap-3 border-b border-line p-4 lg:border-b-0 lg:border-r">
            {/* folders: two real levels, each shared with a group */}
            <div className="flex flex-col gap-1 rounded-2xl bg-paper p-3 text-sm">
              <span className="px-1 pb-1 text-xs font-medium text-ink-2">Folders</span>
              <button type="button" onClick={() => setShareOpen("orbit-dao")} className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-left text-ink-2 hover:bg-sunken">
                <Folder className="h-4 w-4 text-[#e0a526]" />orbit-dao.eth
                {secShared && <span className="ml-auto flex items-center gap-1 text-[11px] text-cascade" title="Shared with security-council"><GroupIcon />security-council</span>}
              </button>
              <span className="ml-4 flex items-center gap-2 rounded-lg bg-cascade-soft/70 px-2 py-1 font-medium">
                <Folder className="h-4 w-4 text-[#e0a526]" />protocol
                {devShared && <span className="ml-auto flex items-center gap-1 text-[11px] text-cascade" title="Shared with core-devs"><GroupIcon />core-devs</span>}
              </span>
              <button type="button" disabled={busy || cascadeOn === undefined} onClick={() => run(cascadeOn ? "depth1" : "depth2")}
                className={`mt-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ring-1 transition disabled:cursor-not-allowed ${cascadeOn ? "bg-cascade-soft/60 text-ink ring-cascade/40" : "text-muted ring-line"} ${beckon("depth1", "depth2") ? "beckon" : ""}`}>
                <span>Sharing flows into subfolders</span>
                <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${cascadeOn ? "bg-cascade" : "bg-faint"}`} aria-hidden>
                  <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-surface transition-[left] ${cascadeOn ? "left-3.5" : "left-0.5"}`} />
                </span>
              </button>
              <span className="px-2 text-[11px] text-muted">{p.pending === "depth1" || p.pending === "depth2" ? "changing…" : cascadeOn === undefined ? "…" : cascadeOn ? "on — orbit-dao.eth's sharing reaches protocol's files" : "off — protocol's files only see protocol's sharing"}</span>
            </div>

            {/* groups */}
            <Pane zoneRef={dev} over={over === "dev" && !inDev} title={<span className="flex items-center gap-1.5"><GroupIcon /> core-devs <span className="font-normal text-muted">· protocol</span></span>}>
              <div className="flex min-h-11 flex-col gap-2">
                <AnimatePresence mode="popLayout">
                  {inDev && <Chip key="dev" from="dev" sub={s?.outsiderName ? `${s.outsiderName} · in core-devs` : "in core-devs"} joining={!!opt?.dev && !!p.pending} {...chipProps} beckon={beckon("moveDevToSre")} />}
                </AnimatePresence>
                {!inDev && <span className="px-1 text-xs text-muted">{p.pending === "joinDev" || p.pending === "moveSreToDev" ? "adding…" : "Drop someone here."}</span>}
              </div>
            </Pane>
            <Pane title={<span className="flex items-center gap-1.5"><GroupIcon /> security-council <span className="font-normal text-muted">· orbit-dao.eth</span></span>}>
              <div ref={sre} className={`ml-2 flex flex-col gap-2 rounded-xl border-l-2 p-2 transition-colors ${over === "sre" && !inSre ? "border-cascade bg-cascade-soft" : "border-line"}`}>
                <span className="text-[11px] font-medium text-ink-2">auditors <span className="font-normal text-muted">(a team inside security-council)</span></span>
                <div className="flex min-h-11 flex-col gap-2">
                  <AnimatePresence mode="popLayout">
                    {inSre && <Chip key="sre" from="sre" sub={s?.outsiderName ? `${s.outsiderName} · in auditors` : "in auditors"} joining={!!opt?.sre && !!p.pending} {...chipProps} beckon={false} />}
                  </AnimatePresence>
                  {!inSre && <span className="px-1 text-xs text-muted">{p.pending === "joinSre" || p.pending === "moveDevToSre" ? "adding…" : "Drop someone here."}</span>}
                </div>
              </div>
            </Pane>
            <Pane zoneRef={people} over={over === "people"} title="People">
              <div className="flex min-h-11 flex-col gap-2">
                {!(inDev || inSre) && <Chip from="people" {...chipProps} beckon={beckon("joinDev")} />}
                {(inDev || inSre) && <span className="px-1 text-xs text-muted">Alex is in a group. Drag them back here to remove.</span>}
              </div>
            </Pane>
          </aside>

          {/* files */}
          <section className="flex min-w-0 flex-col border-b border-line lg:border-b-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line px-5 py-2.5 text-xs text-muted">
              <span>Name</span><span>Alex can…</span>
            </div>
            <ul className="flex flex-col">
              <AnimatePresence initial={false}>
                {p.files.map((l) => {
                  const f = s?.files.find((x) => x.label === l);
                  const active = l === p.target;
                  return (
                    <motion.li key={l} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
                      onClick={() => p.setTarget(l)}
                      className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-3 transition-colors ${active ? "bg-cascade-soft/60" : "hover:bg-paper"}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <FileIcon className="h-5 w-5 shrink-0 text-[#4a7fd6]" />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate text-sm font-medium">{l}</span>
                          <span className="truncate font-mono text-[11px] text-muted">{l}.protocol.orbit-dao.eth</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <motion.span key={String(f?.setSubregistry.allowed)} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, ease: EASE }}
                          className={`hidden rounded-full px-2 py-0.5 text-[11px] sm:inline ${f?.setSubregistry.allowed ? "bg-ok-soft text-ok" : "bg-sunken text-muted"}`}>
                          {!f ? "…" : f.setSubregistry.allowed ? "can edit" : "no access"}
                        </motion.span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); p.setTarget(l); run("setSubregistry", l); }} disabled={busy}
                          className={`inline-flex items-center gap-1.5 rounded-full bg-cascade px-3 py-1.5 text-xs font-medium text-on-cascade transition active:scale-95 disabled:opacity-40 ${beckon("setSubregistry") && (active || !p.target) ? "beckon" : ""}`}>
                          {p.pending === "setSubregistry" && active ? <><Spinner /> editing…</> : "Edit as Alex"}
                        </button>
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <button type="button" onClick={() => run("create")} disabled={busy}
              className="m-4 flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm text-ink-2 ring-1 ring-line transition hover:text-ink disabled:opacity-40">
              {p.pending === "create" ? <><Spinner /> Creating…</> : <><span className="text-base leading-none">+</span> New file</>}
            </button>
          </section>

          {/* who has access */}
          <aside className="flex flex-col gap-4 p-5 lg:border-l lg:border-line">
            {p.target && (
              <>
                <div className="flex items-center gap-2.5">
                  <FileIcon className="h-6 w-6 text-[#4a7fd6]" />
                  <span className="min-w-0 truncate text-sm font-semibold">{p.target}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-ink-2">Who can edit</span>
                  <Row icon={<Avatar letter="A" tone="admin" />} who="Admin" sub="operator" right="Owner" />
                  <Row icon={<GroupDot />} who="core-devs" sub="shared on protocol" right={!s ? "…" : devShared ? "Can edit" : "—"} />
                  <Row icon={<GroupDot />} who="security-council" sub={cascadeOn === false ? "not flowing down" : "shared on orbit-dao.eth"} right={!s ? "…" : secShared && cascadeOn ? "Can edit" : "—"} />
                  <Row icon={<Avatar letter="Al" tone="outsider" />} who={s?.outsiderName ?? "Alex"} sub={via(edit)}
                    right={<span className={edit?.allowed ? "text-ok" : "text-muted"}>{!edit ? "…" : edit.allowed ? "Can edit" : "No access"}</span>} />
                </div>
                <p className="rounded-2xl bg-paper p-3 text-xs leading-snug text-muted">Nothing is written to the file. Access comes from the groups and the folders above, checked live on every write.</p>

                {/* one step off the main path: the second permission, and what it shows */}
                <button type="button" onClick={() => setMore((m) => !m)} className="text-left text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
                  {more ? "Hide" : "More"}: each group gets its own permissions
                </button>
                {more && (
                  <div className="flex flex-col gap-2 rounded-2xl bg-paper p-3 text-xs">
                    <span className="text-ink-2">security-council was also given <span className="font-medium">“can set resolver”</span> on orbit-dao.eth; core-devs was not.</span>
                    <span className="flex justify-between gap-2"><span className="text-muted">Alex can set the resolver</span>
                      <span className={file?.setResolver.allowed ? "text-ok" : "text-muted"}>{!file ? "…" : file.setResolver.allowed ? "yes" : "no"}</span></span>
                    {file?.setResolver.allowed && !file.setResolver.native && <span className="font-mono text-[11px] text-cascade">{via(file.setResolver)}</span>}
                    <button type="button" onClick={() => p.target && run("setResolver", p.target)} disabled={busy}
                      className="w-fit rounded-full bg-cascade px-3 py-1.5 text-xs font-medium text-on-cascade disabled:opacity-40">
                      {p.pending === "setResolver" ? "sending…" : "Set resolver as Alex"}
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
              <span className="text-xs font-medium text-ink-2">Try an attack</span>
              <button type="button" onClick={() => run("hijack")} disabled={busy}
                className="rounded-xl px-3 py-2 text-left text-xs text-bad ring-1 ring-bad/40 transition hover:bg-bad-soft disabled:opacity-40">
                {p.pending === "hijack" ? "Trying…" : "As Alex, add a group that says yes to everyone"}
              </button>
              {p.last?.action === "hijack" && p.last.result.status === "reverted" && !p.pending && (
                <span className="text-[11px] leading-snug text-bad">Refused on-chain{p.last.result.expectedRevertReason ? ` (${p.last.result.expectedRevertReason})` : ""}. Only an admin can change which groups a folder is shared with.</span>
              )}
            </div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {shareOpen && <ShareDialogV2 folder={shareOpen} onClose={() => setShareOpen(null)} devShared={devShared} secShared={secShared} cascadeOn={!!cascadeOn} inDev={!!inDev} inSre={!!inSre} />}
      </AnimatePresence>

      <p className="text-xs leading-relaxed text-muted">
        <span className="font-medium text-ink-2">In ENS terms:</span> folders = names with their own registries (<span className="font-mono">orbit-dao.eth</span>, <span className="font-mono">protocol.orbit-dao.eth</span>) · file = a subname · groups = team contracts (security-council is a <span className="font-mono">NestedTeam</span> containing auditors) · “can edit” = the <span className="font-mono">SET_SUBREGISTRY</span> role, granted to core-devs on <span className="font-mono">protocol</span> and to security-council on <span className="font-mono">orbit-dao.eth</span> · the switch = <span className="font-mono">CascadeSubregistryV2.setDepth(2 / 1)</span>. Every action is a real transaction on the ENSv2 beta (Sepolia).
      </p>
    </div>
  );
}

const GroupDot = () => <span className="grid h-7 w-7 place-items-center rounded-full bg-cascade-soft text-cascade"><GroupIcon /></span>;

function ShareDialogV2({ folder, onClose, devShared, secShared, cascadeOn, inDev, inSre }: {
  folder: "protocol" | "orbit-dao"; onClose: () => void; devShared: boolean; secShared: boolean; cascadeOn: boolean; inDev: boolean; inSre: boolean;
}) {
  const top = folder === "orbit-dao";
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()} role="presentation">
      <motion.div role="dialog" aria-modal="true" aria-labelledby="share-v2-title" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25, ease: EASE }}
        className="flex w-full max-w-md flex-col gap-5 rounded-3xl bg-surface p-6 shadow-2xl ring-1 ring-line">
        <h3 id="share-v2-title" className="text-lg font-semibold">Share “{top ? "orbit-dao.eth" : "protocol"}”</h3>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium text-ink-2">People and groups with access</span>
          <Row icon={<Avatar letter="A" tone="admin" />} who="Admin" sub="operator" right="Owner" />
          {top ? (
            <Row icon={<GroupDot />} who="security-council" sub={inSre ? "includes auditors: Alex" : "includes auditors · no members yet"} right={secShared ? "Can edit" : "—"} />
          ) : (
            <>
              <Row icon={<GroupDot />} who="core-devs" sub={inDev ? "1 member: Alex" : "no members yet"} right={devShared ? "Can edit" : "—"} />
              <Row icon={<GroupDot />} who="security-council" sub={cascadeOn ? "from orbit-dao.eth, the folder above" : "on orbit-dao.eth — not flowing down"} right={secShared && cascadeOn ? "Can edit" : "—"} />
            </>
          )}
        </div>
        <p className="rounded-2xl bg-paper p-3 text-xs leading-relaxed text-ink-2">
          {top
            ? <>Flows into every folder and file under <span className="font-medium text-ink">orbit-dao.eth</span> that lets sharing flow down — including ones created later.</>
            : <>Applies to every file in <span className="font-medium text-ink">protocol</span>, including files created later. Sharing from the folder above is added on top while it flows down.</>}
          <span className="mt-1.5 block text-muted">
            In ENS terms: {top ? <>the <span className="font-mono">.eth</span> registry grants the security-council team contract <span className="font-mono">SET_SUBREGISTRY</span> (and <span className="font-mono">SET_RESOLVER</span>) on <span className="font-mono">orbit-dao</span>. CascadeSubregistryV2 walks up two levels, checking each parent points back down, and gives it to security-council&apos;s members — including auditors&apos;.</>
              : <>orbit-dao.eth&apos;s registry grants the core-devs contract <span className="font-mono">SET_SUBREGISTRY</span> on <span className="font-mono">protocol</span>; CascadeSubregistryV2 gives it to core-devs&apos;s members on every file.</>}
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
    case "create": return ok ? "File created in protocol. Nobody was given access to it" : "Couldn't create the file";
    case "setSubregistry": return ok ? "Edit saved — a group Alex is in has access" : "Edit refused — no group gives Alex access";
    case "setResolver": return ok ? "Resolver set — allowed through security-council, shared on orbit-dao.eth" : "Resolver refused — no group reaching this file gives that permission";
    case "joinDev": return ok ? "Alex added to core-devs" : "Couldn't add to core-devs";
    case "leaveDev": return ok ? "Alex removed from core-devs" : "Couldn't remove from core-devs";
    case "joinSre": return ok ? "Alex added to auditors, which is inside security-council" : "Couldn't add to auditors";
    case "leaveSre": return ok ? "Alex removed from auditors" : "Couldn't remove from auditors";
    case "moveDevToSre": return ok ? "Alex moved: out of core-devs, into auditors (inside security-council)" : "Couldn't move Alex";
    case "moveSreToDev": return ok ? "Alex moved: out of auditors, into core-devs" : "Couldn't move Alex";
    case "depth1": return ok ? "Sharing no longer flows into subfolders" : "Couldn't change it";
    case "depth2": return ok ? "Sharing flows into subfolders again" : "Couldn't change it";
    case "hijack": return ok ? "Unexpected: the change went through" : "Refused — only an admin can add a group";
    case "reset": return ok ? "Reset: Alex is in no group, and sharing flows down" : "Reset failed";
  }
}
