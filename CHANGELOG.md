# CHANGELOG — Instatoast Order Form

Maintained by Claude Code. Updated at the end of every session.
Format: newest session at the bottom.

---

## Session 1 — 2026-03-19

### What was built

**`index.html`** — complete single-file order form:
- 5 sections: About You, About Them, Photos, Song Style, Review & Submit
- Crop tool (cropperjs, locked to 864×1115 ratio) with mobile-friendly modal
- Tone slider (0–100) with tone-dependent shoutout placeholder text
- Genre selector — compact radio style (name, description, inline play button; "preview coming soon" fallback when audioUrl is placeholder)
- Photo thumbnail strip with per-photo remove; `MediaSlot` module structured to support future video type
- localStorage persistence for all text fields, slider, and genre selection (not photos — browser limitation, notice shown to user)
- Inline validation on blur; full validation on submit
- Upload progress overlay with per-photo status and progress bar
- Submit flow: validate → generate order_id → upload photos → POST webhook → redirect Stripe
- `CONFIG.useSignedUrls` flag: `false` = direct public PUT (current); `true` = via Cloud Function (future)
- All tuneable values in `CONFIG` block at top of script

**`cloud-function/`** — Cloud Function source (not yet deployed):
- `index.js`: Node.js 22 HTTP function, generates v4 signed PUT URLs for GCS
- Validates orderId format, photoIndex range, and contentType before signing
- `package.json`, `README.md` with full deploy instructions and service account setup

**`.github/workflows/deploy.yml`** — GitHub Pages auto-deploy on push to `main`

**`cors.json`** — CORS config for the `instatoast-videos` bucket (applied)

### GCP changes made

| Change | Details |
|---|---|
| CORS applied | `gsutil cors set cors.json gs://instatoast-videos` — allows PUT/POST from any origin |
| `allUsers` objectViewer | Already existed on `instatoast-videos` — objects publicly readable |
| `allUsers` objectCreator | Added to `instatoast-videos` — allows direct browser PUTs for testing |

### Cloud Function deploy — attempted, not completed

Attempted to deploy `getSignedUploadUrl` to `us-west1`. Cloud Build step 2 (the Node.js buildpack) failed consistently across multiple attempts. Root cause not fully resolved — likely an org-level Cloud Build policy on project `nca-toolkit-api-452723` blocking buildpack execution. All partial resources from the failed attempts were cleaned up (see below).

**IAM roles granted during failed attempts** (still in effect on the project, harmless):
- `185869230606@cloudbuild.gserviceaccount.com`: `roles/cloudbuild.builds.builder`, `roles/artifactregistry.reader`, `roles/logging.logWriter`
- `185869230606-compute@developer.gserviceaccount.com`: `roles/cloudfunctions.developer`, `roles/storage.objectAdmin`

### Cleanup performed

All Cloud Function deployment artifacts removed. The following resources were deleted:

| Resource | Notes |
|---|---|
| Cloud Function `getSignedUploadUrl` (us-west1) | Deleted |
| `gs://gcf-v2-sources-185869230606-us-west1` | Auto-created by Cloud Functions, deleted |
| `gs://gcf-v2-uploads-185869230606.us-west1.cloudfunctions.appspot.com` | Auto-created by Cloud Functions, deleted |
| `gs://nca-toolkit-api-452723-cloudbuild-logs` | Created during debugging, deleted |
| Artifact Registry repo `gcf-artifacts` (us-west1) | Auto-created by Cloud Functions, deleted |

### Current state

- `index.html` is complete and functional locally
- Photos upload directly to GCS (public write, no auth) — **testing mode only**
- `webhookUrl` and `stripeUrl` in CONFIG are still placeholders — webhook and Stripe redirect will not work until filled in
- Cloud Function not deployed — auth-gated uploads not yet in place
- Form not yet pushed to GitHub or hosted

### Pending before go-live

