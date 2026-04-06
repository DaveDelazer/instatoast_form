'use strict';

const { Storage } = require('@google-cloud/storage');
const Stripe = require('stripe');

const storage = new Storage();
const BUCKET = 'instatoast-videos';
const SIGNED_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VALID_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

exports.getSignedUploadUrl = async (req, res) => {
  // CORS — tighten origin to your form URL in production
  res.set('Access-Control-Allow-Origin', 'https://order.instatoast.com');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { orderId, mediaType, index, contentType } = req.body || {};

  if (!orderId || !mediaType || !contentType) {
    res.status(400).json({ error: 'Missing required fields: orderId, mediaType, contentType' });
    return;
  }

  // Validate orderId format: YYMMDD-HHMM-xxxx (prevents path traversal)
  if (!/^\d{6}-\d{4}-[a-z0-9]{4}$/.test(orderId)) {
    res.status(400).json({ error: 'Invalid orderId format' });
    return;
  }

  let filename;

  if (mediaType === 'opener') {
    if (!VALID_IMAGE_TYPES.includes(contentType)) {
      res.status(400).json({ error: 'Invalid contentType for opener' });
      return;
    }
    filename = 'opener.jpg';

  } else if (mediaType === 'closer') {
    if (!VALID_IMAGE_TYPES.includes(contentType)) {
      res.status(400).json({ error: 'Invalid contentType for closer' });
      return;
    }
    filename = 'closer.jpg';

  } else if (mediaType === 'photo') {
    if (!VALID_IMAGE_TYPES.includes(contentType)) {
      res.status(400).json({ error: 'Invalid contentType for photo' });
      return;
    }
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 1 || idx > 50) {
      res.status(400).json({ error: 'index must be an integer 1–50 for photo' });
      return;
    }
    filename = `photo_${String(idx).padStart(2, '0')}.jpg`;

  } else if (mediaType === 'video') {
    if (!VALID_VIDEO_TYPES.includes(contentType)) {
      res.status(400).json({ error: 'Invalid contentType for video' });
      return;
    }
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 1 || idx > 20) {
      res.status(400).json({ error: 'index must be an integer 1–20 for video' });
      return;
    }
    filename = `video_${String(idx).padStart(2, '0')}.mp4`;

  } else {
    res.status(400).json({ error: 'Invalid mediaType — must be opener, closer, photo, or video' });
    return;
  }

  const gcsPath = `instatoast/orders/${orderId}/media_inputs/${filename}`;

  try {
    const [signedUrl] = await storage.bucket(BUCKET).file(gcsPath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + SIGNED_URL_TTL_MS,
      contentType,
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET}/${gcsPath}`;
    res.json({ signedUrl, publicUrl });

  } catch (err) {
    console.error('Error generating signed URL:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

exports.createCheckoutSession = async (req, res) => {
  res.set('Access-Control-Allow-Origin', 'https://order.instatoast.com');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { orderId, customerEmail } = req.body || {};

  if (!orderId) {
    res.status(400).json({ error: 'Missing required field: orderId' });
    return;
  }

  if (!/^\d{6}-\d{4}-[a-z0-9]{4}$/.test(orderId)) {
    res.status(400).json({ error: 'Invalid orderId format' });
    return;
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const sessionParams = {
      ui_mode:                    'embedded',
      line_items:                 [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      mode:                       'payment',
      client_reference_id:        orderId,
      return_url:                 `${process.env.RETURN_URL}?order_complete=true&session_id={CHECKOUT_SESSION_ID}`,
      allow_promotion_codes:      true,
    };
    if (customerEmail) sessionParams.customer_email = customerEmail;

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({ clientSecret: session.client_secret });

  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
