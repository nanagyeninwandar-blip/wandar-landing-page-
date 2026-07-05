/* The 10 acceptance tests from the brief — the source of truth.
 *
 * Each fixture pins:
 *   - enquiry: the raw text (also used by e2e.mjs against the live classifier)
 *   - signals: the hand-classification per the brief's Layer 2 definitions
 *   - score / tier: the exact expected Layer 3 output
 *
 * Tier note: the brief's Warm/Hot/Very Hot rows are floor/ceiling mechanics
 * only — the product exposes a single "high" tier. Expected scores are
 * unchanged and uniquely identify the band row.
 */

export const ACCEPTANCE = [
  {
    name: "1. Tanzania only",
    enquiry: "Planning a safari in Tanzania.",
    signals: {
      destination: "specific",
      travel_dates: "absent",
      budget: "absent",
      group_size: "absent",
      urgency: "absent",
    },
    score: 4.5,
    tier: "low",
  },
  {
    name: "2. Dates only, destination undecided",
    enquiry: "Looking to go on safari in July 2027, destination undecided.",
    signals: {
      destination: "absent",
      travel_dates: "specific",
      budget: "absent",
      group_size: "absent",
      urgency: "absent",
    },
    score: 4.5,
    tier: "low",
  },
  {
    name: "3. Named-country choice + dates",
    enquiry: "Thinking East Africa, maybe Kenya or Tanzania. Traveling July 2027.",
    signals: {
      destination: "specific",
      travel_dates: "specific",
      budget: "absent",
      group_size: "absent",
      urgency: "absent",
    },
    score: 7.0,
    tier: "mid",
  },
  {
    name: "4. Four trip signals, no urgency",
    enquiry: "Luxury Botswana safari September 2026, two of us, budget around $14,000.",
    signals: {
      destination: "specific",
      travel_dates: "specific",
      budget: "specific",
      group_size: "specific",
      urgency: "absent",
    },
    score: 8.5,
    tier: "high",
  },
  {
    name: "5. Honeymoon, three trip signals",
    enquiry: "Honeymoon safari, thinking Botswana or Zimbabwe, budget around $16,000.",
    signals: {
      destination: "specific",
      travel_dates: "absent",
      budget: "specific",
      group_size: "specific", // "honeymoon" = clearly named party of two
      urgency: "absent",
    },
    score: 8.5,
    tier: "high",
  },
  {
    name: "6. All vague — below 4.0",
    enquiry: "Family safari somewhere in Africa next year, decent budget.",
    signals: {
      destination: "vague",
      travel_dates: "vague",
      budget: "vague",
      group_size: "vague",
      urgency: "absent",
    },
    score: 3.0,
    tier: "very_low",
  },
  {
    name: "7. Four trip signals + hedged urgency",
    enquiry:
      "Tanzania July 2027, $15,000, family of four. Want to book but wife still needs convincing.",
    signals: {
      destination: "specific",
      travel_dates: "specific",
      budget: "specific",
      group_size: "specific",
      urgency: "vague", // hedged commitment — the score-critical judgment call
    },
    score: 9.0,
    tier: "high",
  },
  {
    name: "8. Hard deadline",
    enquiry:
      "Solo gorilla trekking Uganda June 2026, budget $6,000. Need to book in the next two weeks.",
    signals: {
      destination: "specific",
      travel_dates: "specific",
      budget: "specific",
      group_size: "specific",
      urgency: "very_specific",
    },
    score: 10.0,
    tier: "high",
  },
  {
    name: "9. Direct operator question",
    enquiry:
      "Tanzania safari July 2027, $15,000 budget, family of four. Which operators do you recommend?",
    signals: {
      destination: "specific",
      travel_dates: "specific",
      budget: "specific",
      group_size: "specific",
      urgency: "specific",
    },
    score: 10.0,
    tier: "high",
  },
  {
    name: "10. Complete picture, deciding this week",
    enquiry:
      "Northern Tanzania circuit July 2027, family of four two adults two kids aged 9 and 12, $20,000 all inclusive. Down to two operators, confirming this week.",
    signals: {
      destination: "very_specific",
      travel_dates: "specific",
      budget: "very_specific",
      group_size: "very_specific",
      urgency: "very_specific",
    },
    score: 10.0,
    tier: "high",
  },
];
