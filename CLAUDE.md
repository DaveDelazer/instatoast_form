# CLAUDE.md — Instatoast Order Form

This file is the primary context document for Claude Code sessions working on the Instatoast order form. Read this before writing any code.

## Session protocol

At the start of every session: read `CHANGELOG.md` to understand current project state, what has been deployed, and what is pending.

At the end of every session: append a new entry to `CHANGELOG.md` summarising what changed, what was deployed, and what is still pending.

---

## What this is

A customer-facing order form for Instatoast (instatoast.com) — a personalized birthday video product. Customers fill in details about the recipient, upload photos, choose a music genre and tone, and are redirected to Stripe to pay. The form collects all data needed to trigger the video production pipeline.

This is a standalone web page (not part of the Carrd website). It is embedded into the Carrd site via iframe. The hosting location is to be decided at build time — consider GitHub Pages, GCP, or similar static hosting. Choose the simplest option that supports direct browser-to-GCP uploads without CORS issues.

---

## Tech stack

- **Frontend:** Single HTML file with vanilla JS and CSS (no frameworks)
- **Photo cropping:** cropperjs library (handles touch/mobile natively)
- **Storage:** Google Cloud Storage — bucket name: `instatoast-videos`
- **Pipeline trigger:** Make.com webhook (URL: `YOUR_MAKE_WEBHOOK_URL`)
- **Payment:** Stripe — redirect to payment link after successful submission
- **Backend:** No server required — browser uploads directly to GCP, then fires webhook

---

## GCP folder structure

Every order gets its own folder keyed by a generated order ID.

```
instatoast-videos/
  instatoast/
    orders/
      {order_id}/
        media_inputs/
          photo_01.jpg
          photo_02.jpg
          ...
        output/
          final_video.mp4
```

- `order_id` format: `{YYMMDD}-{HHMM}-{4-char random alphanumeric}` e.g. `260319-1423-a3f2`
- Generated at form submission time, before upload begins
- Sent in the payload so Make and NCA Toolkit can construct the output path

---

## Payload shape

This is what the form POSTs to the Make webhook. Field names are exact — do not rename without updating the Make scenario mapping and Airtable fields.

```json
{
  "order_id": "260319-1423-a3f2",
  "sender_name": "Dave",
  "sender_email": "dave@example.com",
  "recipient_name": "Kenny",
  "occasion": "birthday",
  "shoutout_action": "Takes off her jeans",
  "shoutout_when": "The second she gets home",
  "shoutout_result": "Lives in sweats 24/7",
  "shoutout_full": "Takes off her jeans, the second she gets home, and lives in sweats 24/7",
  "tone": "sweet",
  "genre": "reggae",
  "photo_urls": [
    "https://storage.googleapis.com/instatoast-videos/instatoast/orders/260319-1423-a3f2/media_inputs/photo_01.jpg",
    "https://storage.googleapis.com/instatoast-videos/instatoast/orders/260319-1423-a3f2/media_inputs/photo_02.jpg"
  ],
  "photo_count": 2,
  "consent": true,
  "submitted_at": "2026-03-19T13:00:00Z"
}
```

Notes:
- `occasion` is always `"birthday"` in v1 — hardcoded, not shown in UI
- `tone` is an integer 0–100 (0 = grandma safe, 100 = full roast)
- `genre` is the config key string, not the display name
- `photo_urls` are GCP public URLs, uploaded before webhook fires
- Photos upload to GCP first. Only if all uploads succeed does the webhook fire.

---

## Photo crop specification

The crop box must be locked to exactly this ratio to match the FFmpeg compositing layout:

- **Width:** 864px
- **Height:** 1115px
- **Aspect ratio:** 864:1115 (do not round — use exact values)

This matches the image slot position in the video template (X: 105px, Y: 281px in the full frame).

---

## Submission flow

1. User completes form
2. Client-side validation runs
3. `order_id` is generated
4. Photos upload sequentially to GCP (`instatoast/orders/{order_id}/photos/`)
5. On all uploads successful: POST payload to Make webhook
6. On webhook 200: redirect to Stripe payment link
7. On any failure: show error, do not redirect, allow retry

---

## Config block

The HTML file has a CONFIG object at the very top of the `<script>` section. All values that Dave might want to change without touching real code live here — genre names, audio URLs, prompt text, limits, webhook URL, Stripe link, bucket name. Anything below the config block is implementation. See `INSTATOAST_FORM.md` for full config documentation.

---

## Extension points (do not close these off)

- **Video support:** The media upload component should be built as a `MediaSlot` module with a `type` config flag (`"photo"` | `"video"`). v1 uses `"photo"` only. Video adds a timeline scrubber in the same component shell. Do not couple photo logic so tightly that adding video requires a rewrite.
- **Additional occasions:** `occasion` field exists in payload. UI selector can be added later. For now hardcode `"birthday"`.
- **Additional genres:** Config array — just add an entry.

---

## Mobile

Mobile is a first-class requirement, not an afterthought. The form must be fully usable on a phone. Single column layout, large tap targets, thumb-reachable primary actions. The cropperjs touch handling covers the crop tool. Test on mobile before considering anything done.


---

## GCP CORS — required before uploads will work

The `instatoast-videos` bucket currently has CORS disabled. Browser-to-GCP direct uploads will be blocked until this is configured. At the start of the build session, apply a CORS config to the bucket:

```json
[
  {
    "origin": ["*"],
    "method": ["PUT", "POST"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

Apply with: `gsutil cors set cors.json gs://instatoast-videos`

Tighten the `origin` value to the actual form URL once hosting is decided.

---

## Genre audio preview — graceful fallback

Genre `audioUrl` values may be placeholders at build time. The preview play button must only render if `audioUrl` is a real URL (not `"PLACEHOLDER"` or empty). If no valid URL exists, show a subtle "preview coming soon" label instead. The genre card should still be selectable regardless.
