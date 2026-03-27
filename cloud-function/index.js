'use strict';

const { Storage } = require('@google-cloud/storage');
const Stripe = require('stripe');

const storage = new Storage();
const BUCKET = 'instatoast-videos';
const SIGNED_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes

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

  const { orderId, photoIndex, contentType } = req.body || {};

  if (!orderId || photoIndex == null || !contentType) {
    res.status(400).json({ error: 'Missing required fields: orderId, photoIndex, contentType' });
    return;
  }

  // Validate orderId format: YYMMDD-HHMM-xxxx (prevents path traversal)
  if (!/^\d{6}-\d{4}-[a-z0-9]{4}$/.test(orderId)) {
    res.status(400).json({ error: 'Invalid orderId format' });
    return;
  }

  const index = Number(photoIndex);
  if (!Number.isInteger(index) || index < 1 || index > 10) {
    res.status(400).json({ error: 'photoIndex must be an integer 1–10' });
    return;
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    res.status(400).json({ error: 'Invalid contentType' });
    return;
  }

  const filename = `photo_${String(index).padStart(2, '0')}.jpg`;
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
      automatic_payment_methods:  { enabled: true },
    };
    if (customerEmail) sessionParams.customer_email = customerEmail;

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({ clientSecret: session.client_secret });

  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
