"use client";

import { motion } from "framer-motion";

import { Context } from "../cascade/Context";
import { Chapter, EASE, Reveal } from "./Reveal";

// ── 00 · hero ────────────────────────────────────────────────────────────────

const LINE_1 = ["Roles", "for", "teams,"];
const LINE_2 = ["not", "just", "addresses."];

function Word({ w, i, accent }: { w: string; i: number; accent?: boolean }) {
  return (
    <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
      <motion.span className={`inline-block ${accent ? "italic text-cascade" : ""}`} initial={{ y: "105%" }} animate={{ y: 0 }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.15 + i * 0.07 }}>{w}</motion.span>
    </span>
  );
}

export function Hero({ live }: { live: { member?: boolean; grant?: boolean; subnames: number } }) {
  return (
    <section className="relative grid min-h-[calc(100svh-3.5rem)] content-between gap-16 pb-10 pt-16 md:pt-24">
      <div className="flex flex-col gap-10">
        <motion.span className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.05 }}>
          <span className="text-cascade">MVP</span> · a relationship layer for ENSv2 Enhanced Access Control
        </motion.span>
        <h1 className="display text-[clamp(3.6rem,11.5vw,11rem)]">
          <span className="block">{LINE_1.map((w, i) => <span key={w}><Word w={w} i={i} accent={w === "teams,"} />{i < LINE_1.length - 1 ? " " : ""}</span>)}</span>
          <span className="block md:pl-[8.33%]">{LINE_2.map((w, i) => <span key={w}><Word w={w} i={i + 3} />{i < LINE_2.length - 1 ? " " : ""}</span>)}</span>
        </h1>
        <motion.div className="grid gap-8 md:grid-cols-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.7 }}>
          <p className="text-lg leading-relaxed text-ink-2 md:col-span-6 md:col-start-5 lg:col-span-5 lg:col-start-6">
            ENSv2&apos;s access control grants roles to addresses, one name at a time. <span className="text-ink">Cascade adds one relationship — team membership — inside EAC&apos;s own role lookup.</span> Nothing EAC does today is replaced.
          </p>
          <div className="flex flex-wrap items-start gap-3 md:col-span-3 md:col-start-10 md:flex-col lg:col-start-11 lg:col-span-2">
            <a href="#demo" className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:gap-3">
              Try it live <span aria-hidden>↓</span>
            </a>
            <a href="#ask" className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-ink ring-1 ring-line transition hover:ring-ink">What we&apos;re asking</a>
          </div>
        </motion.div>
      </div>

      <motion.dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6 md:grid-cols-5"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 1 }}>
        {[
          ["1", "contract added — a PermissionedRegistry"],
          ["0", "changes to EAC storage or grant rules"],
          ["17", "Foundry tests, incl. attacks & edge cases"],
          [live.grant === undefined ? "…" : live.grant ? "live" : "off", "parent grant to the team, read now"],
          [live.member === undefined ? "…" : live.member ? "in" : "out", "the demo outsider, read now"],
        ].map(([k, v]) => (
          <div key={v} className="flex flex-col gap-1">
            <dt className="display text-4xl text-ink">{k}</dt>
            <dd className="text-xs leading-snug text-muted">{v}</dd>
          </div>
        ))}
      </motion.dl>
    </section>
  );
}

// ── 01 · the problem ─────────────────────────────────────────────────────────

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
      <Chapter id="gap" n="01" kicker="The gap" title={<>Today, every permission <span className="italic text-muted">is an address.</span></>}
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

// ── 02 · the idea ────────────────────────────────────────────────────────────

