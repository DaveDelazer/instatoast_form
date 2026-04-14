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

---

## Session 6 — 2026-04-09

### What changed

**Three connected changes:** video trim+crop modal (Part 1), background uploads (Part 2), unified media tray (Parts 3 & 4). Both `index.html` and `cloud-function/index.js` modified. Cloud Function not yet redeployed — see Pending below.

---

#### `cloud-function/index.js`

- **Photo index limit**: 1–50 → 1–99 (shared counter with videos)
- **Video index limit**: 1–20 → 1–99 (shared counter with photos)
- **Video filename extension** *(breaking change)*: was always `video_XX.mp4`; now determined by `contentType`:
  - `video/webm` → `video_XX.webm` (primary path — encoded clips)
  - `video/quicktime` → `video_XX.mov` (iOS raw fallback)
  - `video/mp4` → `video_XX.mp4` (fallback)
- `video/webm` was already accepted as a valid `contentType`; now it generates a `.webm` filename
- `opener` and `closer` media types retained for backwards compat but are no longer called from the frontend

---

#### `index.html` — State shape change

**Old state:** `openerPhoto`, `closerPhoto`, `photos[]`, `videos[]`, `mediaChoice`, `photoIdCounter`, `videoIdCounter`

**New state:**
- `state.media[]` — flat ordered array; role is positional (first = opener, last = closer, middle = everything in between)
- `state.orderId` — generated on first media confirm (was: generated at submit time)
- `state.uploadCounter` — shared counter for filenames; increments on each upload
- `mediaIdCounter` — module-level, increments for each new tray item

Each media item: `{ id, type, blob, thumbUrl, duration, publicUrl, status, uploadIndex, abortController, rawFallback? }`

`status` values: `'encoding' | 'uploading' | 'uploaded' | 'failed'`

---

#### `index.html` — Functions removed

`renderOpenerSlot`, `renderCloserSlot`, `setMediaChoice`, `updateMediaSectionVisibility`, `renderMiddlePhotos`, `updateMiddlePhotosHeader`, `enqueueMiddleFiles`, `openFilePickerFor`, `addVideoClip`, `renderVideoClips`, `updateVideoUI`, `showVideoAddError`, `clearVideoAddError`, `uploadAllMedia`

---

#### `index.html` — Functions added

`renderMediaTray`, `addMediaToTray`, `removeMediaFromTray`, `updateMediaStatusLine`, `updateVideoScrubber`, `updateTrayWarning`, `updateSubmitButtonState`, `enqueueUpload`, `processUploadQueue`, `doUpload`, `retryUpload`, `processNextMediaItem`, `VideoTrim` module (see below)

---

#### `index.html` — VideoTrim module (new)

Video trim+crop modal:
- Pan/drag and pinch/scroll-to-zoom crop frame (864×1115 aspect ratio, `min(100%, 45vh × 864/1115)` width)
- Dual-thumb custom trim slider with in/out time labels and remaining-seconds counter
- Play/pause preview within crop frame; thin playhead bar tracks full-video position
- `MediaRecorder` encodes cropped+trimmed result to WebM at exactly 864×1115, ~2.5 Mbps, via `canvas.captureStream(30)`
- Uses `requestVideoFrameCallback` if available (Safari 15.4+), falls back to `requestAnimationFrame`
- Encode progress shown in modal ("Processing… X%"); controls locked during encode; cancel discards
- **iOS fallback**: if `MediaRecorder` or `canvas.captureStream` unsupported, uploads raw file with `rawFallback: true`

---

#### `index.html` — MediaSlot changes

- `cropTarget` field removed — all confirmed crops go into the unified tray
- `confirmCrop()` now creates a photo item and calls `addMediaToTray()` + `enqueueUpload()` instead of routing to opener/closer/middle
- `closeCropModal()` calls `processNextMediaItem()` to continue mixed photo+video queues

---

#### `index.html` — HTML changes

**Removed from Photos & video section:** opener slot, closer section, media choice toggle, video clips section, middle photos section, all switch links

**Added:** `#video-modal` (trim+crop modal); `#media-tray` (unified SortableJS strip); `#add-media-btn` + `#media-file-input` (single picker, `accept="image/*,video/*" multiple`); `#media-status-line`; `#video-scrubber-wrap`; `#tray-warning`

