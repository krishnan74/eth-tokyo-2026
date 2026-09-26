// Server-only: best-effort abuse limits for the hosted demo. In-memory and per server instance, so a
// determined visitor could exceed them across instances; the hard limit is the hosted operator's ETH
// budget (see `runAction`'s balance guard). Off for a local dev server.

const ENABLED = process.env.NODE_ENV === "production" && process.env.CASCADE_RATE_LIMIT !== "0";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const LIMITS = {
  action: { perIp: Number(process.env.CASCADE_ACTIONS_PER_HOUR ?? 20), window: HOUR },
  trace: { perIp: Number(process.env.CASCADE_TRACES_PER_HOUR ?? 60), window: HOUR },
};
const DAILY_ACTIONS = Number(process.env.CASCADE_ACTIONS_PER_DAY ?? 300);

const hits = new Map<string, number[]>();
let daily: number[] = [];

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Records one request; returns a message when it is over a limit, or null when it may proceed. */
export function limit(kind: keyof typeof LIMITS, ip: string): string | null {
  if (!ENABLED) return null;
  const now = Date.now();
  const { perIp, window } = LIMITS[kind];
  const key = `${kind}:${ip}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < window);
  if (recent.length >= perIp) {
    hits.set(key, recent);
    const wait = Math.ceil((window - (now - recent[0])) / 60_000);
    return `Rate limit: ${perIp} ${kind === "action" ? "transactions" : "traces"} per hour from one visitor. Try again in ~${wait} min, or run the demo locally.`;
  }
  if (kind === "action") {
    daily = daily.filter((t) => now - t < DAY);
    if (daily.length >= DAILY_ACTIONS) return "The hosted demo has reached today's transaction limit. Try again tomorrow, or run it locally.";
    daily.push(now);
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear(); // bound memory
  return null;
}
