import { NextResponse } from "next/server";

import { clientIp, limit } from "@/lib/cascade/ratelimit";
import { WRITES_ENABLED, actors, sentByDemo } from "@/lib/cascade/server";
import { traceTx } from "@/lib/cascade/trace";

export const dynamic = "force-dynamic";
// `cast run` re-executes the block; on a free RPC that can take a while.
export const maxDuration = 120;

/** The real execution trace of a just-mined demo transaction. Local-only, like the demo's writes. */
export async function GET(req: Request) {
  // Replays run `cast` against the RPC; like writes, only on a local server.
  if (!WRITES_ENABLED) return NextResponse.json({ error: "Traces are only available when running the UI locally." }, { status: 403 });
  const url = new URL(req.url);
  const hash = url.searchParams.get("hash") ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return NextResponse.json({ error: "bad hash" }, { status: 400 });
  const limited = limit("trace", clientIp(req));
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  // Only the demo's own transactions: a public server should not replay arbitrary ones on request.
  if (!(await sentByDemo(hash as `0x${string}`))) return NextResponse.json({ error: "Only transactions sent by this demo can be traced here." }, { status: 403 });
  const labels = (url.searchParams.get("labels") ?? "").split(",").filter((l) => /^svc-[0-9a-z]{1,16}$/.test(l)).slice(0, 12);
  const a = actors();
  const people: Record<string, string> = {};
  if (a.outsider) people[a.outsider] = "outsider";
  if (a.operator) people[a.operator] = "operator";
  return NextResponse.json(await traceTx(hash, people, labels));
}
