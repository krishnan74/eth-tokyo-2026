import type { ActionName, Kind } from "@/lib/cascade/hooks";

/** Every action, with what it does stated before it runs. */
export const ACTIONS: Record<ActionName, { short: string; label: string; consequence: string; kind: Kind; logTitle: string }> = {
  create: { short: "New subname", label: "Create a new subname", kind: "native", logTitle: "Create a new subname under devops",
    consequence: "Registers svc-xxxx.devops.acme-corp.eth. Nobody is granted anything on it." },
  write: { short: "Write", label: "Write as the outsider", kind: "cascade", logTitle: "Outsider writes to the subname (setSubregistry)",
    consequence: "The outsider tries to repoint this subname. Whether it lands depends only on the team relationship." },
  grant: { short: "Add to team", label: "Add the outsider to the team", kind: "native", logTitle: "Add outsider to TeamRegistry (MEMBER)",
    consequence: "One ordinary EAC grant on TeamRegistry. Nothing is written to any subname." },
  revoke: { short: "Remove from team", label: "Remove the outsider from the team", kind: "native", logTitle: "Remove outsider from TeamRegistry",
    consequence: "One ordinary EAC revoke. No per-subname cleanup, because nothing was stored per subname." },
  reset: { short: "Reset demo", label: "Reset the demo", kind: "native", logTitle: "Reset: remove the outsider from the team",
    consequence: "Removes the outsider from the team if a previous run left them in, so the demo starts clean." },
  hijack: { short: "Hijack pointer", label: "Point Cascade at an attacker's contract", kind: "cascade", logTitle: "Outsider tries setTeam(AlwaysTrueTeam)",
    consequence: "The outsider tries to swap the team for a contract that says everyone is a member. It should be refused." },
};
