"use client";

import { useEffect, useRef, useState } from "react";

import { Activity } from "@/components/cascade/Activity";
import { Checks } from "@/components/cascade/Checks";
import { RolesStrip } from "@/components/cascade/RolesStrip";
import { ACTIONS, STEPS } from "@/components/cascade/steps";
import { TopBar } from "@/components/cascade/TopBar";
import { Coach } from "@/components/pitch/Coach";
import { DemoBoard } from "@/components/pitch/DemoBoard";
import { Chapter, Reveal } from "@/components/pitch/Reveal";
import { Ask, FinePrint, Fit, Hero, Idea, Problem, Roadmap } from "@/components/pitch/Sections";
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
    if (guided && STEPS[index]?.action === a && status) setOutcomes((o) => ({ ...o, [index]: status }));
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

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-36 px-4 pb-24 sm:px-8">
        <Hero live={{ member: demo.live.member, grant: demo.live.parentGrantsTeam, subnames: demo.subnames.length }} />
        <Problem />
        <Idea />

        <section className="flex flex-col gap-10">
          <Chapter id="demo" n="03" kicker="Live demo" title={<>Drag to grant. <span className="italic text-muted">Drag back to revoke.</span></>}
            lede="Real contracts on Sepolia. Every drop and every write is a transaction — the board only moves once the chain confirms it." />
          <Reveal className="flex flex-col gap-8 rounded-[28px] bg-surface/70 p-5 shadow-[0_1px_0_var(--line),0_30px_80px_-40px_rgba(13,20,19,0.25)] ring-1 ring-line backdrop-blur sm:p-8">
            <Coach guided={guided} setGuided={chooseGuided} index={index} setIndex={(i) => { setBlocked(null); setIndex(i); }}
              outcome={outcomes[index]} member={demo.live.member} hasTarget={!!demo.target} blocked={blocked} />
            <DemoBoard outsider={actors?.outsider} attacker={SEPOLIA.attacker} member={demo.live.member} grant={demo.live.parentGrantsTeam}
              subnames={demo.subnames} access={demo.access} target={demo.target} pending={demo.pending} writesEnabled={writesEnabled}
              allowed={allowed} lastHijack={lastHijack} onAct={onAct} onBlocked={onBlocked} />
          </Reveal>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Reveal className="flex min-w-0 flex-col gap-4">
              <span className="label">What the chain says about the outsider{demo.target ? <> on <span className="normal-case text-ink">{demo.target}</span></> : ""}</span>
              <RolesStrip stored={demo.target ? demo.live.storedRoles : undefined} effective={demo.target ? demo.live.effectiveRoles : undefined} target={demo.target} />
              <Checks runs={demo.runs} target={demo.target} onRecheck={demo.recheck} busy={!!demo.pending} />
            </Reveal>
            <Reveal delay={0.08} className="min-w-0 lg:max-h-[34rem] lg:overflow-y-auto">
              <Activity txs={demo.txs} member={demo.live.member} lastWrite={demo.lastWrite} />
            </Reveal>
          </div>
        </section>

        <Fit />
        <Roadmap />
        <Ask />
        <FinePrint />

        <footer className="flex flex-col gap-8 border-t border-line pt-10">
          <span className="display text-[clamp(3rem,9vw,7rem)] leading-none">Cascade<span className="text-cascade">.</span></span>
          <p className="max-w-3xl text-sm leading-relaxed text-muted">
            ENSv2 beta on Sepolia · built on <span className="font-mono">ensdomains/contracts-v2@48b3e2d</span> · the terminal demo (<span className="font-mono">npm run demo</span>) runs the same contracts and checks from <span className="font-mono">core/cascade/</span>, plus the wallet-as-team and parent re-issue cases.
          </p>
        </footer>
      </main>
    </>
  );
}