---

#### `index.html` — CONFIG additions

- `maxUploadConcurrency: 2`

---

#### `index.html` — Submit flow

- `orderId` generated on first upload, not at submit time
- `uploadAllMedia()` deleted; uploads happen in the background after each crop/trim confirm
- Submit validates that all `state.media[].status === 'uploaded'`; shows "X items uploading…" hint near submit button while pending
- Progress overlay now used only for webhook POST + Stripe session creation
- Payload built from `state.media[]` positions

---

#### `index.html` — SortableJS

`onMove` callback prevents video items from being dragged to position 0 (opener) or last (closer). `onEnd` rebuilds `state.media` in new order and re-renders labels.

---

### GCP changes

None in this session.

### Current state

- `index.html` updated — **not yet pushed to GitHub**
- `cloud-function/index.js` updated — **not yet deployed** *(breaking change: video filenames `.mp4` → `.webm`; must deploy CF before pushing index.html live or video uploads will 400)*
- All other functionality (Stripe checkout, Make webhook, DNS, genre audio) unchanged

### Pending

- [ ] Deploy updated `getSignedUploadUrl` Cloud Function **before** pushing `index.html` live
- [ ] Push `index.html` to GitHub Pages after CF is deployed
- [ ] End-to-end test: add opener photo → middle photos + video clip → submit → Stripe checkout
- [ ] Test video trim+crop modal: pan/zoom, trim slider, encode, iOS Safari fallback
- [ ] Test SortableJS drag with videos: confirm videos can't reach opener/closer slots
- [ ] Test background upload status rings: pulsing → green, failed → red → retry
- [ ] Mobile testing (iPhone Safari, Android Chrome)
- [ ] Tighten GCS CORS `origin` from `*` to `https://order.instatoast.com`
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket
- [ ] Verify Country and Pop Punk audio preview files in GCS
- [ ] Add dancing toast animation to order complete screen

---

## Session 5 — 2026-04-06

### What changed

**Replaced the flat 10-photo section with a structured media input system.** All other form sections (shoutout, tone, genre, About you, Review, Stripe checkout) are unchanged.

#### `index.html` — Photos & video section (full replacement)

**New form flow (progressive reveal):**
1. **Opening photo** — always visible; single photo slot, straight into crop modal on add
2. **Closing photo** — appears once opener is set; same single slot UI
3. **Media choice** — appears once both bookends are set; "📷 Photos only" / "🎬 Photos + video" toggle
4. **Video clips** — appears if "Photos + video" chosen; clip list, total scrubber (Xs / 16s), "Photos needed: X" label (updates live), "Switch to photos only instead" escape hatch
5. **Middle photos** — appears once media choice is made; drag-to-reorder strip (SortableJS), "Add at least X photos" header that goes green when minimum is met, "Add video clips instead" escape hatch

**CONFIG changes:**
- Removed `minPhotos: 10`, `maxPhotos: 10`
- Added `maxVideoSeconds: 16`, `videoSlotSeconds: 3`, `minMiddlePhotos: 2`, `baseMiddlePhotos: 8`

**State changes:**
- Added `openerPhoto`, `closerPhoto`, `videos`, `mediaChoice`
- `photos` now holds `{ id, blob, thumbUrl }` with stable `id` for SortableJS reorder

**New functions:**
- `calcMinMiddlePhotos()` — `Math.max(2, 8 - Math.floor(totalVideoSeconds / 3))`
- `getTotalVideoSeconds()` — sum of `state.videos[].duration`
- `extractVideoThumbnail(blob)` — loads into hidden `<video>`, seeks to 0.1s, draws to canvas; timeout fallback at 5s
- `addVideoClip(file)` — reads duration, enforces 16s cap, shows inline error if exceeded
- `renderVideoClips()`, `updateVideoUI()` — live scrubber and photo-needed label
- `renderOpenerSlot()`, `renderCloserSlot()` — single-slot render with add/remove buttons
- `renderMiddlePhotos()`, `updateMiddlePhotosHeader()` — middle photo strip
- `setMediaChoice(choice)` — with confirm() guard when switching video→photos with clips
- `updateMediaSectionVisibility()` — drives all progressive reveal
- `enqueueMiddleFiles(files)` — caps queue at shortfall when below minimum
- `openFilePickerFor(target)` — sets `cropTarget` and toggles `multiple` attribute

