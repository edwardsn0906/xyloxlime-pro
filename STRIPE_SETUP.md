# Stripe Setup Guide for Xyloclime Pro

This guide will walk you through setting up Stripe payments for your SaaS application.

## Table of Contents
1. [Create Stripe Account](#1-create-stripe-account)
2. [Set Up Products and Pricing](#2-set-up-products-and-pricing)
3. [Get Your API Keys](#3-get-your-api-keys)
4. [Backend Setup (REQUIRED)](#4-backend-setup-required)
5. [Update Frontend Configuration](#5-update-frontend-configuration)
6. [Set Up Webhooks](#6-set-up-webhooks)
7. [Testing](#7-testing)
8. [Go Live](#8-go-live)

---

## 1. Create Stripe Account

1. Go to https://stripe.com
2. Click "Start now" or "Sign up"
3. Enter your email and create a password
4. Complete your business profile:
   - Business name: Xyloclime Pro
   - Business type: Individual or Company
   - Your website: https://xyloxlime-pro.vercel.app

**Important**: Stripe will need additional information before you can accept live payments (bank account, tax info, identity verification).

---

## 2. Set Up Products and Pricing

### Create Products in Stripe Dashboard

1. Log into https://dashboard.stripe.com
2. Make sure you're in **TEST MODE** (toggle in top right)
3. Go to **Products** → **Add Product**

### Pro Plan ($29/month)

1. **Product name**: Xyloclime Pro
2. **Description**: Professional weather analysis with unlimited projects
3. **Pricing model**: Standard pricing
4. **Price**: $29.00 USD
5. **Billing period**: Monthly
6. **Currency**: USD
7. Click **Save product**
8. **Copy the Price ID** (starts with `price_`) - you'll need this!

### Enterprise Plan ($99/month)

1. Click **Add Product** again
2. **Product name**: Xyloclime Enterprise
3. **Description**: Enterprise features with API access and team collaboration
4. **Pricing model**: Standard pricing
5. **Price**: $99.00 USD
6. **Billing period**: Monthly
7. **Currency**: USD
8. Click **Save product**
9. **Copy the Price ID** (starts with `price_`) - you'll need this!

---

## 3. Get Your API Keys

1. In Stripe Dashboard, go to **Developers** → **API Keys**
2. You'll see two keys:
   - **Publishable key** (starts with `pk_test_`) - Safe to use in frontend
   - **Secret key** (starts with `sk_test_`) - NEVER expose this! Backend only!

3. **Copy both keys** and save them securely

---

## 4. Backend Setup (REQUIRED)

**IMPORTANT**: You CANNOT create Stripe checkout sessions from the frontend for security reasons. You need a backend server.

### Option A: Vercel Serverless Functions (Recommended for your setup)

Create a new file: `api/create-checkout-session.js`

```javascript
// Vercel Serverless Function for Stripe Checkout
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId, tier } = req.body;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin}/landing.html?success=true`,
      cancel_url: `${req.headers.origin}/landing.html?canceled=true`,
      metadata: {
        tier: tier
      },
      // Enable automatic tax calculation
      automatic_tax: { enabled: true },
    });

    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
};
```

### Install Stripe SDK

Create/update `package.json`:

```json
{
  "name": "xyloclime-pro",
  "version": "1.0.0",
  "dependencies": {
    "stripe": "^14.0.0"
  }
}
```

Run: `npm install`

### Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add:
   - **Key**: `STRIPE_SECRET_KEY`
   - **Value**: Your secret key (sk_test_...)
   - **Environments**: Production, Preview, Development

---

## 5. Update Frontend Configuration

### Update `landing.js`

Replace the placeholder values:

```javascript
// Line 4: Add your publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_ACTUAL_KEY_HERE';

// Lines 7-10: Add your Price IDs
const PRICE_IDS = {
    pro: 'price_YOUR_PRO_PRICE_ID',
    enterprise: 'price_YOUR_ENTERPRISE_PRICE_ID'
};

// Lines 90-105: Update createCheckoutSession function
async function createCheckoutSession(tier, priceId) {
    const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            priceId: priceId,
            tier: tier
        })
    });

    if (!response.ok) {
        throw new Error('Failed to create checkout session');
    }

    return await response.json();
}
```

---

## 6. Set Up Webhooks

Webhooks notify your backend when subscriptions are created, canceled, or updated.

### Create Webhook Endpoint

Create `api/stripe-webhook.js`:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // Update user's subscription in Firebase
      await handleCheckoutComplete(session);
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      await handleSubscriptionChange(subscription);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

async function handleCheckoutComplete(session) {
  // Extract customer email and subscription details
  const customerEmail = session.customer_email;
  const tier = session.metadata.tier;

  // Update user in Firestore
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', customerEmail).get();

  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      subscriptionTier: tier,
      subscriptionStatus: 'active',
      stripeCustomerId: session.customer,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`User ${customerEmail} upgraded to ${tier}`);
  }
}

async function handleSubscriptionChange(subscription) {
  // Update user's subscription status in Firestore
  const customerId = subscription.customer;
  const status = subscription.status;

  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();

  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      subscriptionStatus: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Subscription ${subscription.id} status: ${status}`);
  }
}
```

### Register Webhook in Stripe

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. **Endpoint URL**: `https://your-domain.vercel.app/api/stripe-webhook`
4. **Events to send**: Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. **Copy the Signing Secret** (starts with `whsec_`)
7. Add to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

