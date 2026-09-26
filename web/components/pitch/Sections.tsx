"use client";

import { motion } from "framer-motion";

import { Chapter, EASE, Reveal } from "./Reveal";

// ── the problem ─────────────────────────────────────────────────────────

const LEDGER = [
  ["svc-api", "0xA1c…", "SET_SUBREGISTRY"],
  ["svc-api", "0xB27…", "SET_SUBREGISTRY"],
  ["svc-db", "0xA1c…", "SET_SUBREGISTRY"],
  ["svc-db", "0xB27…", "SET_SUBREGISTRY"],
  ["svc-cdn", "0xA1c…", "SET_SUBREGISTRY"],
  ["svc-cdn", "0xB27…", "SET_SUBREGISTRY"],
];

export function Problem() {
  return (
    <section className="flex flex-col gap-16">
      <Chapter id="gap" n="" kicker="The gap" title={<>Today, every permission <span className="italic text-muted">is an address.</span></>}
        lede="EAC answers exactly one question: is the caller's own address listed for this role, on this name? It has no entry that means “members of this team.”" />

      <div className="grid gap-10 md:grid-cols-12">
        <Reveal className="md:col-span-6 md:col-start-4">
          <div className="rounded-2xl bg-surface p-6 shadow-[inset_0_0_0_1px_var(--line)]">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="label">What EAC stores</span>
              <span className="font-mono text-[11px] text-muted">_roles[name][address]</span>
            </div>
            <table className="w-full font-mono text-xs">
              <tbody>
                {LEDGER.map((r, i) => (
                  <motion.tr key={i} className="border-t border-line" initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    transition={{ duration: 0.6, ease: EASE, delay: 0.1 + i * 0.06 }}>
                    <td className="py-2 pr-3">{r[0]}<span className="text-muted">.devops…</span></td>
                    <td className="py-2 pr-3 text-ink-2">{r[1]}</td>
                    <td className="py-2 text-right text-muted">{r[2]}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-sm text-muted">Two people, three names: six entries — and every new name or new teammate adds more.</p>
          </div>
        </Reveal>
        <div className="flex flex-col gap-8 md:col-span-3">
          <Reveal delay={0.1}>
            <blockquote className="display text-2xl leading-tight">“Anyone on the devops team may manage every subname under devops — <span className="italic">including tomorrow&apos;s.</span>”</blockquote>
            <p className="mt-3 text-sm text-muted">What a team actually needs to say. EAC can&apos;t.</p>
          </Reveal>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Reveal className="md:col-span-4 md:col-start-4">
          <span className="label">Workaround 1</span>
          <h3 className="mt-2 text-lg font-semibold">Copy every member everywhere</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">Grant each person on each registry — root grants do cover future names. But joining or leaving is a transaction per registry, each role caps at 15 holders, and one missed revoke leaves access behind.</p>
        </Reveal>
        <Reveal className="md:col-span-4" delay={0.08}>
          <span className="label">Workaround 2</span>
          <h3 className="mt-2 text-lg font-semibold">Grant one shared contract</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">Give the role to a contract such as a Safe. It works — but members stop acting as themselves: every action is routed through that contract and its own rules.</p>
        </Reveal>
      </div>
    </section>
  );
}

// ── how it fits ─────────────────────────────────────────────────────────

const STACK: { name: string; what: string; cascade?: string }[] = [
  { name: "Registry functions", what: "setSubregistry, setResolver, renew, register — each asks _checkRoles first." },
  { name: "_checkRoles", what: "Reverts if the caller lacks the role. Same function, same error." },
  { name: "_getRoles", what: "EAC's documented hook for extra role logic — PermissionedRegistry already uses it for approved operators.",
    cascade: "Cascade adds one term: the parent's grant to the team, if the caller is a member." },
  { name: "EAC storage", what: "_roles[resource][account], grantRoles / revokeRoles, events, 15-per-role counts." },
];

export function Fit() {
  return (
    <section className="flex flex-col gap-14">
      <Chapter id="fit" n="" kicker="How it fits" title={<>One hook. <span className="italic text-muted">Every other layer is stock ENSv2.</span></>}
        lede="Cascade is a PermissionedRegistry that overrides a single EAC hook — the same extension point the stock registry already uses." />
      <div className="grid gap-10 md:grid-cols-12">
        <ol className="flex flex-col md:col-span-6 md:col-start-4">
          {STACK.map((l, i) => (
            <Reveal key={l.name} delay={i * 0.06} className="flex flex-col">
              <div className={`rounded-2xl px-5 py-4 ${l.cascade ? "bg-inv text-inv-fg ring-1 ring-cascade/60" : "bg-surface shadow-[inset_0_0_0_1px_var(--line)]"}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-sm">{l.name}</span>
                  <span className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${l.cascade ? "text-inv-accent" : "text-muted"}`}>{l.cascade ? "+ cascade" : "unchanged"}</span>
                </div>
                <p className={`mt-1.5 text-sm leading-relaxed ${l.cascade ? "text-inv-muted" : "text-ink-2"}`}>{l.what}</p>
                {l.cascade && <p className="mt-3 text-sm text-inv-accent">{l.cascade}</p>}
              </div>
              {i < STACK.length - 1 && <span className="mx-auto h-5 w-px bg-line" aria-hidden />}
            </Reveal>
          ))}
        </ol>
        <div className="flex flex-col gap-8 md:col-span-3">
          <Reveal>
            <span className="label">Stays the same</span>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-2">
              {["Storage, grants, revokes", "Who can grant — admin roles never inherited", "Root actions stay native-only", "Everyone's existing grants", "The parent registry: stock code"].map((s) => (
                <li key={s} className="flex gap-2"><span className="text-ok">✓</span>{s}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.08}>
            <span className="label">Changes — named</span>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm">
              {[["hasRoles() includes inherited roles", "like approved operators — views agree with writes"],
                ["Inherited roles emit no events", "indexers should call hasRoles()"],
                ["≈2,300 gas per write", "two capped read-only calls; native owners too"],
                ["ROLE_SET_TEAM + a pointer", "gates which roster is read"]].map(([t, d]) => (
                <li key={t} className="flex flex-col"><span>{t}</span><span className="text-muted">{d}</span></li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── roadmap: from the MVP rule to full ReBAC ────────────────────────────

type Rung = { status: "live" | "v2" | "built" | "later"; title: string; body: string; model: string };
const RUNGS: Rung[] = [
  { status: "live", title: "One folder", model: "parent → team → member",
    body: "A grant on devops reaches every subname under it, through one team. The “One folder” tab above (CascadeSubregistry)." },
  { status: "v2", title: "Many teams per folder", model: "up to 4 teams, each with its own roles",
    body: "core-devs can edit protocol; security-council can edit and set resolvers from orbit-dao.eth. The “Cascade” tab above." },
  { status: "v2", title: "Teams of teams", model: "nested groups, bounded depth",
    body: "security-council contains auditors, so auditors get security-council's access. Up to 4 sub-teams, 3 levels; cycles end at the limit." },
  { status: "v2", title: "Sharing flows down the tree", model: "inheritance up to 3 folders, each link verified",
    body: "A grant on orbit-dao.eth reaches vault.protocol.orbit-dao.eth. Each folder must point back down to count; the switch in the demo turns it off." },
  { status: "built", title: "Bring your own roster", model: "Hats role · Safe owners behind isMember()",
    body: "Adapters for Hats Protocol and Safe, tested against the real Hats v1 and Safe 1.4.1 on a Sepolia fork. Not deployed until there's a real roster to point at." },
  { status: "later", title: "Who-can-access queries, resolver records, agent fleets", model: "reverse lookups · a second mechanism · the flagship use case",
    body: "Answering “who can edit this name?” via events and an indexer; record-level rights, which need your input because resolver permissions aren't organised by parent name; and agent fleets as the use case." },
];
const STATUS: Record<Rung["status"], { label: string; cls: string }> = {
  live: { label: "Live · one folder", cls: "bg-ok-soft text-ok" },
  v2: { label: "Live · cascade", cls: "bg-ok-soft text-ok" },
  built: { label: "Built · tested on a fork", cls: "bg-cascade-soft text-cascade" },
  later: { label: "After your feedback", cls: "bg-sunken text-ink-2" },
};

export function Roadmap() {
  return (
    <section className="flex flex-col gap-14">
      <Chapter id="roadmap" n="" kicker="Roadmap" title={<>From one folder <span className="italic text-muted">to full relationship-based access.</span></>}
        lede="Each step widens the relationship — never the trust: native grants stay untouched, admin and root roles are never inherited, every lookup is bounded and fails closed." />
      <ol className="relative flex flex-col gap-3 md:ml-[25%]">
        <span className="absolute bottom-6 left-[15px] top-6 w-px bg-line" aria-hidden />
        {RUNGS.map((r, i) => (
          <Reveal key={r.title} delay={i * 0.05} className="relative flex gap-5">
            <span className={`relative z-10 mt-4 grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full font-mono text-xs ${
              r.status === "live" || r.status === "v2" ? "bg-ok text-paper" : r.status === "built" ? "bg-surface text-cascade ring-2 ring-cascade" : "bg-surface text-muted ring-1 ring-line"}`}>{i}</span>
            <div className={`flex flex-1 flex-col gap-1.5 rounded-2xl px-5 py-4 ${r.status === "live" || r.status === "v2" ? "bg-surface shadow-[inset_0_0_0_2px_var(--ok)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--line)]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-semibold">{r.title}</span>
                <span className={`rounded-full px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
              </div>
              <span className="font-mono text-[11px] text-muted">{r.model}</span>
              <p className="text-sm leading-relaxed text-ink-2">{r.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>
      <Reveal className="md:ml-[25%]">
        <p className="text-sm text-muted">Steps 0–3 are live on Sepolia; step 4 is built and tested; step 5 waits on your answers below.</p>
      </Reveal>
    </section>
  );
}

// ── the ask ─────────────────────────────────────────────────────────────

const QUESTIONS = [
  ["Holder discovery", "EAC exposes holder counts, not identities, so the registry names its team with a pointer and reads the parent's grant live. Is that the right shape — or would you rather expose holder enumeration?"],
  ["The _getRoles hook", "Is overriding it the intended use for inheriting roles from another contract? It keeps hasRoles() truthful, at ≈2,300 gas per lookup — native owners included."],
  ["Worth it over root grants?", "Root grants already cover future names inside one registry. Cascade's case is one roster shared by many registries, and team admins separate from namespace admins. Does that match a need you see?"],
  ["The team's own role on devops", "The team contract also holds SET_SUBREGISTRY on devops itself. TeamRegistry can't use it — should a standard require team contracts to be this narrow?"],
];

export function Ask() {
  return (
    <section className="flex flex-col gap-14">
      <Chapter id="ask" n="" kicker="The ask" title={<>What we&apos;d like <span className="italic text-cascade">from the ENS team.</span></>}
        lede="This is an MVP to test a direction, not a finished proposal. Four questions decide whether it's worth taking further." />
      <ol className="grid gap-px overflow-hidden rounded-3xl bg-line md:grid-cols-2">
        {QUESTIONS.map(([t, d], i) => (
          <Reveal key={t} delay={(i % 2) * 0.08} className="flex flex-col gap-3 bg-paper p-7">
            <span className="display text-5xl text-cascade">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="text-lg font-semibold">{t}</h3>
            <p className="text-sm leading-relaxed text-ink-2">{d}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal className="grid gap-6 md:grid-cols-12">
        <span className="label md:col-span-3">If it&apos;s useful, next could be</span>
        <ul className="flex flex-col gap-3 text-sm text-ink-2 md:col-span-9 md:flex-row md:gap-10">
          <li className="md:max-w-56"><span className="font-medium text-ink">Your wallet as the outsider</span> — visitors join and leave with their own address.</li>
          <li className="md:max-w-56"><span className="font-medium text-ink">Deeper trees</span> — chaining registries level by level, or a standard way to express it.</li>
          <li className="md:max-w-56"><span className="font-medium text-ink">A reference team interface</span> — narrow, audited, with the pointer rules above.</li>
        </ul>
      </Reveal>
    </section>
  );
}
