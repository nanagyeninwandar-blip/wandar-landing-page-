/* Wandar Safari Demand — source lists.
   TripAdvisor: 40 forums (g6 "Africa" dropped — it's a hub page with zero
   ShowTopic links, confirmed 2026-08-08).
   Reddit: HANDOFF §6's productive list only. Country/local subs, r/safari
   (the Apple browser sub) and r/wildlifephotography are confirmed dead. */

export const TA_FORUMS = [
  "https://www.tripadvisor.com/ShowForum-g1184851-i13939-Sossusvlei_Namib_Naukluft_Park.html",
  "https://www.tripadvisor.com/ShowForum-g1600222-i15817-Amboseli_National_Park_Amboseli_Eco_system_Rift_Valley_Province.html",
  "https://www.tripadvisor.com/ShowForum-g293740-i9186-South_Africa.html",
  "https://www.tripadvisor.com/ShowForum-g293747-i9226-Tanzania.html",
  "https://www.tripadvisor.com/ShowForum-g293751-i10776-Serengeti_National_Park.html",
  "https://www.tripadvisor.com/ShowForum-g293759-i9323-Zimbabwe.html",
  "https://www.tripadvisor.com/ShowForum-g293761-i9853-Victoria_Falls_Matabeleland_North_Province.html",
  "https://www.tripadvisor.com/ShowForum-g293766-i9284-Botswana.html",
  "https://www.tripadvisor.com/ShowForum-g293820-i9680-Namibia.html",
  "https://www.tripadvisor.com/ShowForum-g293828-i9987-Rwanda.html",
  "https://www.tripadvisor.com/ShowForum-g293840-i9254-Uganda.html",
  "https://www.tripadvisor.com/ShowForum-g293842-i9277-Zambia.html",
  "https://www.tripadvisor.com/ShowForum-g294206-i9216-Kenya.html",
  "https://www.tripadvisor.com/ShowForum-g294207-i9695-Nairobi.html",
  "https://www.tripadvisor.com/ShowForum-g294209-i9217-Maasai_Mara_National_Reserve_Rift_Valley_Province.html",
  "https://www.tripadvisor.com/ShowForum-g298090-i9647-Victoria_Falls_Southern_Province.html",
  "https://www.tripadvisor.com/ShowForum-g298254-i14741-Samburu_National_Reserve_Samburu_District_Rift_Valley_Province.html",
  "https://www.tripadvisor.com/ShowForum-g303975-i10696-Lake_Nakuru_National_Park_Rift_Valley_Province.html",
  "https://www.tripadvisor.com/ShowForum-g303977-i9878-Tsavo_National_Park_East_Coast_Province.html",
  "https://www.tripadvisor.com/ShowForum-g303978-i10451-Tsavo_National_Park_West_Coast_Province.html",
  "https://www.tripadvisor.com/ShowForum-g312618-i9872-Kruger_National_Park.html",
  "https://www.tripadvisor.com/ShowForum-g312650-i10981-Pilanesberg_National_Park_Moses_Kotane_Local_Municipality_North_West_Province.html",
  "https://www.tripadvisor.com/ShowForum-g316101-i20668-Moremi_Game_Reserve_Okavango_Delta_North_West_District.html",
  "https://www.tripadvisor.com/ShowForum-g317085-i11599-Ngorongoro_Conservation_Area_Arusha_Region.html",
  "https://www.tripadvisor.com/ShowForum-g319715-i10859-Mount_Kenya_National_Park.html",
  "https://www.tripadvisor.com/ShowForum-g319722-i10042-Bwindi_Impenetrable_National_Park_Western_Region.html",
  "https://www.tripadvisor.com/ShowForum-g424916-i9774-Etosha_National_Park_Oshikoto_Region.html",
  "https://www.tripadvisor.com/ShowForum-g471846-i9568-Sabi_Sand_Game_Reserve_Kruger_National_Park.html",
  "https://www.tripadvisor.com/ShowForum-g471868-i9370-Madikwe_Game_Reserve_North_West_Province.html",
  "https://www.tripadvisor.com/ShowForum-g472669-i11300-Chobe_National_Park_North_West_District.html",
  "https://www.tripadvisor.com/ShowForum-g472673-i10231-Okavango_Delta_North_West_District.html",
  "https://www.tripadvisor.com/ShowForum-g477977-i14020-Hwange_National_Park_Matabeleland_North_Province.html",
  "https://www.tripadvisor.com/ShowForum-g479221-i11917-Namib_Naukluft_Park.html",
  "https://www.tripadvisor.com/ShowForum-g479226-i14201-South_Luangwa_National_Park.html",
  "https://www.tripadvisor.com/ShowForum-g479228-i10626-Lower_Zambezi_National_Park_Lusaka_Province.html",
  "https://www.tripadvisor.com/ShowForum-g482884-i9487-Zanzibar_Island_Zanzibar_Archipelago.html",
  "https://www.tripadvisor.com/ShowForum-g488125-i9308-Lake_Manyara_National_Park_Arusha_Region.html",
  "https://www.tripadvisor.com/ShowForum-g488132-i13262-Queen_Elizabeth_National_Park_Western_Region.html",
  "https://www.tripadvisor.com/ShowForum-g608450-i16923-Tarangire_National_Park_Arusha_Region.html",
  "https://www.tripadvisor.com/ShowForum-g644032-i13253-Murchison_Falls_National_Park_Western_Region.html",
];

/* Safari-dedicated subs: blanket /new is correct and high-yield.
   r/safaris measured 64% on 2026-08-08 — the best of any source. */
export const RD_BLANKET = ["safaris", "MasaiMara", "krugerpark", "AfricaTravel"];

/* General travel subs: keyword-restricted search ONLY. Blanket /new here is
   tour-operator marketing spam + off-Africa content. */
export const RD_GENERAL = [
  "travel", "solotravel", "traveladvice", "honeymoonplanning",
  "chubbytravel", "FATTravel", "LuxuryTravel", "awardtravel", "AdventureTravel",
];

/* Reddit's own search matches loosely — place/product nouns cost less waste
   than intent phrases ("safari budget" returned Nepal and Bali threads on
   2026-08-11, and we pay per item BEFORE the engine filters). */
export const RD_TERMS = [
  "safari lodge", "safari camp", "South Luangwa", "Chobe",
  "Etosha", "Sabi Sands", "Serengeti", "Okavango",
];

/* Titles that never survive Layer 1 — drop before paying to deep-scrape. */
export const TA_TITLE_KILL =
  /\b(visa|vaccin|yellow fever|malaria|sim card|e-?sim|currency|atm|money|tip(ping)?|packing|what to (wear|pack)|luggage|airport transfer|car (hire|rental)|self.?drive route|driving|road condition|flight|layover|insurance|trip report|review of|just (back|returned)|our recent|thank you|asante|photos?( from)?|weather|rain)\b/i;