**MediaSlot changes:**
- Added `cropTarget: 'middle'` — `'opener' | 'closer' | 'middle'`
- `confirmCrop()` routes result to opener, closer, or middle photos based on `cropTarget`
- `closeCropModal()` no longer gated on `maxPhotos` (removed)
- Removed: `init()`, `openFilePicker()`, `enqueueFiles()`, `appendThumbnail()`, `renderThumbnails()`, `removePhoto()` — replaced by standalone functions

**Payload additions** (existing fields preserved):
```
opener_photo_url, closer_photo_url, video_urls, video_count, total_video_seconds
```

**Upload flow** (`uploadAllMedia`):
1. Opener → `media_inputs/opener.jpg`
2. Closer → `media_inputs/closer.jpg`
3. Middle photos → `media_inputs/photo_01.jpg` … in drag order
4. Video clips → `media_inputs/video_01.mp4` … (content-type `video/mp4` regardless of original format)

**Other changes:**
- SortableJS 1.15.2 CDN added before CropperJS script at bottom of `<body>`
- Progress overlay title changed from "Uploading photos…" to "Uploading your media…"
- Storage notice updated to "Photos and videos aren't saved if you refresh…"
- `mediaChoice` added to localStorage persistence
- Summary "Photos" row replaced with "Media" row: `1 opening · X photos · Y video clips · 1 closing`
- Section `<h2>` changed from "Photos" to "Photos & video"
- `escapeHtml()` helper added for safe clip filename rendering

#### `cloud-function/index.js` — `getSignedUploadUrl` rewrite

- Request body changed from `{ orderId, photoIndex, contentType }` to `{ orderId, mediaType, index, contentType }`
- `mediaType` values: `'opener'` | `'closer'` | `'photo'` | `'video'`
- `opener` / `closer`: no `index` required; generates `opener.jpg` / `closer.jpg`
- `photo`: index 1–50; generates `photo_XX.jpg`
- `video`: index 1–20; accepts `video/mp4`, `video/quicktime`, `video/webm`; generates `video_XX.mp4`
- `createCheckoutSession` unchanged

### GCP changes

None in this session — Cloud Function source updated but not yet deployed.

### Current state

- `index.html` updated with new media input system — not yet pushed to GitHub
- `cloud-function/index.js` updated — not yet deployed (breaking change to `getSignedUploadUrl` API; must deploy before pushing `index.html` live)
- All other form sections unchanged; Stripe checkout, Make webhook, DNS all still working once deployed

### Pending

- [ ] Deploy updated `getSignedUploadUrl` Cloud Function to GCP before pushing `index.html` to GitHub Pages
- [ ] End-to-end test: opener + closer + middle photos + optional video → webhook → embedded checkout
- [ ] Mobile testing (drag-to-reorder, video thumbnail extraction, file pickers)
- [ ] Tighten GCS CORS `origin` from `*` to `https://order.instatoast.com`
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket
- [ ] Verify Country and Pop Punk audio preview files are in GCS (`hb_country.mp3`, `hb_pop_punk.mp3`)
- [ ] Add dancing toast animation to the order complete screen (`showOrderComplete()` in `index.html`)
- [ ] Clean up Stripe checkout appearance/payment method ordering in Dashboard

---

## Session 7 — 2026-04-12

### What changed

**Unified media tray — merged opener/closer back into single drag-to-reorder tray.**

#### `index.html` — HTML

- Removed separate bookend row (opener/closer photo slots) and their dedicated file inputs
- Removed `middle-section` conditional wrapper — tray is always visible
- Single `#media-tray` + `#add-media-btn` + `#media-file-input` for all media
- Added `#media-requirements` counter element below add button
- Video scrubber label updated from `16s` to `18s`

#### `index.html` — CSS

- Removed all `.bookend-*` styles
- Added `.tray-position-label` — shows "opener" / "closer" below first and last tray items
- Added `.tray-video-warning` — red "must be photo" warning when video at first/last
- Added `.media-requirements` with `.req-met` / `.req-unmet` classes

#### `index.html` — CONFIG

