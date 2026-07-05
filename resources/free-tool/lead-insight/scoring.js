/* Lead Insight Generator, Layer 3 deterministic scoring.
 *
 * Pure module: no DOM, no network, no dependencies. The LLM (Layer 2)
 * classifies the five signals; this function turns that classification
 * into the score. Same input always produces the same output, verified
 * against every acceptance test in the brief by
 * tools/lead-insight-tests/scoring.test.mjs.
 *
 * Band selection follows the engine preamble: Specific and Very Specific
 * both count as "specific"; Vague and Absent do not count. Vague signals
 * are therefore invisible to band selection everywhere (they only drive
 * missing-info / qualifying-question copy).
 */

export const STATES = ["absent", "vague", "specific", "very_specific"];

export const TRIP_SIGNALS = ["destination", "travel_dates", "budget", "group_size"];
export const ALL_SIGNALS = [...TRIP_SIGNALS, "urgency"];

export const TIERS = ["very_low", "low", "mid", "high"];

const isCounting = (state) => state === "specific" || state === "very_specific";

function stateOf(signals, key) {
  const entry = signals[key];
  const state = typeof entry === "string" ? entry : entry && entry.state;
  if (!STATES.includes(state)) {
    throw new Error(`Invalid state for signal "${key}": ${state}`);
  }
  return state;
}

/**
 * @param {Record<string, {state: string}|string>} signals, the five signals,
 *   each `{state: "absent"|"vague"|"specific"|"very_specific"}` (or the bare state string).
 * @returns {{score: number, tier: "very_low"|"low"|"mid"|"high", floor: number|null, ceiling: number}}
 */
export function score(signals) {
  const T = TRIP_SIGNALS.filter((key) => isCounting(stateOf(signals, key))).length;
  const urgency = stateOf(signals, "urgency");
  const urgencySpecific = isCounting(urgency);
  const urgencyPresent = urgency !== "absent";
  const S = T + (urgencySpecific ? 1 : 0);

  // All signals vague or absent: never a dead end, fixed 3.0, Very Low.
  if (S === 0) {
    return { score: 3.0, tier: "very_low", floor: null, ceiling: 4.0 };
  }

  let floor;
  let ceiling;
  if (T === 4 && urgencySpecific) {
    floor = 9.0; ceiling = 10.0;
  } else if ((T === 4 && urgency === "vague") || (T === 3 && urgencyPresent)) {
    floor = 8.5; ceiling = 9.0;
  } else if (T >= 3) {
    floor = 8.0; ceiling = 8.5;
  } else if (S >= 2) {
    floor = 6.0; ceiling = 7.5;
  } else {
    floor = 4.0; ceiling = 5.5;
  }

  const tier = floor >= 8.0 ? "high" : floor === 6.0 ? "mid" : "low";
  return { score: Math.min(floor + 0.5 * S, ceiling), tier, floor, ceiling };
}