- [ ] Fix Cloud Function deploy (investigate Cloud Build org policy on `nca-toolkit-api-452723`, or deploy from a clean project)
- [ ] Once Cloud Function is live: set `CONFIG.useSignedUrls: true` and paste in the function URL
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` once signed URLs are working
- [ ] Tighten GCS CORS `origin` from `*` to the actual GitHub Pages URL
- [ ] Initialise git repo and push to GitHub; enable GitHub Pages in repo settings
- [ ] Fill in `CONFIG.webhookUrl` (Make.com) and `CONFIG.stripeUrl`
- [ ] Add real audio preview URLs for genres once available
- [ ] Test full end-to-end flow (upload → webhook → Stripe redirect)
- [ ] Test on mobile
- [ ] Set up `order.instatoast.com` CNAME in Porkbun pointing to GitHub Pages (Dave to do)

---

## Session 2 — 2026-03-21

### What changed

All changes in `index.html`, pushed to `main` on GitHub. GitHub Pages auto-deploys on push.

**Shoutout section — three fixes:**
- Labels renamed: "What do they always do?" and "And then what happens?" (was "What do they do?" / "What happens?")
- Preview box hidden by default (`display:none` in CSS); shown only once at least one shoutout field has content
- `buildShoutout()` rewritten — omits empty parts gracefully instead of inserting `…` placeholders. Sentence assembles from whatever is filled.

**Review section:**
- Photo count format changed to `X/10 photos` (was `X / 10`)

### Current state

- Form is live on GitHub Pages, embedded in Carrd via iframe
- Cloud Function (`getSignedUploadUrl`) deployed to `us-central1`, `CONFIG.useSignedUrls: true`
- Signed URL auth is active — `allUsers` objectCreator should be removed from the bucket once confirmed working end-to-end
- `CONFIG.webhookUrl` and `CONFIG.stripeUrl` are filled in (real values, not placeholders)
- Three genres configured with real audio preview URLs: Reggae, Country, Pop Punk
- Order ID format: `YYMMDD-HHMM-xxxx`
- GCS path: `instatoast/orders/{order_id}/media_inputs/photo_01.jpg`
- Stripe redirect appends `?client_reference_id={order_id}`
- Shoutout payload sends `shoutout_action`, `shoutout_when`, `shoutout_result`, `shoutout_full` plus `tone` as string (`'sweet'` or `'roast'`)

### Pending before go-live

- [ ] End-to-end test: upload → webhook → Stripe redirect
- [ ] Mobile testing
- [ ] Set up `order.instatoast.com` CNAME in Porkbun → GitHub Pages (Dave to do)
- [ ] Tighten GCS CORS `origin` from `*` to actual form URL once DNS is live
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` once signed URLs confirmed working
- [ ] Upload Country and Pop Punk audio preview files to GCS if not already done (`hb_country.mp3`, `hb_pop_punk.mp3`)

---

## Session 3 — 2026-03-25

### What changed

**Stripe embedded checkout** — replaced the Stripe redirect with an in-page payment modal.

**`cloud-function/index.js`** — new export `createCheckoutSession`:
- Creates a Stripe Checkout Session with `ui_mode: 'embedded'`
- Returns `clientSecret` to the frontend
- Reads `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `RETURN_URL` from env vars
- Deployed to `us-central1` as a separate Cloud Function

**`cloud-function/package.json`** — added `stripe: ^17.0.0` dependency

**`cloud-function/deploy-checkout.sh`** — deploy script for the new function

**`index.html`:**
- Loads `stripe.js` from Stripe CDN in `<head>`
- Payment modal UI (slide-up from bottom on mobile, centered on desktop) with fade+rise animation; keyframes on `.payment-modal__card` are the hook for future custom animation
- Order complete screen (shown when returning from Stripe with `?order_complete=true`)
- `CONFIG.stripeUrl` removed; replaced with `CONFIG.stripePublishableKey` and `CONFIG.checkoutSessionUrl`
- `openPaymentModal(orderId)` — calls Cloud Function, mounts Stripe embedded checkout
- `showOrderComplete()` — hides form, shows confirmation screen
- `handleSubmit` now calls `openPaymentModal` instead of redirecting

Also confirmed (no code change needed): payload already includes `shoutout_action`, `shoutout_when`, `shoutout_result`, `shoutout_full`, and `occasion` — all present from Session 2.

### GCP changes

| Change | Details |
|---|---|
| New Cloud Function `createCheckoutSession` | Deployed to `us-central1`, env vars: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID=price_1Shexr34CKOoUJtzJ9HC4Jmw`, `RETURN_URL=https://davedelazer.github.io/instatoast_form` |