- `maxVideoSeconds`: 16 → 18
- `minMiddlePhotos` / `baseMiddlePhotos` → `minPhotos: 4` / `basePhotos: 10` (total including opener/closer)

#### `index.html` — State

- Removed `state.openerPhoto` and `state.closerPhoto`
- `state.media[]` is the single source of truth — position 0 = opener, last = closer

#### `index.html` — Functions removed

`renderBookendSlot`, `removeBookendPhoto`, `updateMiddleSectionVisibility`

#### `index.html` — Functions added

`updateRequirementsCounter()` — live counter: "Add X more photos" / "Photos: ✓" + video seconds remaining

#### `index.html` — Key function changes

- `calcMinMiddlePhotos()` → `calcMinPhotos()` (base 10, floor 4, -1 per 3s video)
- `renderMediaTray()` — position labels + video-at-bookend warning
- `doUpload()` / `resolveUploadTarget()` — removed opener/closer mediaType
- `validateAll()` — first/last must be photos, total photos ≥ calcMinPhotos()
- `handleSubmit()` — derives opener/closer from position; adds `media_order` array
- Init block — removed opener/closer file input listeners

### Current state

- `index.html` updated — not yet pushed
- Cloud Function unchanged (still needs deployment from Session 6)

### Pending

- [ ] Deploy updated `getSignedUploadUrl` Cloud Function before pushing `index.html` live
- [ ] Push `index.html` to GitHub Pages after CF is deployed
- [ ] End-to-end test: photos + videos → reorder → verify warnings → submit
- [ ] Mobile testing (unified tray, drag-to-reorder)
- [ ] Tighten GCS CORS origin
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket

---

## Session 8 — 2026-04-13

### What changed

**Dynamic photo/video budget interaction** — photos and video now share a budget that adjusts in real time as users add media.

#### `index.html` — New function

`calcMaxVideoSeconds()` — `max(0, maxVideoSeconds(18) - max(0, photoCount - minPhotos(4)) * videoSlotSeconds(3))`. Each photo beyond 4 reduces available video by 3s.

#### `index.html` — Updated functions

- `updateRequirementsCounter()` — shows dynamic photo count, dynamic video budget, and a warning element (`#media-over-warning`) when:
  - Video exceeds dynamic limit: "⚠ Xs over video limit — remove video or N photos"
  - Photos reduce video (informational, only when video exists): "⚠ N extra photos reduce video by Xs"
- `updateVideoScrubber()` — scrubber max is now dynamic (`calcMaxVideoSeconds()`); fill bar turns red when over limit; label shows dynamic max
- `validateAll()` — new check: blocks submit when `totalVideoSeconds > calcMaxVideoSeconds()`
- `updateSummary()` — `mediaReady` now requires video within dynamic limit
- `VideoTrim.openModal()` — initial trim out-point capped to dynamic max, not static `CONFIG.maxVideoSeconds`

#### `index.html` — HTML

- Added `#media-over-warning` div below `#media-requirements`
- Removed `#video-total-label` and `#video-max-label` spans from scrubber (label now set entirely via innerHTML)

### Video upload investigation

Frontend video upload code is correct — `doUpload()` correctly resolves signed URLs for `mediaType: 'video'`, uploads the raw file, and stores `publicUrl`. The payload at submit correctly maps `middleVideos` to `video_urls`. **Most likely cause of video upload failures: the `getSignedUploadUrl` Cloud Function has not been redeployed since the API format changed in Session 5.** The deployed CF still expects `{ orderId, photoIndex, contentType }` but the frontend sends `{ orderId, mediaType, index, contentType }`. Photos may work if the CF was partially updated, but video `mediaType` would be rejected. **Fix: redeploy `getSignedUploadUrl` from `cloud-function/index.js`.**

### Current state

- `index.html` updated — not yet pushed
- Cloud Function unchanged — **must be deployed before video uploads will work**

### Pending

- [ ] **Deploy `getSignedUploadUrl` Cloud Function** — required for video uploads to work
- [ ] Push `index.html` to GitHub Pages after CF is deployed
- [ ] End-to-end test: photos + videos with dynamic budget warnings
- [ ] Mobile testing
- [ ] Tighten GCS CORS origin
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket

---

## Session 9 — 2026-04-13

### What changed

#### `index.html` — payload fixes

