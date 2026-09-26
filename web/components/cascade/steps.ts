import type { ActionName, Kind } from "@/lib/cascade/hooks";

/** The actions, each with its consequence stated before it is clicked. */
export const ACTIONS: Record<ActionName, { label: string; consequence: string; kind: Kind; logTitle: string }> = {
  create: { label: "Create a new subname", kind: "native", logTitle: "Create a new subname under devops",
    consequence: "Creates svc-xxxx.devops.acme-corp.eth. Nobody will have any special access to it yet." },
  write: { label: "Attempt a write as outsider", kind: "cascade", logTitle: "Outsider writes to the subname (setSubregistry)",
    consequence: "Tries to repoint the newest subname's subregistry. Whether it lands depends only on the chain above." },
  grant: { label: "Add outsider to TeamRegistry", kind: "native", logTitle: "Add outsider to TeamRegistry (MEMBER)",
    consequence: "An ordinary EAC role grant. Nothing Cascade-specific about this step." },
  revoke: { label: "Remove outsider from TeamRegistry", kind: "native", logTitle: "Remove outsider from TeamRegistry",
    consequence: "Another ordinary EAC call. The next write should fail again immediately." },
  hijack: { label: "Redirect the team pointer without permission", kind: "cascade", logTitle: "Outsider tries setTeam(AlwaysTrueTeam)",
    consequence: "Points Cascade at an attacker's contract that says everyone is a member. This should fail. If it doesn't, something's wrong." },
};

export type Step = { action: ActionName; title: string; why: string; expect?: "success" | "reverted" };

/** The guided order. The write button is used three times: that repetition is the demonstration. */
export const STEPS: Step[] = [
  { action: "create", title: "Create a fresh subname",
    why: "A name that didn't exist a moment ago. Nobody gets granted anything on it, so any access the outsider later has can't come from a grant on this name." },
  { action: "write", expect: "reverted", title: "The outsider tries to write — and fails",
    why: "The outsider isn't on the team yet. Watch the three checks: the parent does grant the team, but the membership check says no." },
  { action: "grant", title: "Add the outsider to the team",
    why: "One ordinary EAC transaction on TeamRegistry. Watch the 'member of' link in the chain turn solid. Nothing is written to the subname." },
  { action: "write", expect: "success", title: "The same write again — now it lands",
    why: "Same subname, same address, same call. Only the relationship above changed. Compare 'Now' and 'Before' in the checks: only step 3 flipped." },
  { action: "revoke", title: "Remove the outsider from the team",
    why: "Another ordinary EAC call. There is no per-subname cleanup to do, because nothing was ever stored per subname." },
  { action: "write", expect: "reverted", title: "The same write a third time — it fails immediately",
    why: "No delay, nothing cached: access is computed from the chain on every check." },
  { action: "hijack", expect: "reverted", title: "Try to hijack the mechanism",
    why: "The obvious attack: point Cascade at a contract that says everyone is a member. Changing the pointer needs ROLE_SET_TEAM, which the outsider doesn't hold." },
];
