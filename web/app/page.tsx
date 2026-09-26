"use client";

import { ACTIONS } from "@/components/cascade/steps";
import { TopBar } from "@/components/cascade/TopBar";
import { DriveDemo } from "@/components/drive/DriveDemo";
import { Architecture } from "@/components/simple/Architecture";
import { Intro } from "@/components/simple/Intro";
import { MoreDetail } from "@/components/simple/MoreDetail";
import { TracePanel } from "@/components/simple/TracePanel";
import { useActors, useCascadeDemo, type ActionName } from "@/lib/cascade/hooks";

export default function Page() {
  const actors = useActors();
  const demo = useCascadeDemo(actors?.outsider);
  const writesEnabled = actors?.writesEnabled ?? false;
  const lastHijack = demo.txs.find((t) => t.title === ACTIONS.hijack.logTitle);
  const act = (a: ActionName, label?: string) => demo.act(a, { title: ACTIONS[a].logTitle, kind: ACTIONS[a].kind }, label);

  return (
    <>
      <TopBar outsider={actors?.outsider} operator={actors?.operator} writesEnabled={actors ? writesEnabled : undefined} />

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-24 px-4 pb-24 sm:px-8">
        <Intro />

        <section id="try" className="flex scroll-mt-24 flex-col gap-6">
          <div className="flex max-w-3xl flex-col gap-3">
            <span className="label">Try it</span>
            <h2 className="display text-[clamp(2.2rem,4.6vw,3.8rem)]">Share the folder with a group. <span className="italic text-muted">Not each file with each person.</span></h2>
          </div>
          <DriveDemo outsider={actors?.outsider} member={demo.live.member} grant={demo.live.parentGrantsTeam}
            subnames={demo.subnames} access={demo.access} target={demo.target} setTarget={demo.setTarget}
            stored={demo.target ? demo.live.storedRoles : undefined} effective={demo.target ? demo.live.effectiveRoles : undefined}
            pending={demo.pending} writesEnabled={writesEnabled} lastHijack={lastHijack} act={act} onReset={() => { act("reset"); }} />
          {demo.notice && <p className="rounded-xl bg-ok-soft px-4 py-2 text-sm text-ok">{demo.notice}</p>}
        </section>

        <section id="trace" className="scroll-mt-24">
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