- `video_metadata` entries now include `container_w` and `container_h` — required for the Make.com pipeline to reconstruct FFmpeg crop coordinates correctly (pan values are in display pixels relative to the crop frame, which is responsive and varies by screen size)
- `media_order` changed from a flat URL array to `[{ url, type }]` objects — Make.com code block can now iterate in sequence and branch on `type: "photo"` vs `type: "video"` without cross-referencing other arrays

#### `index.html` — VideoTrim bug fixes

- `VideoTrim._initTrimSlider` `onMove`: out-point cap was using `CONFIG.maxVideoSeconds` (static 18s) instead of `calcMaxVideoSeconds()` (dynamic based on photo count) — trim slider out-thumb now correctly respects photo-based video budget
- `VideoTrim.updateDurationInfo`: "Xs remaining" label had same static vs dynamic bug — now shows correct remaining budget

#### `index.html` — video budget gate at file picker

- Videos are now blocked at the file-picker stage when `calcMaxVideoSeconds() - getTotalVideoSeconds() <= 0`; shows "no video budget left — remove existing videos or photos to make room" instead of silently opening the trim modal and forcing a 1-second clip

#### `index.html` — CONFIG

- `maxMediaItems`: 50 → 22 (theoretical max is 18 × 1s clips + 4 floor photos = 22)

### Current state

- `index.html` pushed to GitHub Pages
- Cloud Function unchanged — still needs deployment before video uploads will work

### Pending

- [ ] **Deploy `getSignedUploadUrl` Cloud Function** — required for video uploads to work
- [ ] End-to-end test: photos + videos with dynamic budget warnings
- [ ] Mobile testing
- [ ] Tighten GCS CORS origin
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket

---

## Session 10 — 2026-04-13

### What changed

All changes in `index.html`, pushed to `main` on GitHub Pages.

#### Story mode tabs (new)

- "Their story" section now has two tabs: **Step by step** (structured 3-field: action 40 chars / when 40 chars / result 50 chars) and **Have a funny story?** (free-write textarea, 150 chars)
- Live character counters on all story fields; counter colour shifts near/at limit
- `selectStoryMode(mode)` toggles panel visibility and tab active states
- `buildShoutout()` branches on `state.storyMode`; `validateAll()` and `validateField()` branch accordingly
- `shoutout_mode` added to webhook payload (`'structured'` | `'freewrite'`); `shoutout_action/when/result` are `null` in freewrite mode
- localStorage saves/restores `storyMode`

#### Genre dial selector (new)

- Replaced flat genre list with a scroll-snap dial (256px viewport, masked top/bottom)
- `renderGenres()` builds `.genre-dial-item` pills with name, description, and audio indicator
- `updateDialCentered()` highlights the item closest to the visible centre on each scroll event
- `scrollToSelected()` called on init to snap saved selection into view
- `selectGenre()` auto-plays audio preview on selection, shows animated bars indicator while playing
- Spacer divs at top/bottom of track eliminate dead scroll space at list ends
- Storage restore updated to `.genre-dial-item` selector

#### Bug fixes

- **Freewrite textarea background** was `var(--bg)` (purple) — fixed to `var(--surface)` (white)
- **Crop modal missing X button** — added close button to crop modal header (video modal already had one); wired to `MediaSlot.closeCropModal()`
- **Genre dial dead space** — replaced 100px CSS padding with 98px invisible spacer divs so list ends flush with no overscroll gap
- **Order ID timezone** — was using local time (`getHours` etc); changed to UTC (`getUTCHours` etc)

### Current state

- `index.html` pushed to GitHub Pages (commit `b2ed9f4`)
- Cloud Function unchanged — still needs deployment before video uploads will work

### Pending

- [ ] **Deploy `getSignedUploadUrl` Cloud Function** — required for video uploads to work
- [ ] End-to-end test: full form including story tabs and genre dial
- [ ] Mobile testing
- [ ] Tighten GCS CORS origin
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket

---

## Session 11 — 2026-04-14

### What changed

All changes in `index.html`, pushed to `main` on GitHub Pages (commit `4821a42`).

#### Bug fix — media hint flip

