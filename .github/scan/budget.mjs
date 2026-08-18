/* Apify budget guard.

   Makes overspending structurally impossible rather than a matter of estimates
   being right: before each run we read what's actually been spent this cycle
   and size the Reddit item cap from what's left. If the month is nearly gone,
   the run degrades (TripAdvisor only, then skip) instead of blowing the cap.

   Measured unit costs, 2026-08-11 scan:
     TA index page   $0.00074   TA thread page $0.00078   Reddit item $0.00407 */

export const COST = { TA_PAGE: 0.0008, RD_ITEM: 0.00407 };

const CEILING = Number(process.env.APIFY_MONTHLY_CEILING_USD ?? 5);
const RESERVE = 0.5;   // never spend the last $0.50 — leaves room for a failed run
const FLOOR   = 0.2;   // below this, skip the run entirely

export async function getSpend(token) {
  const r = await fetch(`https://api.apify.com/v2/users/me/limits?token=${token}`);
  if (!r.ok) throw new Error(`Apify limits ${r.status}: ${await r.text()}`);
  const d = (await r.json()).data;
  return {
    spent: d.current.monthlyUsageUsd,
    planCap: d.limits.maxMonthlyUsageUsd,
    cycleEnd: d.monthlyUsageCycle.endAt,
  };
}

/**
 * @returns {{skip:boolean, reason?:string, taOnly:boolean, rdMaxItems:number,
 *            remaining:number, usable:number}}
 */
export function plan({ spent }) {
  // The guard enforces OUR ceiling, not the plan's — a $29 Starter plan still
  // runs to a $5 budget if that's what APIFY_MONTHLY_CEILING_USD says.
  const remaining = Math.max(0, CEILING - spent);
  const usable = Math.max(0, remaining - RESERVE);

  if (remaining < FLOOR) {
    return { skip: true, reason: `only $${remaining.toFixed(2)} left of $${CEILING} — skipping`,
             taOnly: false, rdMaxItems: 0, remaining, usable };
  }
  // TripAdvisor is ~$0.15-0.25/run; if that's all we can afford, run it alone.
  if (usable < 0.3) {
    return { skip: false, taOnly: true, rdMaxItems: 0, remaining, usable };
  }
  // Give Reddit 75% of what's usable this run; cap at 400 so one run can never
  // eat a whole month even if the cycle just reset.
  const rdMaxItems = Math.min(400, Math.floor((usable * 0.75) / COST.RD_ITEM));
  return { skip: false, taOnly: false, rdMaxItems, remaining, usable };
}

export function describe(p, s) {
  if (p.skip) return `BUDGET STOP: ${p.reason}`;
  const head = `budget: $${s.spent.toFixed(2)} spent of $${CEILING} ceiling, $${p.remaining.toFixed(2)} left`;
  return p.taOnly
    ? `${head} -> TripAdvisor only (too little left for Reddit)`
    : `${head} -> Reddit capped at ${p.rdMaxItems} items (~$${(p.rdMaxItems * COST.RD_ITEM).toFixed(2)})`;
}
