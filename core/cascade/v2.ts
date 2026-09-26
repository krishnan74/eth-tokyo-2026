// The cascade demo's names and roles, shared by the web app. The tree is orbit-dao.eth › protocol › vault,
// oracle, bridge (scripts/setup-v2.ts --tree orbit); addresses come from generated-v2.ts (npm run gen).
export { SEPOLIA_V2, CASCADE_V2_ABI, NESTED_TEAM_ABI } from "./generated-v2";

export const ORG_V2 = "orbit-dao";
export const FOLDER_V2 = "protocol";
export const FILES_V2 = ["vault", "oracle", "bridge"] as const;
export const FIRST_FILE_V2 = FILES_V2[0];
/** Team names are UI labels only: the contracts store no names. */
export const TEAMS_V2 = { dev: "core-devs", sec: "security-council", sre: "auditors" } as const;
/** Members' own ENS names in the org (registered by setup:v2): alex → the hosted demo's outsider, alex-dev → the local one. */
export const MEMBER_LABELS_V2 = ["alex", "alex-dev"] as const;
export const ROLE_SET_RESOLVER = 1n << 24n;