- `calcMinPhotos()`: changed `Math.floor` to `Math.ceil` when computing video slot reduction
- Root cause: fractional video (e.g. 2s of a 3s slot) gave `floor(2/3) = 0` reduction, keeping `minPhotos` at 10; adding the suggested photo then cut `maxVideoSeconds` to 0, making existing video "over budget" — user saw "add 1 photo" → add it → "remove one"
- With `ceil`, any video in a slot counts as filling that slot; mathematically provable that "add photo" suggestions can no longer create a video overflow

#### Video trim UX overhaul

- **Drag-the-fill (window drag)**: grabbing the highlighted region between the two trim thumbs now slides both handles together, preserving the selected duration — replaces having to individually nudge each thumb when repositioning; mirrors iOS Photos trim behaviour
- **RAF-throttled seeks**: during drag, `inPoint`/`outPoint` and the UI (thumbs, labels) update on every event, but `videoEl.currentTime` is set at most once per animation frame via `requestAnimationFrame`; eliminates the seek queue buildup that made the slider feel stuck on large files
- **Seek-then-play**: `playPreview()` now listens for the `seeked` event before calling `.play()`, so playback always starts from `inPoint` rather than wherever the browser happened to be mid-seek
- `trim-fill` CSS: changed `pointer-events: none` → `cursor: grab` + `touch-action: none` to support the new window drag

### Current state

- `index.html` pushed to GitHub Pages (commit `4821a42`)
- Cloud Function unchanged — still needs deployment before video uploads will work

### Pending

- [ ] **Deploy `getSignedUploadUrl` Cloud Function** — required for video uploads to work
- [ ] End-to-end test: full form including video trim
- [ ] Mobile testing
- [ ] Tighten GCS CORS origin
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket

---

## Session 12 — 2026-04-14

### What changed

All changes in `index.html`.

#### iPhone MOV rotation fix — `getVideoRotation()`

- Added `async function getVideoRotation(file)` that reads the first 512 KB of an MP4/MOV file as an `ArrayBuffer`, walks the `moov → trak → tkhd` box hierarchy, and returns the rotation angle (0 / 90 / 180 / 270) from the tkhd transformation matrix
- `loadedmetadata` handler made `async`; after getting `videoWidth/videoHeight` from the `<video>` element, calls `getVideoRotation()`; swaps `rawW`/`rawH` only when rotation is 90°/270° AND `rawW > rawH` (i.e. browser returned pre-rotation landscape dims for a portrait video)
- Comment added at `this.videoW = rawW` explaining the two-step source (browser element + tkhd correction)
- `videoRotation: 0` added as an initialised property on the `VideoTrimUI` object

#### Payload additions — `video_rotation` and `video_duration`

- `trimMeta` now stores `videoRotation` alongside `videoW`/`videoH`
- Webhook payload builder emits `video_rotation` and `video_duration` (`outPoint − inPoint`, in seconds) for each video item in `media_order`

#### Opener now allows video; closer remains photo-only

- Removed the validation check that blocked videos in the first (opener) position
- "At least 2 items" error message updated to reflect closer-only restriction
- Tray position warning badge ("must be photo") now only appears on the closer, not the opener
- Hint text updated: "The last item must be a photo (closer). Opener can be a photo or video."

#### Video crop — full video visible with dimmed overlay

- Added `.video-crop-wrapper` div around the crop frame in HTML; wrapper has `overflow: hidden`, 4:5 aspect ratio, black background — clips video at modal edges while showing the full frame
- Removed `overflow: hidden` and `clip-path` from `.video-crop-frame`; crop frame now sized as 80% of wrapper height with the 864:1115 aspect ratio
- `::after` pseudo-element gets `box-shadow: 0 0 0 9999px rgba(0,0,0,0.5)` to dim the area outside the crop box — same visual treatment as the photo cropper
- Play overlay bumped to `z-index: 3` to render above the dimming layer
- No JS changes required — `clientWidth/clientHeight` still measure the crop frame correctly for all scale/pan/crop-coordinate math

### Current state

- `index.html` pushed to GitHub Pages

### Pending

- [ ] **Deploy `getSignedUploadUrl` Cloud Function** — required for video uploads to work
- [ ] End-to-end test: full form including video trim and rotation correction
- [ ] Mobile testing
- [ ] Tighten GCS CORS origin
- [ ] Remove `allUsers` objectCreator from `instatoast-videos` bucket
