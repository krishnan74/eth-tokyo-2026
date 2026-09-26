"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { costOfAccess } from "@/lib/cascade/explain";

const LIMITS: { title: string; summary: string; detail: string }[] = [
  { title: "Bounded by design", summary: "Up to 4 teams per folder, 3 folders deep, 4 sub-teams, 3 nesting levels.",
    detail: "Every lookup is capped so the worst case is known (~553k gas with 4 misbehaving teams at depth 3). Sharing only ever adds access: a subfolder can't opt out of a grant made above it — like Google shared drives. The one-folder version (the other tab) is one hop, one team." },
  { title: "The pointer is a trust anchor", summary: "Whoever holds ROLE_SET_TEAM chooses the team contract.",
    detail: "Changing the pointer needs ROLE_SET_TEAM; the address must be a contract declaring the team interface through ERC-165, and every change emits TeamPointerUpdated(old, new, by). A contract can lie about ERC-165, so the role holder is trusted — as with any namespace admin. The hijack step shows an outsider refused." },
  { title: "A compromised team", summary: "Members get exactly the parent's grant, nothing more.",
    detail: "A rogue team admin can add members, who can then repoint subnames of devops — and control what sits beneath them — but cannot register, grant, or touch devops itself. One revoke of the parent's grant cuts off every member. A team contract that reverts, loops or returns garbage fails closed; native owners are unaffected." },
  { title: "Small teams", summary: "At most 15 members per role.",
    detail: "TeamRegistry is ordinary EAC, so it inherits EAC's cap of 15 accounts per role. It suits a team, not an org chart." },
  { title: "Parent re-issue — resolved", summary: "Re-registering devops ends the team's authority.",
    detail: "The parent's grant is read live from devops's current registration: unregister, expiry or re-registration ends it, as with native grants (terminal demo step 8, tests). A transfer keeps it, as stock ENSv2 does for every delegate; the new owner can revoke it in one call." },
  { title: "What it costs", summary: "Owners pay nothing extra; members pay for the folders walked.",
    detail: "Writes check the caller's own roles first and stop as soon as the role is covered, asking only teams whose grant could help. On Sepolia: a member edit via the folder itself ≈97.7k gas (the one-folder version: ≈91.9k), via the folder above ≈138k, an owner's edit ≈37k. Views (hasRoles) still compute the full answer." },
  { title: "explain() skips expiry", summary: "It reports roles only.",
    detail: "The write path rejects an expired name before checking roles; explain() does not check expiry." },
  { title: "Beta network, a shared demo account", summary: "ENSv2 beta on Sepolia; every visitor drives the same outsider.",
    detail: "This is the ENSv2 beta deployment, not production ENS. The hosted demo signs on its server with dedicated keys that can only create files, move the outsider between groups and flip the cascade switch — they can't touch the names or their grants. Rate-limited, with a capped test-ETH budget. Not audited." },
];

function Limit({ l }: { l: (typeof LIMITS)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start justify-between gap-4 py-3 text-left">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{l.title}</span>
          <span className="text-sm text-muted">{l.summary}</span>
        </span>
        <span className={`mt-0.5 text-muted transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pb-3 text-sm leading-relaxed text-ink-2">{l.detail}</motion.p>
        )}
      </AnimatePresence>
    </li>
  );
}

export function Context() {
  const c = costOfAccess();
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section>
        <h2 className="mb-1 text-base font-semibold">Limits and trust assumptions</h2>
        <p className="mb-3 text-sm text-muted">Stated up front, so nobody has to find them.</p>
        <ul className="grid gap-x-8 sm:grid-cols-2">{LIMITS.map((l) => <Limit key={l.title} l={l} />)}</ul>
      </section>
      <section>
        <h2 className="mb-1 text-base font-semibold">The workarounds, in numbers</h2>
        <p className="mb-4 text-sm text-muted">A team of {c.teamSize}, {c.subnames} subnames per registry, across {c.registries} registries.</p>
        <div className="flex flex-col gap-2">
          {c.rows.map((r) => (
            <div key={r.approach} className={`rounded-xl px-4 py-3 ${r.cascade ? "bg-cascade-soft" : "bg-surface ring-1 ring-line"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-sm font-medium ${r.cascade ? "text-cascade" : ""}`}>{r.approach}</span>
                <span className="tabular font-mono text-lg font-semibold">{r.grants}</span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-muted">
                <span>{r.churn}</span>
                <span className="shrink-0 font-mono">{r.formula}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-2">{c.note}</p>
      </section>
    </div>
  );
}
