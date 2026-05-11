═══════════════════════════════════════════════════════════════
  VARAD GLOBAL LOGISTICS — CLOUDFLARE WORKER + RESEND SETUP
═══════════════════════════════════════════════════════════════

FILES IN THIS PACKAGE
──────────────────────────────────────────────────────────────
  worker.js          ← Cloudflare Worker (the email backend)
  wrangler.toml      ← Worker configuration file
  index_new_1.html   ← Updated website HTML
  README.txt         ← This file

OVERVIEW
──────────────────────────────────────────────────────────────
  Browser Form (Cloudflare Pages)
       ↓  POST
  Cloudflare Worker (worker.js)
       ↓  HTTPS API call
  Resend (email delivery)
       ↓
  Your inbox ✅  +  Customer auto-reply ✅


STEP 1 — CREATE RESEND ACCOUNT & GET API KEY
──────────────────────────────────────────────────────────────
  1. Go to https://resend.com → Sign Up (free)
     Free tier: 3,000 emails/month, 100/day

  2. Dashboard → "API Keys" → "Create API Key"
     Name: "Varad Worker" | Permission: Sending access
     → COPY the key (shown only once!)
     → Looks like: re_aBcDeFgH_xxxxxxxxxxxxxxxxxxxx


STEP 2 — VERIFY YOUR DOMAIN IN RESEND
──────────────────────────────────────────────────────────────
  This lets you send FROM noreply@varadgloballogistics.com

  1. Resend Dashboard → "Domains" → "Add Domain"
  2. Enter: varadgloballogistics.com
  3. Resend shows 3 DNS records (TXT + MX + DKIM)
  4. Cloudflare Dashboard → your domain → DNS → add each record
  5. Back in Resend → "Verify Domain" (takes 1–10 mins)

  NOTE: Until verified, use MAIL_FROM = 'onboarding@resend.dev'
  for testing (emails only go to your own Resend account email).


STEP 3 — DEPLOY THE CLOUDFLARE WORKER (No Terminal Needed)
──────────────────────────────────────────────────────────────
  1. https://dash.cloudflare.com → "Workers & Pages" → "Create"
     → "Create Worker" → Name: varad-enquiry-worker → Deploy
  2. Click "Edit Code" → DELETE all code → PASTE worker.js → Save & Deploy
  3. Worker Settings → "Variables" → "Add variable":
       Name:  RESEND_API_KEY
       Value: re_aBcDeFgH_xxxx...   (toggle Encrypt ON)
       → Save and Deploy

  Your Worker URL:  https://varad-enquiry-worker.YOUR_SUBDOMAIN.workers.dev


STEP 4 — UPDATE HTML WITH YOUR WORKER URL
──────────────────────────────────────────────────────────────
  In index_new_1.html, find:
    const WORKER_URL = 'https://varad-enquiry-worker.YOUR_SUBDOMAIN.workers.dev';

  Replace YOUR_SUBDOMAIN with your actual subdomain from the Worker dashboard.


STEP 5 — DEPLOY HTML TO CLOUDFLARE PAGES
──────────────────────────────────────────────────────────────
  Upload the updated index_new_1.html to your Pages project as usual.


STEP 6 — TEST
──────────────────────────────────────────────────────────────
  1. Open your website → fill the form → submit
  2. Green success message = working ✅
  3. Check info@varadgloballogistics.com for admin notification
  4. Check submitted email address for customer auto-reply


TROUBLESHOOTING
──────────────────────────────────────────────────────────────
  "Server configuration error"
  → RESEND_API_KEY secret not set in Worker. Redo Step 3.

  CORS error in browser console
  → Your site URL not in ALLOWED_ORIGINS in worker.js.
    Add it and redeploy the Worker.

  Email not arriving (success shows)
  → Check spam folder
  → Resend Dashboard → "Emails" tab → check delivery status
  → Make sure domain is verified for custom From address

  Form shows error
  → Browser DevTools → Network → check the JSON response body


EMAIL FLOW
──────────────────────────────────────────────────────────────
  To YOU:
    From:    Varad Global Logistics <noreply@varadgloballogistics.com>
    Subject: New Enquiry: [Service] — [Customer Name]
    ReplyTo: customer's email (reply directly from your inbox)

  To CUSTOMER:
    From:    Varad Global Logistics <noreply@varadgloballogistics.com>
    Subject: We've Received Your Enquiry — Varad Global Logistics


OPTIONAL — USE YOUR CUSTOM DOMAIN FOR THE WORKER
──────────────────────────────────────────────────────────────
  Use https://varadgloballogistics.com/api/enquiry instead of workers.dev:

  1. Worker → Settings → Triggers → Routes → Add Route
     Route: varadgloballogistics.com/api/enquiry
     Zone:  varadgloballogistics.com
  2. Update WORKER_URL in HTML to match
  3. Remove workers.dev from ALLOWED_ORIGINS in worker.js

═══════════════════════════════════════════════════════════════
