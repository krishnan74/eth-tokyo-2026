import { NextResponse } from "next/server";

import { actors } from "@/lib/cascade/server";
import { traceTx } from "@/lib/cascade/trace";

export const dynamic = "force-dynamic";

/** The real execution trace of a just-mined demo transaction. Local-only, like the demo's writes. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const hash = url.searchParams.get("hash") ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return NextResponse.json({ error: "bad hash" }, { status: 400 });
  const labels = (url.searchParams.get("labels") ?? "").split(",").filter((l) => /^svc-[0-9a-z]{1,16}$/.test(l)).slice(0, 12);
  const a = actors();
  const people: Record<string, string> = {};
  if (a.outsider) people[a.outsider] = "outsider";
  if (a.operator) people[a.operator] = "operator";
  return NextResponse.json(await traceTx(hash, people, labels));
}