---

## 7. Testing

### Test Mode

1. Make sure Stripe is in **TEST MODE**
2. Use test card numbers:
   - **Success**: 4242 4242 4242 4242
   - **Decline**: 4000 0000 0000 0002
   - **Requires authentication**: 4000 0025 0000 3155
3. Use any future expiry date and any 3-digit CVC

### Test the Flow

1. Go to your landing page
2. Click "Subscribe to Pro"
3. Fill in test card: 4242 4242 4242 4242
4. Complete checkout
5. Verify you're redirected back with success message
6. Check Stripe Dashboard → **Payments** to see the test payment
7. Check Firebase to verify user subscription status updated

---

## 8. Go Live

### Before Going Live Checklist:

- [ ] Complete Stripe business profile
- [ ] Add bank account for payouts
- [ ] Verify your identity (Stripe will email you)
- [ ] Review and agree to Stripe's terms
- [ ] Set up automatic tax collection (see next section)
- [ ] Test all payment flows in test mode
- [ ] Set up proper error handling and logging
- [ ] Create pricing for LIVE mode (repeat Step 2 in live mode)
- [ ] Update environment variables with LIVE keys

### Switch to Live Mode:

1. Toggle to **LIVE MODE** in Stripe Dashboard
2. Create products again in live mode (get new Price IDs)
3. Get your LIVE API keys (pk_live_ and sk_live_)
4. Update Vercel environment variables with LIVE keys
5. Update `landing.js` with LIVE publishable key and Price IDs
6. Deploy to production

---

## Important Security Notes

1. **NEVER** expose your secret key (sk_test_ or sk_live_)
2. **ALWAYS** create checkout sessions on the backend
3. **ALWAYS** verify webhooks using the signing secret
4. **NEVER** trust data from the frontend - verify with Stripe API on backend
5. Use HTTPS in production (Vercel provides this automatically)

---

## Need Help?

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Support**: https://support.stripe.com
- **Test Cards**: https://stripe.com/docs/testing

---

## Quick Start Summary

1. Create Stripe account → Create products → Get API keys
2. Create `api/create-checkout-session.js` serverless function
3. Install Stripe SDK: `npm install stripe`
4. Add `STRIPE_SECRET_KEY` to Vercel environment variables
5. Update `landing.js` with publishable key and Price IDs
6. Deploy to Vercel
7. Test with card 4242 4242 4242 4242
8. Set up webhooks for subscription management
9. Go live when ready!
