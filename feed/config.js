/* ------------------------------------------------------------------
   Wandar — public front-end config.
   These two values are SAFE to ship in the browser: the anon key only
   grants what your Row-Level Security policies allow (public read of
   `leads`, authenticated writes to `waitlist`). The service-role key is
   NEVER placed here — it lives only in the scan job / seed script.

   Fill these in from  Supabase dashboard → Project Settings → API.
------------------------------------------------------------------ */
window.WANDAR_CONFIG = {
  SUPABASE_URL:      "https://ggwrnjaxhvgubgyanqyg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_rwEw98_b8Y_-ukfh05kk3g_LPr65AoY",

  // Where an authenticated user should land, and where to return after logout.
  // FEED_URL/AUTH_URL are relative so the app works wherever it is dropped —
  // at the site root or in a /feed/ subfolder (getwandar.com already has its own
  // styles.css, so a subfolder is the likely deployment; see LANDING_HANDOFF.md).
  // HOME_URL must be ABSOLUTE "/": it points at the marketing landing page, which
  // lives at the site root either way. As "index.html" it resolved to
  // /feed/index.html under a subfolder deploy and 404'd the no-email bounce.
  FEED_URL:  "app.html",
  AUTH_URL:  "auth.html",
  HOME_URL:  "/",

  // Wandar landing (getwandar.com) links used from the feed.
  PRICING_URL: "https://www.getwandar.com/pricing.html",   // "Pricing" opens this in a new tab

  // Edge Function that lets a RETURNING operator back in from the hero email
  // alone, on a device with no session — see supabase/functions/hero-signin.
  // Until it is deployed this simply fails and auth.html falls back to showing
  // the signup form, so leaving it set is safe.
  HERO_SIGNIN_URL: "https://ggwrnjaxhvgubgyanqyg.supabase.co/functions/v1/hero-signin",
};
