"use client";

import { AnimatePresence, motion } from "framer-motion";

import { TEAM_NAME } from "@/lib/cascade/contracts";

import { Card, InfoTip, KindTag } from "./primitives";

type Props = {
  member?: boolean;
  parentGrantsTeam?: boolean;
  access?: boolean;
  target: string | null;
};

function Node({ name, role, kind }: { name: string; role: string; kind?: "native" | "cascade" }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-rule bg-sunken px-3 py-2.5 md:max-w-[15rem]">
      <span className="break-all font-mono text-sm font-medium">{name}</span>
      <span className="text-xs leading-snug text-muted">{role}</span>
      {kind && <span><KindTag kind={kind} /></span>}
    </div>
  );
}

/** One relationship. A dashed gray line is always there; a solid colored line draws over it when true. */
function Edge({ on, label, tip }: { on: boolean | undefined; label: string; tip: string }) {
  const known = on !== undefined;
  return (
    <div className="flex shrink-0 flex-row items-center gap-2 py-1 md:w-44 md:flex-col md:items-stretch md:gap-1 md:py-0">
      <div className="relative ml-6 h-10 w-0 md:ml-0 md:h-0 md:w-full">
        {/* resting state: relationship absent */}
        <div className="absolute inset-0 border-l-2 border-dashed border-rule md:border-l-0 md:border-t-2" />
        {/* relationship present */}
        <motion.div
          className="absolute inset-0 origin-top border-l-[3px] border-ok md:origin-left md:border-l-0 md:border-t-[3px]"
          initial={false}
          animate={{ scaleX: on ? 1 : 0, scaleY: on ? 1 : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          style={{ originX: 0, originY: 0 }}
        />
        <span className={`absolute -bottom-[7px] -left-[6px] text-sm md:-right-1 md:-top-[11px] md:bottom-auto md:left-auto ${on ? "text-ok" : "text-rule"}`}>
          <span className="md:hidden">▼</span><span className="hidden md:inline">▶</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 md:justify-center">
        <AnimatePresence mode="wait">
          <motion.span key={String(on)} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`text-xs font-medium ${!known ? "text-muted" : on ? "text-ok" : "text-muted line-through decoration-rule"}`}>
            {label}
          </motion.span>
        </AnimatePresence>
        <InfoTip text={tip} label={`What does "${label}" mean?`} />
      </div>
    </div>
  );
}

export function RelationshipGraph({ member, parentGrantsTeam, access, target }: Props) {
  return (
    <Card eyebrow="Why access comes out the way it does" title="The relationship chain">
      <div className="flex flex-col items-stretch md:flex-row md:items-center">
        <Node name="outsider" role="the address trying to write" />
        <Edge on={member} label="member of"
          tip="An ordinary EAC role (MEMBER) on TeamRegistry, granted and revoked by the team's admins. Native EAC — nothing new about this link." />
        <Node name="TeamRegistry" role="the team roster, a plain EAC contract" />
        <Edge on={parentGrantsTeam} label="holds role on"
          tip="An ordinary EAC grant: the parent registry gives TeamRegistry ROLE_SET_SUBREGISTRY on devops. Native EAC — one grantRoles call, nothing new." />
        <Node name={TEAM_NAME} role="the parent name; its subnames live in CascadeSubregistry" />
      </div>

      {/* The computed part — the only thing Cascade adds. */}
      <motion.div
        className="mt-4 rounded-md border-2 px-4 py-3"
        initial={false}
        animate={{
          borderColor: access === undefined ? "var(--rule)" : access ? "var(--ok)" : "var(--bad)",
          backgroundColor: access === undefined ? "var(--sunken)" : access ? "var(--ok-soft)" : "var(--bad-soft)",
        }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <KindTag kind="cascade" />
          <span className="text-sm">
            computed access for <span className="font-mono">outsider</span> on{" "}
            <span className="font-mono font-medium underline decoration-2 underline-offset-2">{target ? `${target}.${TEAM_NAME}` : "(no subname yet)"}</span>
          </span>
          <AnimatePresence mode="wait">
            <motion.span key={String(access)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className={`font-mono text-sm font-semibold ${access === undefined ? "text-muted" : access ? "text-ok" : "text-bad"}`}>
              {access === undefined ? (target ? "reading…" : "—") : access ? "✓ allowed" : "✗ denied"}
            </motion.span>
          </AnimatePresence>
          <InfoTip label="What does Cascade compute?"
            text="The only new part. CascadeSubregistry overrides EAC's _getRoles hook: on any subname, an account also holds the roles the parent grants TeamRegistry — if the account is a member. Read live on every check; nothing is copied onto the subname." />
        </div>
        <p className="mt-1.5 text-xs text-muted">Both links above must be solid. Read live from the stock <span className="font-mono">hasRoles()</span> view, which agrees with writes because the logic sits in the hook.</p>
      </motion.div>

      <p className="mt-3 text-sm font-medium">
        Access to any subname under <span className="font-mono">devops</span> is computed from this chain — not stored per subname.
      </p>
    </Card>
  );
}
