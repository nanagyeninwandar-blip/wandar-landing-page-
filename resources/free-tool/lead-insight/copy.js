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

export const LOADING_STAGES = [
  { label: "Reading the enquiry" },
  { label: "Detecting the five signals" },
  { label: "Classifying signal strength" },
  { label: "Scoring intent" },
];

// Wandar's worldview. One line per loading stage, drawn at random each run.
export const WORLDVIEW_TIPS = [
  "Safari operators do not just need more leads. They need stronger lead opportunities earlier.",
  "A quote request is not always a strong lead.",
  "A social mention is not always demand.",
  "A traveler asking detailed questions in public may reveal more intent than a weak form submission.",
  "Trust often starts before the traveler sends an enquiry.",
  "Operators who only wait for inbound quote requests may enter the buying journey too late.",
  "Better timing, better context, and stronger intent signals can help operators respond smarter and build trust earlier.",
  "More enquiries do not matter if most of them waste the operator's time.",
  "The strongest safari lead is often visible before it becomes a formal enquiry.",
  "A traveler does not need to fill out a form to show buying intent.",
  "The quality of a lead is not only in what the traveler asks, but in when they ask it.",
  "Safari operators should not treat every enquiry with the same level of effort.",
  "A vague enquiry deserves a thoughtful follow-up, not a full custom itinerary.",
  "A detailed public question can be more valuable than a generic website form.",
  "The best time to build trust is before the traveler has chosen who to contact.",
  "Operators lose opportunities when they only react to inbox activity.",
  "Safari demand often appears first as research, comparison, confusion, or a question.",
  "A traveler asking about routes, timing, budget, and lodges is already revealing intent.",
  "A weak quote request can look serious on the surface.",
  "A strong planning conversation can look informal on the surface.",
  "The operator who understands context first can respond better than the operator who replies fastest.",
  "Speed matters, but timing with context matters more.",
  "Not every lead deserves a proposal.",
  "Some leads need education before they need a quote.",
  "Some leads need qualification before they need pricing.",
  "Some leads need reassurance before they need an itinerary.",
  "Safari operators should protect their quoting time like a scarce resource.",
  "A quote is not just a response. It is labor, judgment, supplier knowledge, and margin risk.",
  "Wasted quoting is one of the hidden costs of safari sales.",
  "The problem is not that operators do not work hard enough. The problem is that too much of the work starts too late.",
  "Travelers often form trust from the answers they see before they ever enquire.",
  "Public planning conversations are part of the safari buying journey.",
  "Safari operators should not depend only on paid ads and directories to see demand.",
  "The internet is full of safari intent, but most of it is unstructured.",
  "Strong intent is usually buried inside messy questions.",
  "The best leads are not always the loudest ones.",
  "A mention tells you who is already visible. A planning question tells you who may still be deciding.",
  "A lead is stronger when it includes destination, dates, group size, budget, or urgency.",
  "Missing information is not a reason to ignore a traveler. It is a reason to ask a sharper question.",
  "A better first reply can save hours of unnecessary planning.",
  "The first operator to be genuinely useful often earns the next conversation.",
  "Trust is built through relevance, not just speed.",
  "Safari sales should feel less like chasing forms and more like understanding intent.",
  "Operators need better judgment tools, not more dashboards for the sake of dashboards.",
  "A lead system should help operators decide what to do next.",
  "The best technology for safari operators should respect how safari selling actually works.",
  "Safari is too consultative for generic lead scoring.",
  "Safari intent needs to be read through safari-specific signals.",
  "A honeymoon enquiry, family safari enquiry, migration enquiry, and vague “Africa trip” enquiry should not be treated the same way.",
  "Strong lead opportunities are created when timing, context, and intent come together.",
  "Better lead quality helps operators spend more energy on travelers who are actually moving.",
  "The goal is not to automate the safari relationship. It is to help operators notice the right traveler earlier and respond with better judgment.",
  "Wandar exists because safari operators should not have to wait until trust is built somewhere else.",
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
    absent: "Who's traveling, and children's ages",
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
    "Who'll be traveling? If children are joining, their ages help, since several lodges and activities have minimum-age rules.",
  destination:
    "Is there a country or park already drawing you, or would you like me to suggest a route?",
  urgency: "When are you hoping to make a decision? The best camps in peak season book out early.",
};

// Short names used when a checklist item points at a specific gap.
const SHORT_GAP = {
  budget: "a budget figure",
  travel_dates: "their travel month and year",
  group_size: "who's traveling",
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
        why: "Travelers at this stage are comparing options and forming preferences. A timely, helpful reply keeps you top of mind and increases your chances of being their choice.",
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
        why: "Real interest, but quoting now means guessing at budget or dates. A two-minute qualifying reply protects hours of itinerary work and shows the traveler you take their trip seriously.",
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
