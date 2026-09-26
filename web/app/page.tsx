"use client";

import { useEffect, useRef, useState } from "react";

import { RolesStrip } from "@/components/cascade/RolesStrip";
import { ACTIONS, STEPS } from "@/components/cascade/steps";
import { TopBar } from "@/components/cascade/TopBar";
import { Coach } from "@/components/pitch/Coach";
import { DemoBoard } from "@/components/pitch/DemoBoard";
import { Architecture } from "@/components/simple/Architecture";
import { Intro } from "@/components/simple/Intro";
import { MoreDetail } from "@/components/simple/MoreDetail";
import { TracePanel } from "@/components/simple/TracePanel";
import { SEPOLIA } from "@/lib/cascade/contracts";
import { useActors, useCascadeDemo, type ActionName } from "@/lib/cascade/hooks";

type Outcome = "success" | "reverted" | "error";

export default function Page() {
  const actors = useActors();
  const demo = useCascadeDemo(actors?.outsider);
  const [guided, setGuided] = useState(true);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [blocked, setBlocked] = useState<string | null>(null);
  const blockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Guided by default on a first visit; remember the viewer's choice after that.
  useEffect(() => {
    try { const g = localStorage.getItem("cascade.guided"); if (g !== null) setGuided(g === "1"); } catch { /* default */ }
  }, []);
  const chooseGuided = (g: boolean) => {
    setGuided(g);
    if (g) { setIndex(0); setOutcomes({}); }
    try { localStorage.setItem("cascade.guided", g ? "1" : "0"); } catch { /* per-visit only */ }
  };

  const stepDone = guided && outcomes[index] !== undefined;
  const allowed: ActionName | null = guided ? (stepDone ? null : STEPS[index]!.action) : null;

  async function onAct(a: ActionName, label?: string) {
    setBlocked(null);
    const status = await demo.act(a, { title: ACTIONS[a].logTitle, kind: ACTIONS[a].kind }, label);
    if (guided && STEPS[index]?.action === a && status && status !== "noop") setOutcomes((o) => ({ ...o, [index]: status }));
  }
  async function onReset() {
    await demo.act("reset", { title: ACTIONS.reset.logTitle, kind: "native" });
    if (guided) { setIndex(0); setOutcomes({}); }
  }
  function onBlocked(a: ActionName) {
    const msg = stepDone
      ? "This step is done — press Continue for the next one, or switch to Free play."
      : `This step asks you to: ${STEPS[index]!.how} (You tried: ${ACTIONS[a].short.toLowerCase()}.) Switch to Free play to do things in any order.`;
    setBlocked(msg);
    clearTimeout(blockTimer.current);
    blockTimer.current = setTimeout(() => setBlocked(null), 5000);
  }

  const writesEnabled = actors?.writesEnabled ?? false;
  const lastHijack = demo.txs.find((t) => t.title === ACTIONS.hijack.logTitle);

  return (
    <>
      <TopBar outsider={actors?.outsider} operator={actors?.operator} writesEnabled={actors ? writesEnabled : undefined} />

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-28 px-4 pb-24 sm:px-8">
        <Intro />

        <section id="try" className="flex scroll-mt-24 flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex max-w-3xl flex-col gap-3">
              <span className="label">Try it</span>
              <h2 className="display text-[clamp(2.2rem,4.6vw,3.8rem)]">Drag someone into the team. <span className="italic text-muted">Watch the names unlock.</span></h2>
              <p className="text-base leading-relaxed text-ink-2">Real contracts on the ENSv2 beta (Sepolia). Every drop and every write is a transaction, and nothing moves until the chain confirms it.</p>
            </div>
            <button type="button" onClick={onReset} disabled={!writesEnabled || !!demo.pending}
              className="rounded-full px-4 py-2 text-sm text-ink-2 ring-1 ring-line transition hover:text-ink hover:ring-ink disabled:opacity-40">
              {demo.pending === "reset" ? "Resetting…" : "Reset demo"}
            </button>
          </div>
          {demo.notice && <p className="rounded-xl bg-ok-soft px-4 py-2 text-sm text-ok">{demo.notice}</p>}

          <div className="flex flex-col gap-8 rounded-[28px] bg-surface/70 p-5 shadow-[0_1px_0_var(--line),0_30px_80px_-40px_rgba(13,20,19,0.25)] ring-1 ring-line sm:p-8">
            <Coach guided={guided} setGuided={chooseGuided} index={index} setIndex={(i) => { setBlocked(null); setIndex(i); }}
              outcome={outcomes[index]} member={demo.live.member} hasTarget={!!demo.target} blocked={blocked} />
            <DemoBoard outsider={actors?.outsider} attacker={SEPOLIA.attacker} member={demo.live.member} grant={demo.live.parentGrantsTeam}
              subnames={demo.subnames} access={demo.access} target={demo.target} pending={demo.pending} writesEnabled={writesEnabled}
              allowed={allowed} lastHijack={lastHijack} onAct={onAct} onBlocked={onBlocked} />
          </div>

          <div className="flex flex-col gap-3">
            <span className="label">The outsider&apos;s roles{demo.target ? <> on <span className="normal-case text-ink">{demo.target}</span></> : ""}</span>
            <RolesStrip stored={demo.target ? demo.live.storedRoles : undefined} effective={demo.target ? demo.live.effectiveRoles : undefined} target={demo.target} />
          </div>

          <TracePanel trace={demo.trace} />
        </section>

        <Architecture />

        <MoreDetail txs={demo.txs} member={demo.live.member} lastWrite={demo.lastWrite} />

        <footer className="flex flex-col gap-3 border-t border-line pt-8 text-sm text-muted">
          <span className="display text-4xl text-ink">Cascade<span className="text-cascade">.</span></span>
          <p className="max-w-3xl">ENSv2 beta on Sepolia · built on <span className="font-mono">ensdomains/contracts-v2@48b3e2d</span> · MVP scope: one hop, one team per registry.</p>
        </footer>
      </main>
    </>
  );
}