### Current state

- Stripe embedded checkout live on GitHub Pages
- `createCheckoutSession` Cloud Function deployed
- CORS on `createCheckoutSession` locked to `https://order.instatoast.com` — will block calls from GitHub Pages URL until DNS is live (or CORS is temporarily widened for testing)
- `RETURN_URL` set to GitHub Pages URL for pre-DNS testing

### Pending before go-live

- [ ] End-to-end test: upload → webhook → embedded checkout → order complete screen
- [ ] Mobile testing
- [ ] Set up `order.instatoast.com` CNAME in Porkbun → GitHub Pages (Dave to do)
- [ ] Update `RETURN_URL` env var on `createCheckoutSession` to `https://order.instatoast.com` once DNS is live
- [ ] Update CORS on `createCheckoutSession` to `https://order.instatoast.com` (currently matches — but verify after DNS)
- [ ] Tighten GCS CORS `origin` from `*` to actual form URL once DNS is live
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` once signed URLs confirmed working
- [ ] Upload Country and Pop Punk audio preview files to GCS if not already done (`hb_country.mp3`, `hb_pop_punk.mp3`)
- [ ] Consider widening CORS on `createCheckoutSession` temporarily to GitHub Pages URL for pre-DNS testing

---

## Session 4 — 2026-03-27

### What changed

**`cloud-function/index.js`:**
- Added `allow_promotion_codes: true` — promo code field now shows in embedded checkout
- Added `customer_email` — passed from form to checkout session to pre-fill Stripe's email field (customer can still change it)
- Removed `automatic_payment_methods: { enabled: true }` — invalid for Checkout Sessions API; payment methods are controlled via Stripe Dashboard instead

**`cloud-function/deploy-checkout.sh`:**
- Updated `RETURN_URL` from GitHub Pages URL to `https://order.instatoast.com` (DNS is now live)

**`index.html`:**
- `openPaymentModal(orderId)` → `openPaymentModal(orderId, customerEmail)` — reads sender email from form and passes it to the Cloud Function

### Stripe Dashboard changes (Dave)
- Payment methods enabled under Settings → Payment methods
- Stripe webhook added under Developers → Webhooks, pointing to a new Make scenario
- Listens for `checkout.session.completed` — Make matches on `data > object > client_reference_id` (= orderId) to find the Airtable record and mark it paid

### Current state
- DNS live at `order.instatoast.com`
- Full end-to-end flow confirmed working: upload → webhook → embedded checkout → order complete screen
- Two-webhook architecture: form submit fires Make webhook (captures abandoned carts), Stripe fires on payment confirmed
- Promo codes working — create coupons in Stripe Dashboard → Products → Coupons

### Pending
- [ ] Tighten GCS CORS `origin` from `*` to `https://order.instatoast.com`
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket
- [ ] Verify Country and Pop Punk audio preview files are in GCS (`hb_country.mp3`, `hb_pop_punk.mp3`)
- [ ] Add dancing toast animation to the order complete screen (`showOrderComplete()` in `index.html`)
- [ ] Clean up Stripe checkout appearance/payment method ordering in Dashboard