export function Idea() {
  return (
    <section className="flex flex-col gap-14">
      <Chapter id="idea" n="02" kicker="The idea" title={<>Add the relationship. <span className="italic text-muted">Keep everything else.</span></>} />
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-inv px-6 py-12 text-inv-fg sm:px-12 md:py-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-inv-accent/20 blur-3xl" aria-hidden />
          <p className="label !text-inv-muted">Cascade&apos;s role lookup, for any name under devops</p>
          <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-5">
            <span className="display text-[clamp(2rem,4.2vw,3.6rem)]">roles</span>
            <span className="display text-[clamp(2rem,4.2vw,3.6rem)] text-inv-muted">=</span>
            <span className="flex flex-col gap-2">
              <span className="display text-[clamp(2rem,4.2vw,3.6rem)]">EAC&apos;s grants</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-inv-muted">unchanged · stored · granted · revoked as today</span>
            </span>
            <span className="display text-[clamp(2rem,4.2vw,3.6rem)] text-inv-muted">∪</span>
            <span className="flex flex-col gap-2">
              <span className="display text-[clamp(2rem,4.2vw,3.6rem)] italic text-inv-accent">the team&apos;s grant</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-inv-accent">new · if you&apos;re a member · one hop · read live</span>
            </span>
          </div>
        </div>
      </Reveal>
      <Reveal className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-cascade pl-4">
        <span className="label !text-cascade">MVP scope</span>
        <span className="text-sm text-ink-2">One hop and one team per registry — deliberately, to test the rule itself. The full relationship model is the <a href="#roadmap" className="underline decoration-cascade underline-offset-4 hover:text-ink">roadmap</a>.</span>
      </Reveal>
      <div className="grid gap-8 md:grid-cols-3">
        {[
          ["Members act as themselves", "No proxy contract in the middle. Each member signs with their own address, and EAC's checks see them."],
          ["One roster, any registry", "The team is a single EAC-managed contract. Every registry that grants it a role reads the same roster."],
          ["Revoke once, everywhere", "Leaving the team removes access from every name at once — there is nothing stored per name to clean up."],
        ].map(([t, d], i) => (
          <Reveal key={t} delay={i * 0.08} className="border-t border-ink pt-4">
            <h3 className="text-base font-semibold">{t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── 04 · how it fits ─────────────────────────────────────────────────────────

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
      <Chapter id="fit" n="04" kicker="How it fits" title={<>One hook. <span className="italic text-muted">Every other layer is stock ENSv2.</span></>}
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

// ── 05 · roadmap: from the MVP rule to full ReBAC ────────────────────────────

type Rung = { status: "live" | "next" | "later"; title: string; body: string; model: string };
const RUNGS: Rung[] = [
  { status: "live", title: "One hop", model: "parent → team → member",
    body: "A grant on devops reaches every subname under it, through one team. What the demo above runs." },
  { status: "next", title: "Many teams per role", model: "several relation tuples per name",
    body: "More than one team on the same parent, each with its own role — devops can edit, security can revoke." },
  { status: "next", title: "Teams of teams", model: "nested groups, bounded depth",
    body: "A team can contain other teams, so an org's structure maps directly. Depth- and gas-bounded, failing closed." },
  { status: "next", title: "Multi-hop names", model: "inheritance up the name tree, bounded depth",
    body: "A grant on acme-corp.eth can reach svc.devops.acme-corp.eth, registry by registry, with a hard depth cap." },
  { status: "next", title: "Bring your own roster", model: "external membership sources",
    body: "An existing on-chain roster — a Hats role, a Safe's owners — becomes the team through the same isMember() interface." },
  { status: "later", title: "Who-can-access queries, resolver records, agent fleets", model: "reverse lookups · a second mechanism · the flagship use case",
    body: "Answering “who can edit this name?” via events and an indexer; record-level rights, which need your input because resolver permissions aren't organised by parent name; and agent fleets as the use case." },
];
const STATUS: Record<Rung["status"], { label: string; cls: string }> = {
  live: { label: "Live · MVP", cls: "bg-ok-soft text-ok" },
  next: { label: "Next · this hackathon", cls: "bg-cascade-soft text-cascade" },
  later: { label: "After your feedback", cls: "bg-sunken text-ink-2" },
};

export function Roadmap() {
  return (
    <section className="flex flex-col gap-14">
      <Chapter id="roadmap" n="05" kicker="Roadmap" title={<>From one hop <span className="italic text-muted">to full relationship-based access.</span></>}
        lede="The MVP proves the rule works inside EAC. Each next step widens the relationship — never the trust: native grants stay untouched, admin and root roles are never inherited, every lookup is bounded and fails closed." />
      <ol className="relative flex flex-col gap-3 md:ml-[25%]">
        <span className="absolute bottom-6 left-[15px] top-6 w-px bg-line" aria-hidden />
        {RUNGS.map((r, i) => (
          <Reveal key={r.title} delay={i * 0.05} className="relative flex gap-5">
            <span className={`relative z-10 mt-4 grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full font-mono text-xs ${
              r.status === "live" ? "bg-ok text-paper" : r.status === "next" ? "bg-surface text-cascade ring-2 ring-cascade" : "bg-surface text-muted ring-1 ring-line"}`}>{i}</span>
            <div className={`flex flex-1 flex-col gap-1.5 rounded-2xl px-5 py-4 ${r.status === "live" ? "bg-surface shadow-[inset_0_0_0_2px_var(--ok)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--line)]"}`}>
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
        <p className="text-sm text-muted">Planned, not built. Only step 0 exists today; the order of the rest can change with your answers below.</p>
      </Reveal>
    </section>
  );
}

// ── 06 · the ask ─────────────────────────────────────────────────────────────

const QUESTIONS = [
  ["Holder discovery", "EAC exposes holder counts, not identities, so the registry names its team with a pointer and reads the parent's grant live. Is that the right shape — or would you rather expose holder enumeration?"],
  ["The _getRoles hook", "Is overriding it the intended use for inheriting roles from another contract? It keeps hasRoles() truthful, at ≈2,300 gas per lookup — native owners included."],
  ["Worth it over root grants?", "Root grants already cover future names inside one registry. Cascade's case is one roster shared by many registries, and team admins separate from namespace admins. Does that match a need you see?"],
  ["The team's own role on devops", "The team contract also holds SET_SUBREGISTRY on devops itself. TeamRegistry can't use it — should a standard require team contracts to be this narrow?"],
];

export function Ask() {
  return (
    <section className="flex flex-col gap-14">
      <Chapter id="ask" n="06" kicker="The ask" title={<>What we&apos;d like <span className="italic text-cascade">from the ENS team.</span></>}
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

// ── 07 · fine print ──────────────────────────────────────────────────────────

export function FinePrint() {
  return (
    <section className="flex flex-col gap-12">
      <Chapter n="07" kicker="Fine print" title={<>Limits, <span className="italic text-muted">named before you find them.</span></>} />
      <Reveal><Context /></Reveal>
    </section>
  );
}
