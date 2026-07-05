/* Lead Insight Generator, the single serverless function.
 *
 * Exists only to hold the API key. Receives {enquiry}, returns the Layer 2
 * classification JSON. It does NOT score, Layer 3 runs client-side
 * (resources/free-tool/lead-insight/scoring.js) so the deterministic logic
 * is fully testable offline.
 *
 * Privacy: the enquiry is never logged or stored anywhere. Error paths log
 * status codes only, never content.
 */

const MAX_CHARS = 5000;
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1024;

const ALLOWED_HOSTS = new Set(["getwandar.com", "www.getwandar.com", "localhost", "127.0.0.1"]);

// Best-effort in-memory rate limiting (per warm instance).
const PER_IP_LIMIT = 8; // requests / minute / IP
const GLOBAL_LIMIT = 60; // requests / minute / instance
const WINDOW_MS = 60_000;
const ipHits = new Map();
let globalHits = [];

function allowRequest(ip) {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  if (globalHits.length >= GLOBAL_LIMIT) return false;
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= PER_IP_LIMIT) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  globalHits.push(now);
  if (ipHits.size > 5000) ipHits.clear(); // memory backstop
  return true;
}

function originAllowed(req) {
  const source = req.headers.get("origin") || req.headers.get("referer");
  if (!source) return false;
  try {
    return ALLOWED_HOSTS.has(new URL(source).hostname);
  } catch {
    return false;
  }
}

// The JSON schema the model is forced to return (structured outputs).
export const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["signals", "notable_details"],
  properties: {
    signals: {
      type: "object",
      additionalProperties: false,
      required: ["destination", "travel_dates", "budget", "group_size", "urgency"],
      properties: {
        destination: { $ref: "#/$defs/signal" },
        travel_dates: { $ref: "#/$defs/signal" },
        budget: { $ref: "#/$defs/signal" },
        group_size: { $ref: "#/$defs/signal" },
        urgency: { $ref: "#/$defs/signal" },
      },
    },
    notable_details: { type: "array", items: { type: "string" } },
  },
  $defs: {
    signal: {
      type: "object",
      additionalProperties: false,
      required: ["state", "value"],
      properties: {
        state: { enum: ["absent", "vague", "specific", "very_specific"] },
        value: { type: ["string", "null"] },
      },
    },
  },
};

