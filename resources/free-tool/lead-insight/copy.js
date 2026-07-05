/* Lead Insight Generator - deterministic copy banks.
 *
 * Everything the operator reads on the result screen is produced here by
 * pure code from the classification + score. No LLM involvement: templates
 * only ever slot-fill values the classifier extracted verbatim.
 * House rule: no em dashes anywhere in this tool's copy.
 */

// Priority order for naming missing signals and picking questions.
export const MISSING_PRIORITY = ["budget", "travel_dates", "group_size", "destination", "urgency"];

export const SIGNAL_LABELS = {
  destination: "Destination",
  travel_dates: "Travel Dates",
  budget: "Budget",
  group_size: "Group Size",
  urgency: "Urgency",
};

export const STATE_LABELS = {
  absent: "Absent",
  vague: "Vague",
  specific: "Specific",
  very_specific: "Very Specific",
};

export const INTENT_LABELS = {
  high: "High Intent",
  mid: "Mid Intent",
  low: "Low Intent",
  very_low: "Very Low Intent",
};

export const SOURCE_LABELS = {
  email: "Email",
  whatsapp: "WhatsApp",
  website: "Website enquiry",
  marketplace: "Marketplace lead",
};

// One tip per loading stage. Safari operator economics, not filler.
export const LOADING_STAGES = [
  {
    label: "Reading the enquiry",
    tip: "A proper safari quote takes hours of route, lodge, and flight work. Strong operators triage before they build.",
  },
  {
    label: "Detecting the five signals",
    tip: "Five signals decide whether a lead is quote-ready: destination, dates, budget, group, and urgency.",
  },
  {
    label: "Classifying signal strength",
    tip: "'Luxury' spans $500 to $3,000 a night. A budget number beats any adjective, even a rough one.",
  },
  {
    label: "Scoring intent",
    tip: "Never send a full itinerary to an unqualified lead. One good question filters dreamers from bookers.",
  },
];

// Missing-information copy: short, mockup-style phrases.
const MISSING_INFO = {
  budget: {
    absent: "Budget range, even approximate",
    vague: "A budget figure, not just 'luxury'",
  },
  travel_dates: {
    absent: "Travel month and year",
    vague: "Exact dates or date range",
  },
  group_size: {
    absent: "Who's travelling, and children's ages",
    vague: "Exact party size and children's ages",
  },
  destination: {
    absent: "Which country, park, or region",
    vague: "Preferred parks or regions",
  },
  urgency: {
    absent: "When they plan to decide or book",
    vague: "How firm their booking timeline is",
  },
};

// Ready-to-send qualifying questions, one per signal.
const QUESTION_BANK = {
  budget:
    "So I can point you at the right camps and routing, do you have a rough budget in mind, total or per person?",
  travel_dates:
    "Do you have a month and year in mind? Season shapes pricing, wildlife, and availability, so it changes everything.",
  group_size:
    "Who'll be travelling? If children are joining, their ages help, since several lodges and activities have minimum-age rules.",
  destination:
    "Is there a country or park already drawing you, or would you like me to suggest a route?",
  urgency: "When are you hoping to make a decision? The best camps in peak season book out early.",
};

// Short names used when a checklist item points at a specific gap.
const SHORT_GAP = {
  budget: "a budget figure",
  travel_dates: "their travel month and year",
  group_size: "who's travelling",
  destination: "where they want to go",
  urgency: "their booking timeline",
};

const isCounting = (state) => state === "specific" || state === "very_specific";

function extractedValue(signals, key) {
  const entry = signals[key];
  return entry && isCounting(entry.state) && entry.value ? entry.value : null;
}

function missingSignals(signals) {
  return MISSING_PRIORITY.filter((key) => !isCounting(signals[key].state));
}

/**
 * Build every piece of result-screen copy from the classification + score.
 *
 * @param {Record<string,{state:string,value:string|null}>} signals
 * @param {{score:number, tier:string}} scored
 * @returns result copy object consumed by lead-insight.js
 */
export function buildResultCopy(signals, scored) {
  const missing = missingSignals(signals);
  const gaps = missing.map((key) => ({
    key,
    label: SIGNAL_LABELS[key],
    text: MISSING_INFO[key][signals[key].state === "vague" ? "vague" : "absent"],
  }));

  const dest = extractedValue(signals, "destination");
  const topGap = missing[0] || null;

  const questionCount = { high: 1, mid: 3, low: 1, very_low: 3 }[scored.tier];
  const questions = missing.slice(0, questionCount).map((key) => QUESTION_BANK[key]);

  let copy;
  switch (scored.tier) {
    case "high":
      copy = {
        decision: "Reply today",
        star: "Quote-worthy lead",
        headline: "Reply today with a route suggestion and one final qualifying question.",
        subline:
          missing.length > 0
            ? "The enquiry shows strong intent, but a few planning details are still missing."
            : "The enquiry gives you everything you need: destination, dates, budget, group, and readiness.",
        checklist: [
          "Share a tailored route suggestion that fits the enquiry",
          missing.length > 0
            ? "Ask one key qualifying question to uncover top priority"
            : "State your quote validity window and deposit terms",
          "Set expectations for what you need before building the itinerary",
        ],
        why: "Travellers at this stage are comparing options and forming preferences. A timely, helpful reply keeps you top of mind and increases your chances of being their choice.",
        callout: "Replying now builds trust and keeps the momentum.",
      };
      break;
    case "mid":
      copy = {
        decision: "Qualify first",
        star: "Not quote-ready yet",
        headline: "Ask two or three targeted questions before you build anything.",
        subline:
          "There's a real trip here, but quoting now means guessing. Two minutes of questions protects hours of work.",
        checklist: [
          `Send the ${questions.length} ready-made question${questions.length === 1 ? "" : "s"} below before building anything`,
          `Open with one warm line about ${dest || "their trip idea"} so the reply doesn't read like a form`,
          "Set a follow-up reminder for 3 to 4 days in case they don't answer",
        ],
        why: "Real interest, but quoting now means guessing at budget or dates. A two-minute qualifying reply protects hours of itinerary work and shows the traveller you take their trip seriously.",
        callout: "Qualify first: your itinerary hours are your most expensive resource.",
      };
      break;
    case "low":
      copy = {
        decision: "Light follow-up",
        star: "Don't build an itinerary yet",
        headline: "Send a short, friendly reply. Don't build an itinerary yet.",
        subline: "Early-stage interest. Keep the door open without spending itinerary hours.",
        checklist: [
          "Send a two-sentence reply: one warm line, then the question below",
          `Ask only the single easiest question: ${SHORT_GAP[topGap]}`,
          "Hold off on routes and pricing until they answer",
        ],
        why: "This is an early-stage dreamer. A warm, low-effort touch keeps you first in mind when the trip firms up, at near-zero cost to you.",
        callout: "One friendly line now beats a full proposal nobody reads.",
      };
      break;
    default: // very_low
      copy = {
        decision: "Qualify first",
        star: "Not enough to score",
        headline: "Not enough to act on yet. Ask for the essentials first.",
        subline:
          "The enquiry doesn't give you anything concrete to price. The three questions below will change that.",
        checklist: [
          "Copy the three questions below into a quick reply",
          "Don't build anything yet: no route, no lodges, no pricing",
          "When they answer, paste the reply back in here and re-score it",
        ],
        why: "Replying with good questions costs two minutes and turns a vague enquiry into a scoreable one, or politely filters it out before it costs you an afternoon.",
        callout: "Good questions turn vague enquiries into real leads.",
      };
  }

  return { ...copy, gaps, questions, intentLabel: INTENT_LABELS[scored.tier] };
}
