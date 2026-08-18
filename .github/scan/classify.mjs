/* Wandar engine Layers 1 + 2 — the judgment step.
   Layer 3 (scoring) is deterministic and lives in score.mjs; this file only
   decides PASS/FAIL and rates the five signals.

   Batched 15 posts per request so the engine prompt is amortised, and the
   prompt is cached (identical prefix every call, ~0.1x on reads). */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const EFFORT = process.env.ANTHROPIC_EFFORT || "low";
const BATCH = 15;

const ENGINE = `You apply the Wandar demand engine to travel forum and Reddit posts. Wandar sells qualified leads to LUXURY AFRICAN SAFARI OPERATORS, so the only thing that matters is whether a real person is planning a safari trip an operator could win.

LAYER 1 — the gate. A post PASSES only if all three hold:
(a) Safari context — an African safari or safari-adjacent trip (game viewing, gorilla/chimp trekking, named African parks, camps, lodges, tour operators). Namibia desert circuits and Victoria Falls count when part of a trip an operator would sell.
(b) Personal and forward-looking — the poster (or someone they are arranging for) is going, and the trip has NOT happened yet.
(c) At least one buying signal — destination, dates, budget, group, or urgency.

FAIL, with no exceptions:
- Logistics-only questions: visas, vaccinations, SIM cards, currency/ATMs, tipping, packing, what to wear, airport transfers, car hire, self-drive routes, road conditions, flights, layovers, travel insurance, luggage allowances, plug adapters.
- Trip reports and reviews, however recent ("just back from", "here's our itinerary", a write-up of a completed trip).
- Operator, lodge, or agency marketing; news posts; evergreen resource threads.
- Beach-only or city-only trips with no safari component (Zanzibar/Nungwi/Diani beach stays, Cape Town sightseeing, Stone Town).
- Non-African "safari" (Sri Lanka, Borneo, Nepal/Chitwan, Yellowstone, Lapland husky safaris).
- Posts that explicitly rule a safari out. READ TO THE END — a post can spend ten lines on safari options and close with "Edit: no safaris!".
- Award-flight and points routing questions, even when the trip is a safari.
- EXPIRED demand: the travel date has already passed relative to the post's own date plus today. A February post about a June trip is dead by August.

PASS these, which look marginal but are live demand:
- Already booked but still shopping — comparing camps, asking for better lodges, seeking a second quote, reconsidering an itinerary. The docs are explicit: "Have booked with one operator... looking for a second quote" qualifies.
- Choosing between a safari and a non-safari destination, while the safari is still in play.
- Asking which operator or agent to use, or whether to use one at all.

LAYER 2 — rate five signals as a(bsent) / v(ague) / s(pecific) / x(very specific):
- d Destination: v=continent or region ("Africa"); s=named country or park, including an unresolved choice ("Kenya or Tanzania"); x=multi-location itinerary ("Serengeti + Ngorongoro + Tarangire").
- t Travel dates: v=season, year alone, or a month with no year; s=month+year or a named period+year; x=exact dates or a duration with month+year.
- b Budget: v=qualitative ("luxury", "decent budget", "backpacker"); s=a stated figure; x=a figure with scope ("$20,000 excluding flights").
- g Group size: v=generic ("family", "me and my partner"); s=a number or clear composition ("family of four", "solo", "just me", "honeymoon" = couple); x=a number plus ages or roles.
- u Urgency: v=general planning talk, research phase, decision friction ("wife needs convincing"); s=ready to act or a direct operator ask ("which operator should I contact?", "DM me", "ready to book"); x=a hard deadline or active booking process ("deposits due", "deciding this week", comparison shopping at booking stage).

Absent means the post says nothing about that signal. Do not infer.

Return one object per post, in the order given, using each post's exact id.`;

const SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          pass: { type: "boolean" },
          d: { type: "string", enum: ["a", "v", "s", "x"] },
          t: { type: "string", enum: ["a", "v", "s", "x"] },
          b: { type: "string", enum: ["a", "v", "s", "x"] },
          g: { type: "string", enum: ["a", "v", "s", "x"] },
          u: { type: "string", enum: ["a", "v", "s", "x"] },
          why: { type: "string" },
        },
        required: ["id", "pass", "d", "t", "b", "g", "u", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

function render(posts, today) {
  return `Today is ${today}. Classify these ${posts.length} posts.\n\n` +
    posts.map(p =>
      `### id: ${p.id}\nsource: ${p.source}/${p.origin}\nposted: ${p.post_date}\n` +
      `title: ${p.title}\nbody: ${(p.body || "").replace(/\s+/g, " ").slice(0, 1100)}`
    ).join("\n\n");
}

export async function classify(posts, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const out = [];
  let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // cache_control on the engine prompt: identical prefix on every call,
      // so every batch after the first reads it at ~0.1x.
      system: [{ type: "text", text: ENGINE, cache_control: { type: "ephemeral" } }],
      output_config: { effort: EFFORT, format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: render(batch, today) }],
    });

    if (res.stop_reason === "refusal") {
      console.warn(`  batch ${i / BATCH + 1}: refused (${res.stop_details?.category}) — skipped`);
      continue;
    }
    const text = res.content.find(b => b.type === "text")?.text;
    if (!text) { console.warn(`  batch ${i / BATCH + 1}: empty response — skipped`); continue; }

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { console.warn(`  batch ${i / BATCH + 1}: unparseable JSON — skipped`); continue; }

    out.push(...(parsed.results || []));
    usage.input += res.usage.input_tokens;
    usage.output += res.usage.output_tokens;
    usage.cacheRead += res.usage.cache_read_input_tokens || 0;
    usage.cacheWrite += res.usage.cache_creation_input_tokens || 0;
    console.log(`  classified ${Math.min(i + BATCH, posts.length)}/${posts.length}`);
  }
  return { judgments: out, usage, model: MODEL };
}
