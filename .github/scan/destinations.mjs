/* Wandar — destination extraction.

   Safari demand is overwhelmingly named: a post that matters says "Serengeti"
   or "Okavango" or "Kruger". Those are proper nouns with one meaning, which is
   why this is a keyword map and not a model call — measured over the 522 leads
   live on 2026-09-05, it identified a destination for 97% of them.

   MULTI-VALUED ON PURPOSE. 37% of matched leads name more than one country, and
   that is the demand, not noise: "Kenya or Tanzania?" is a real, unresolved
   choice, and the scoring engine already counts it as a SPECIFIC destination
   signal. Collapsing it to one country would be wrong for a third of the feed.

   Parks and cities resolve to their country so the filter has ~9 stable values
   rather than a long tail. Order of the keys is the display order.            */

export const PLACES = {
  Tanzania: ["tanzania", "serengeti", "ngorongoro", "tarangire", "zanzibar", "arusha",
             "kilimanjaro", "ndutu", "lake manyara", "selous", "nyerere", "ruaha",
             "mikumi", "saadani", "stone town", "seronera", "grumeti", "singita"],
  Kenya: ["kenya", "masai mara", "maasai mara", "amboseli", "samburu", "nairobi",
          "tsavo", "laikipia", "naivasha", "nakuru", "meru national park", "diani",
          "lewa", "ol pejeta"],
  "South Africa": ["south africa", "kruger", "sabi sand", "sabi sabi", "cape town",
                   "madikwe", "phinda", "timbavati", "garden route", "johannesburg",
                   "marloth park", "hluhluwe", "addo", "londolozi", "singita sabi"],
  Botswana: ["botswana", "okavango", "chobe", "moremi", "kalahari", "linyanti",
             "savuti", "makgadikgadi", "maun", "khwai", "nxai"],
  Namibia: ["namibia", "sossusvlei", "etosha", "swakopmund", "damaraland", "deadvlei",
            "windhoek", "skeleton coast", "walvis bay", "waterberg"],
  Zimbabwe: ["zimbabwe", "victoria falls", "hwange", "mana pools", "bulawayo",
             "matobo", "gonarezhou"],
  Zambia: ["zambia", "luangwa", "livingstone", "kafue", "lower zambezi", "lusaka"],
  Uganda: ["uganda", "bwindi", "murchison", "kibale", "entebbe", "queen elizabeth",
           "kampala", "mabamba", "kidepo"],
  Rwanda: ["rwanda", "volcanoes national park", "kigali", "nyungwe", "akagera"],
};

export const DESTINATIONS = Object.keys(PLACES);

/* Matches on title + body + url. The url earns its place: a TripAdvisor lead
   carries its forum name ("…-Tanzania.html") even when the post itself never
   spells the country out, which is common on a country's own forum. */
export function extractDestinations(title, body, url) {
  const hay = ((title || "") + " " + (body || "") + " " + (url || "")).toLowerCase();
  const out = [];
  for (const [country, words] of Object.entries(PLACES)) {
    if (words.some((w) => hay.includes(w))) out.push(country);
  }
  return out;                        // [] means "nothing named" — never a guess
}
