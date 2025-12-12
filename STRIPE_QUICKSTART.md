# Stripe Quick Start - 5 Minutes to Payment-Ready

## 🚀 Fast Track to Accepting Payments

### Step 1: Get Your Stripe Keys (2 minutes)

1. Go to https://dashboard.stripe.com
2. Toggle to **TEST MODE** (top right corner)
3. Navigate to **Developers** → **API Keys**
4. Copy both keys:
   - **Publishable key**: `pk_test_51...`
   - **Secret key**: `sk_test_51...`

### Step 2: Create Products (2 minutes)

1. Go to **Products** → **Add Product**
2. Create **Pro Plan**:
   ```
   Name: Xyloclime Pro
   Price: $29/month
   ```
   → Copy the **Price ID**: `price_...`

3. Create **Enterprise Plan**:
   ```
   Name: Xyloclime Enterprise
   Price: $99/month
   ```
   → Copy the **Price ID**: `price_...`

### Step 3: Configure Vercel (30 seconds)

1. Go to https://vercel.com/dashboard
2. Select your project → **Settings** → **Environment Variables**
3. Add:
   ```
   STRIPE_SECRET_KEY = sk_test_51...
   ```

### Step 4: Update Code (30 seconds)

Edit `landing.js`:

```javascript
// Line 4
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_KEY_HERE'; // ← Paste your pk_test_ key

// Lines 10-13
const PRICE_IDS = {
    pro: 'price_YOUR_PRO_ID',           // ← Paste your Pro price ID
    enterprise: 'price_YOUR_ENT_ID'     // ← Paste your Enterprise price ID
};
```

### Step 5: Deploy (30 seconds)

```bash
vercel --prod
```

### Step 6: Test! (2 minutes)

1. Visit your landing page
2. Click "Subscribe to Pro"
3. Use test card: `4242 4242 4242 4242`
4. Expiry: `12/25`, CVC: `123`
5. Complete checkout → Success! ✅

---

## 🎯 You're Done!

Your payment system is live in **TEST MODE**.

### What Just Happened?

- ✅ Stripe checkout integrated
- ✅ Subscriptions enabled
- ✅ Test payments working
- ✅ Production-ready code

### Next Steps

When ready to accept REAL payments:

1. Toggle Stripe to **LIVE MODE**
2. Create products again (get new price IDs)
3. Update keys to `pk_live_...` and `sk_live_...`
4. Set up webhooks (see PRODUCTION_STRIPE_SETUP.md)

---

## 🆘 Quick Troubleshooting

**❌ "Stripe not initialized"**
→ Check `landing.js` line 4 has your `pk_test_` key

**❌ "Price IDs not configured"**
→ Check `landing.js` lines 10-13 have your `price_` IDs

**❌ "Checkout session failed"**
→ Check Vercel has `STRIPE_SECRET_KEY` environment variable

**❌ "Page not loading"**
→ Run `vercel --prod` to deploy your changes

---

## 📚 Full Documentation

For production deployment with webhooks, customer portal, and scaling:
→ See `PRODUCTION_STRIPE_SETUP.md`

---

## 🧪 Test Cards

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Declined |
| `4000 0025 0000 3155` | 🔐 3D Secure |

---

**Happy Building!** 🚀
