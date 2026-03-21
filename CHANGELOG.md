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

## Session 3 — 2026-03-21

### What changed

No code changes this session.

Confirmed that the payload already includes everything requested:
- `shoutout_action`, `shoutout_when`, `shoutout_result`, and `shoutout_full` are all sent in the webhook payload
- `occasion` is already in the payload, hardcoded to `'birthday'` via `CONFIG.occasion`, hidden from the UI — ready to be wired to a selector in a future session when more occasions are added

### Current state

Same as Session 2 — no changes deployed.

### Pending before go-live

- [ ] End-to-end test: upload → webhook → Stripe redirect
- [ ] Mobile testing
- [ ] Set up `order.instatoast.com` CNAME in Porkbun → GitHub Pages (Dave to do)
- [ ] Tighten GCS CORS `origin` from `*` to actual form URL once DNS is live
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` once signed URLs confirmed working
- [ ] Upload Country and Pop Punk audio preview files to GCS if not already done (`hb_country.mp3`, `hb_pop_punk.mp3`)