// Static system prompt (prompt-cache friendly). Grounded verbatim in the
// engine's Layer 2 definitions; the worked examples pin the judgment calls
// the acceptance tests force.
export const SYSTEM_PROMPT = `You classify traveller enquiries received by safari tour operators. For each of five signals (destination, travel_dates, budget, group_size, urgency) output its state (absent, vague, specific, or very_specific) and the extracted value: the shortest phrase from the enquiry that carries the signal, or null when absent. Classify only what is written. Never infer details the traveller did not give.

STATE DEFINITIONS

1. destination
- absent: no location mentioned ("destination undecided" with nothing named is absent).
- vague: continent or broad region only ("Africa", "East Africa", "somewhere in southern Africa").
- specific: one or more named countries, parks, or regions, including an unresolved choice between named places ("Kenya or Tanzania, not sure"). A named country alongside a vague region is specific.
- very_specific: multiple named locations forming a circuit or itinerary ("Serengeti and Ngorongoro", "Okavango and Chobe", "Northern Tanzania circuit").

2. travel_dates
- absent: no time reference.
- vague: season, bare year, or a month with no year ("next year", "dry season", "July or August" with no year).
- specific: named month and year, or named period with a year ("September 2026", "Christmas 2026", "Q3 next year").
- very_specific: exact dates or precise duration with month and year ("July 10 to 24 2027", "two weeks in September starting the 5th 2026").

3. budget
- absent: no financial reference.
- vague: qualitative level with no number ("luxury", "high end", "money is no issue", "decent budget").
- specific: a stated total or per-person figure ("$15,000", "$6,000 per person", "around $12,000"). A named nightly lodge rate counts as specific.
- very_specific: figure plus scope ("$20,000 total excluding international flights", "$8,000 per person, two travelling", "$20,000 all inclusive").

4. group_size
- absent: no reference to who is travelling.
- vague: generic group type with no number ("with family", "girls trip", "me and my partner").
- specific: a number or clearly named party ("family of four", "solo", "group of eight", "two of us"). "Just me" is specific. "Honeymoon" alone is specific: it names a party of two.
- very_specific: number plus ages, roles, or composition ("family of four, two adults two kids aged 9 and 12").

5. urgency
- absent: no readiness to act. Pure information questions are absent. General trip statements are absent: "Planning a safari in Tanzania" or "Looking to go on safari" describe the trip, not booking readiness.
- vague: general planning-to-book language ("starting to think about booking", "in the research phase"). Hedged commitment is vague: intent to book undercut by an unresolved blocker ("want to book but wife still needs convincing").
- specific: clear readiness to choose an operator, or a direct operator question ("ready to book, need to pick an operator", "which operators do you recommend?", "inbox me").
- very_specific: hard deadline or commitment action ("deposits due end of month", "down to two operators, deciding this week", "need to book in the next two weeks").

NOTABLE DETAILS
Also extract safari-relevant extras as short phrases (verbatim where possible): occasion (honeymoon, anniversary, birthday), children and their ages, special interests (gorilla trekking, the migration, photography, birding), add-ons (beach extension, Zanzibar), and constraints (mobility, dietary). Return an empty array when there are none. Never invent details.

WORKED EXAMPLES

Enquiry: "Looking to go on safari in July 2027, destination undecided."
{"signals":{"destination":{"state":"absent","value":null},"travel_dates":{"state":"specific","value":"July 2027"},"budget":{"state":"absent","value":null},"group_size":{"state":"absent","value":null},"urgency":{"state":"absent","value":null}},"notable_details":[]}

Enquiry: "Honeymoon safari, thinking Botswana or Zimbabwe, budget around $16,000."
{"signals":{"destination":{"state":"specific","value":"Botswana or Zimbabwe"},"travel_dates":{"state":"absent","value":null},"budget":{"state":"specific","value":"around $16,000"},"group_size":{"state":"specific","value":"honeymoon (party of two)"},"urgency":{"state":"absent","value":null}},"notable_details":["honeymoon"]}

Enquiry: "Tanzania July 2027, $15,000, family of four. Want to book but wife still needs convincing."
{"signals":{"destination":{"state":"specific","value":"Tanzania"},"travel_dates":{"state":"specific","value":"July 2027"},"budget":{"state":"specific","value":"$15,000"},"group_size":{"state":"specific","value":"family of four"},"urgency":{"state":"vague","value":"want to book but wife still needs convincing"}},"notable_details":["family with children"]}

Enquiry: "Family safari somewhere in Africa next year, decent budget."
{"signals":{"destination":{"state":"vague","value":"somewhere in Africa"},"travel_dates":{"state":"vague","value":"next year"},"budget":{"state":"vague","value":"decent budget"},"group_size":{"state":"vague","value":"family"},"urgency":{"state":"absent","value":null}},"notable_details":["family trip"]}`;

/** Calls the Anthropic API with the locked-down request shape. */
export async function classifyEnquiry(enquiry, apiKey, fetchImpl = fetch) {
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: CLASSIFICATION_SCHEMA } },
      messages: [{ role: "user", content: `Enquiry: "${enquiry}"` }],
    }),
  });

  if (!response.ok) {
    const err = new Error(`upstream_${response.status}`);
    err.status = response.status;
    throw err;
  }

  const message = await response.json();
  const text = message.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("upstream_empty");
  return JSON.parse(text);
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async function handler(req, context) {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!originAllowed(req)) return json(403, { error: "forbidden" });

  const ip = context?.ip || req.headers.get("x-forwarded-for") || "unknown";
  if (!allowRequest(ip)) return json(429, { error: "rate_limited" });

  let enquiry;
  try {
    const body = await req.json();
    enquiry = typeof body.enquiry === "string" ? body.enquiry.trim() : "";
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!enquiry) return json(400, { error: "empty_enquiry" });
  if (enquiry.length > MAX_CHARS) return json(400, { error: "enquiry_too_long" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { error: "not_configured" });

  try {
    const classification = await classifyEnquiry(enquiry, apiKey);
    return json(200, classification);
  } catch (err) {
    // Status code only, never the enquiry, never response content.
    console.error("classify failed:", err.message);
    const status = err.status === 429 ? 429 : 502;
    return json(status, { error: status === 429 ? "rate_limited" : "classification_failed" });
  }
}

export const config = { path: "/api/classify" };
