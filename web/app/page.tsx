"use client";

import { TopBar } from "@/components/cascade/TopBar";
import { DriveDemoV2 } from "@/components/drive/DriveDemoV2";
import { Architecture } from "@/components/simple/Architecture";
import { Intro } from "@/components/simple/Intro";
import { MoreDetail } from "@/components/simple/MoreDetail";
import { TracePanel } from "@/components/simple/TracePanel";
import { useActors, useCascadeDemo } from "@/lib/cascade/hooks";
import { useV2Demo } from "@/lib/cascade/v2hooks";

export default function Page() {
  const actors = useActors();
  const demo = useCascadeDemo(actors?.outsider);
  // Roadmap branch: the drive runs on CascadeSubregistryV2 (acme-labs.eth). The v1 hook still feeds "More detail".
  const v2 = useV2Demo();
  const writesEnabled = actors?.writesEnabled ?? false;

  return (
    <>
      <TopBar outsider={actors?.outsider} operator={actors?.operator} writesEnabled={actors ? writesEnabled : undefined} />

      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-24 px-4 pb-24 sm:px-8">
        <Intro />

        <section id="try" className="flex scroll-mt-24 flex-col gap-6">
          <div className="flex max-w-3xl flex-col gap-3">
            <span className="label">Try it</span>
            <h2 className="display text-[clamp(2.2rem,4.6vw,3.8rem)]">Share a folder — or the one above it. <span className="italic text-muted">Access cascades down.</span></h2>
          </div>
          {v2.readError && <p className="rounded-xl bg-bad-soft px-4 py-2 text-sm text-bad">Could not read the roadmap tree: {v2.readError}</p>}
          <DriveDemoV2 state={v2.state} files={v2.files} target={v2.target} setTarget={v2.setTarget} pending={v2.pending} last={v2.last} act={v2.act} />
        </section>

        <section id="trace" className="scroll-mt-24">
          <TracePanel trace={v2.trace} />
        </section>

        <Architecture />

        <MoreDetail txs={demo.txs} member={demo.live.member} lastWrite={demo.lastWrite} />

        <footer className="flex flex-col gap-3 border-t border-line pt-8 text-sm text-muted">
          <span className="display text-4xl text-ink">ENS Drive<span className="text-cascade">.</span></span>
          <p className="max-w-3xl">Powered by Cascade, a ReBAC permission layer for ENSv2 · ENSv2 beta on Sepolia · built on <span className="font-mono">ensdomains/contracts-v2@48b3e2d</span> · Roadmap branch: up to 4 teams per registry, teams of teams, inheritance up to 3 levels (<span className="font-mono">CascadeSubregistryV2</span>) — the submitted demo is the one-hop MVP.</p>
        </footer>
      </main>
    </>
  );
}
