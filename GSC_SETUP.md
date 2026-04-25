# Google Search Console Setup — getwandar.com

Step-by-step instructions for connecting, verifying, and maximising Google Search Console for getwandar.com.

---

## Step 1: Add getwandar.com as a Domain Property

A **Domain property** covers all URLs across all subdomains and protocols (www, non-www, http, https). This is the recommended setup.

1. Go to [https://search.google.com/search-console](https://search.google.com/search-console)
2. Sign in with your Google account (use the account you want to own the property permanently)
3. Click **"Add property"** (top-left dropdown)
4. Select **"Domain"** (not URL prefix)
5. Enter: `getwandar.com` (no www, no https — just the bare domain)
6. Click **"Continue"**
7. Google will display a TXT record to verify. **Copy this record — you will need it in Step 2.**

---

## Step 2: Add the TXT Verification Record in Netlify DNS

Your domain DNS is managed through Netlify. Follow these exact steps:

1. Log in to [https://app.netlify.com](https://app.netlify.com)
2. Click on your **team name** in the top-left
3. Click **"Domains"** in the left sidebar
4. Find and click on **getwandar.com**
5. Scroll down to **"DNS records"**
6. Click **"Add new record"**
7. Fill in the fields:
   - **Type:** `TXT`
   - **Name:** `@` (this represents the root domain)
   - **Value:** Paste the full TXT record string Google provided (it starts with `google-site-verification=`)
   - **TTL:** Leave as default (3600)
8. Click **"Save"**
9. Wait 5–10 minutes for DNS propagation

---

## Step 3: Verify the Domain

1. Return to Google Search Console
2. Click **"Verify"** on the domain verification screen
3. If DNS has propagated, verification completes immediately
4. If it fails, wait another 10 minutes and try again — DNS propagation can take up to 48 hours, though it's usually complete within 15 minutes on Netlify

**Troubleshooting:** If verification fails repeatedly, return to Netlify DNS and confirm the TXT record is saved exactly as Google provided it (no extra spaces, no truncation).

---

## Step 4: Submit Your Sitemap

1. In Search Console, select your verified property (getwandar.com)
2. In the left sidebar, click **"Sitemaps"** under the Indexing section
3. In the "Add a new sitemap" field, enter: `sitemap.xml`
4. Click **"Submit"**
5. Confirm the sitemap shows status **"Success"** and lists 19 URLs

Your sitemap is at: `https://www.getwandar.com/sitemap.xml`

---

## Step 5: Request Indexing via URL Inspection

Use this for each key page to accelerate Google's crawl after launch.

1. In Search Console, click the **search bar** at the top (labelled "Inspect any URL")
2. Enter the full URL of each page below
3. Click **"Request Indexing"** for each one

**Priority order — request in this sequence:**

**Tier 1 (highest priority):**
- `https://www.getwandar.com/`
- `https://www.getwandar.com/pricing.html`

**Tier 2 (guides — highest SEO value):**
- `https://www.getwandar.com/guides/`
- `https://www.getwandar.com/guides/safari-lead-generation-complete-guide.html`
- `https://www.getwandar.com/guides/social-listening-safari-operators-guide.html`
- `https://www.getwandar.com/guides/beating-competitors-safari-bookings.html`

**Tier 3 (blog posts):**
- `https://www.getwandar.com/blog/`
- `https://www.getwandar.com/blog/how-safari-operators-find-leads-online.html`
- `https://www.getwandar.com/blog/social-listening-for-safari-operators.html`
- `https://www.getwandar.com/blog/how-to-get-more-safari-bookings.html`

**Note:** Google allows approximately 12 URL inspection requests per day. If you hit the limit, continue the next day.

---

## Step 6: What to Monitor After 48 Hours

After 48 hours, check the following in Search Console:

### Coverage Report (Index → Pages)
- Confirm all submitted URLs show **"Indexed"** status
- Investigate any URLs showing **"Crawled - currently not indexed"** or **"Excluded"**
- Common issue: if new blog/guide pages aren't indexed within 7 days, re-request indexing

### Performance Report (Search results)
- **Total clicks, impressions, and average position** — these will be low initially but should grow over 30–90 days
- Check which **queries** are triggering impressions for your new pages
- Monitor whether your target keywords appear: "safari lead generation," "social listening for safari operators," "safari operator marketing"

### Core Web Vitals (Experience → Core Web Vitals)
- Confirm pages pass Core Web Vitals (LCP, CLS, FID/INP)
- Flag any "Poor" URLs for performance investigation

---

## Step 7: Track AI Overview Impressions

Google AI Overviews (previously SGE) are now measurable in Search Console.

### How to see AI Overview data:
1. Go to **Performance → Search results**
2. Click **"Search type"** dropdown (defaults to "Web")
3. Select **"Discover"** or keep on "Web"
4. In the **"Search Appearance"** filter, look for **"AI Overview"** (this filter appears once you have sufficient impressions data — typically after 2–4 weeks of indexing)
5. If visible, you can see which queries trigger AI Overview appearances and which URLs are cited

### What to look for:
- Guide pages (`/guides/`) should begin appearing in AI Overview results for definitional queries ("what is safari lead generation," "what is social listening for safari operators") within 4–8 weeks of indexing
- Blog posts may appear for comparison or how-to queries
- The FAQPage schema on index.html is designed to trigger FAQ rich results and AI Overview citations for Wandar-specific questions

### Accelerating AI Overview inclusion:
- Ensure all guide FAQPage schema is valid (test at [https://validator.schema.org](https://validator.schema.org))
- Ensure guides follow the question-based H2 structure (they do — this is already in place)
- Build 3–5 external links to each guide from relevant websites (safari blogs, travel directories, operator associations) to build authority signals

---

## 30-Day Post-Launch Action Plan

| Week | Action |
|------|--------|
| Week 1 | Verify GSC setup, submit sitemap, request indexing of all 10 priority URLs |
| Week 1 | Share guides on LinkedIn with a short expert commentary post |
| Week 2 | Check GSC Coverage — confirm all pages indexed |
| Week 2 | Post on relevant subreddits linking to guides (r/travel, r/solotravel mods permitting) |
| Week 3 | Answer 2–3 Quora questions in your niche, linking to relevant guides as citations |
| Week 3 | Check GSC Performance — note which queries are generating impressions |
| Week 4 | Reach out to 3–5 safari travel blogs for potential guide mentions or links |
| Week 4 | Review AI Overview filter in GSC to see early citation data |
| Ongoing | Respond to 3–5 forum posts per week with helpful content and guide links |

---

*Questions? Contact Wandar support via getwandar.com*
