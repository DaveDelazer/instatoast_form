#!/bin/bash
# Deploy createCheckoutSession Cloud Function
# Usage: STRIPE_SECRET_KEY=sk_live_... bash deploy-checkout.sh

gcloud functions deploy createCheckoutSession \
  --gen2 \
  --runtime=nodejs22 \
  --region=us-central1 \
  --source=. \
  --entry-point=createCheckoutSession \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars "STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY},STRIPE_PRICE_ID=price_1Shexr34CKOoUJtzJ9HC4Jmw,RETURN_URL=https://davedelazer.github.io/instatoast_form"
