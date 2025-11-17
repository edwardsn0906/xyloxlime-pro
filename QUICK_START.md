# Xyloclime Pro - Quick Start Guide

## What You've Got

I've built you a complete SaaS platform with:

1. **Professional Landing Page** (`landing.html`)
   - Hero section with compelling copy
   - Feature showcase
   - Pricing tiers (Free, Pro $29/mo, Enterprise $99/mo)
   - FAQ section
   - Professional styling

2. **Stripe Payment Integration**
   - Subscription checkout flow
   - Automatic tax calculation (Stripe Tax)
   - Secure payment processing
   - Webhook handlers for subscription management

3. **Comprehensive Documentation**
   - `STRIPE_SETUP.md` - Complete Stripe integration guide
   - `SALES_TAX_GUIDE.md` - Everything about sales tax for SaaS
   - This file - Quick start

---

## What You Need to Do Next

### 1. Set Up Stripe (30 minutes)

1. **Create Stripe Account**
   - Go to https://stripe.com and sign up
   - Complete business profile
   - Stay in TEST MODE

2. **Create Products**
   - Dashboard → Products → Add Product
   - Create "Xyloclime Pro" at $29/month
   - Create "Xyloclime Enterprise" at $99/month
   - **Copy both Price IDs** (starts with `price_test_`)

3. **Get API Keys**
   - Dashboard → Developers → API Keys
   - Copy Publishable Key (pk_test_...)
   - Copy Secret Key (sk_test_...)

4. **Enable Stripe Tax**
   - Dashboard → Settings → Tax
   - Enable Stripe Tax Complete
   - This handles ALL sales tax automatically!

### 2. Update Your Code (5 minutes)

**Edit `landing.js`** (lines 4 and 7-10):

```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_KEY_HERE'; // Paste your publishable key

const PRICE_IDS = {
    pro: 'price_test_YOUR_PRO_ID',           // Paste Pro Price ID
    enterprise: 'price_test_YOUR_ENTERPRISE_ID'  // Paste Enterprise Price ID
};
```

### 3. Configure Vercel (5 minutes)

1. Go to https://vercel.com/dashboard
2. Open your project (xyloxlime-pro)
3. Settings → Environment Variables
4. Add:
   - Key: `STRIPE_SECRET_KEY`
   - Value: `sk_test_...` (your secret key)
   - Environments: Check all three boxes

### 4. Install Dependencies (2 minutes)

```bash
cd xyloclime
npm install
```

### 5. Deploy (2 minutes)

```bash
git add .
git commit -m "Add landing page and Stripe payments"
git push origin main
```

Vercel will auto-deploy!

### 6. Test (5 minutes)

1. Visit: https://xyloxlime-pro.vercel.app/landing.html
2. Click "Subscribe to Pro"
3. Use test card: `4242 4242 4242 4242`
4. Any future expiry, any 3-digit CVC
5. Complete checkout
6. Check Stripe Dashboard → Payments

---

## How It Works

### User Flow

1. **New User**:
   - Lands on `landing.html` (marketing page)
   - Clicks "Get Started Free" → Goes to `index.html` (main app)
   - Creates account → Uses free tier (3 projects)

2. **Upgrading User**:
   - Clicks "Subscribe to Pro" on landing page
   - Stripe Checkout opens
   - Enters payment info
   - Completes purchase
   - Redirected back to app with success message

3. **Subscription Management**:
   - Stripe handles recurring billing
   - Webhooks notify your backend of changes
   - Users can cancel anytime in Stripe customer portal

### Behind the Scenes

1. **Frontend** (landing.js):
   - Initializes Stripe
   - Handles button clicks
   - Calls your backend API

2. **Backend** (api/create-checkout-session.js):
   - Creates secure Stripe checkout session
   - Handles payment processing
   - Calculates tax automatically

3. **Webhooks** (api/stripe-webhook.js):
   - Receives events from Stripe
   - Updates user subscription status
   - Handles renewals, cancellations, failures

---

## Sales Tax - The Simple Answer

**Use Stripe Tax Complete** and forget about it.

- Costs ~$100-300/month
- Automatically:
  - Monitors when you reach tax thresholds
  - Registers you in states where needed
  - Calculates correct tax on every transaction
  - Files tax returns
  - Remits payments to states
- Covers all 50 US states
- Worth every penny vs doing it manually

Read `SALES_TAX_GUIDE.md` for details.

---

## Pricing Breakdown

### Free Tier
- 3 saved projects
- Basic weather data
- 30 days history
- Perfect for trials

### Pro - $29/month
- Unlimited projects
- Full weather data
- 10 years history
- Excel/PDF export
- Your main revenue tier

### Enterprise - $99/month
- Everything in Pro
- API access
- White-label reports
- Team features
- Premium support

---

## Going Live

Once testing works:

1. **Switch Stripe to Live Mode**
   - Create products again in live mode
   - Get new live API keys (pk_live_, sk_live_)
   - Update landing.js and Vercel env vars

2. **Complete Stripe Verification**
   - Add bank account
   - Verify identity
   - Complete business profile

3. **Deploy**
   - Push updated code
   - Test with real card (small amount first!)

4. **Market**
   - Share landing page
   - Start getting customers!

---

## File Reference

| File | Purpose |
|------|---------|
| `landing.html` | Marketing/sales page |
| `landing-styles.css` | Landing page styles |
| `landing.js` | Stripe integration frontend |
| `api/create-checkout-session.js` | Payment backend |
| `api/stripe-webhook.js` | Subscription event handler |
| `index.html` | Main weather app |
| `app.js` | App logic with Firebase |
| `package.json` | Dependencies (Stripe SDK) |

---

## Need Help?

- **Stripe Issues**: Read `STRIPE_SETUP.md` (super detailed)
- **Tax Questions**: Read `SALES_TAX_GUIDE.md`
- **Stripe Support**: https://support.stripe.com
- **Test Cards**: Always use 4242 4242 4242 4242 in test mode

---

## Common Issues

**"Price IDs not configured"**
→ You didn't update landing.js with your actual Price IDs

**"Backend API not configured"**
→ Stripe secret key not in Vercel environment variables

**"Checkout doesn't open"**
→ Publishable key wrong in landing.js

**Tax not calculating**
→ Stripe Tax not enabled, or not in taxable state

---

## Success Metrics

Track these in Stripe Dashboard:

- **MRR** (Monthly Recurring Revenue)
- **Conversion Rate** (visitors → paying customers)
- **Churn Rate** (cancellations)
- **Average Revenue Per User (ARPU)**

---

## Next Steps After Launch

1. Add user subscription status to main app UI
2. Enforce project limits based on tier
3. Add upgrade prompts in free tier
4. Set up email marketing
5. Create support documentation
6. Build customer feedback loop

---

**Bottom Line**: You have everything you need. Just follow steps 1-6 above, and you'll be accepting payments within an hour!

Good luck with your launch! 🚀
