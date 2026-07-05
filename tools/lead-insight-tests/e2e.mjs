/* End-to-end acceptance run: real prompt → real model → deterministic scorer.
 *
 *   ANTHROPIC_API_KEY=... node tools/lead-insight-tests/e2e.mjs
 *
 * Sends each of the 10 acceptance enquiry texts through the exact system
 * prompt + schema the serverless function uses, pipes the classification
 * through scoring.js, and asserts the exact expected score + tier.
 *
 * If a case fails, tune the prompt's few-shots in classify.mjs — never the
 * scorer (Layer 3 is pinned by scoring.test.mjs).
 */

import { classifyEnquiry } from "../../netlify/functions/classify.mjs";
import { score } from "../../resources/free-tool/lead-insight/scoring.js";
import { ACCEPTANCE } from "./fixtures.mjs";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(2);
}

let failures = 0;

for (const fx of ACCEPTANCE) {
  let classification;
  try {
    classification = await classifyEnquiry(fx.enquiry, apiKey);
  } catch (err) {
    failures++;
    console.log(`✖ ${fx.name} — API call failed (${err.message})`);
    continue;
  }

  const result = score(classification.signals);
  const ok = result.score === fx.score && result.tier === fx.tier;
  if (ok) {
    console.log(`✔ ${fx.name} — ${result.score} ${result.tier}`);
  } else {
    failures++;
    console.log(
      `✖ ${fx.name} — expected ${fx.score} ${fx.tier}, got ${result.score} ${result.tier}`
    );
    const states = Object.fromEntries(
      Object.entries(classification.signals).map(([k, v]) => [k, v.state])
    );
    const expected = Object.fromEntries(
      Object.entries(fx.signals).map(([k, v]) => [k, typeof v === "string" ? v : v.state])
    );
    console.log(`   model classified: ${JSON.stringify(states)}`);
    console.log(`   fixture expected: ${JSON.stringify(expected)}`);
  }
}

console.log(failures === 0 ? "\nAll 10 acceptance tests pass end-to-end." : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
