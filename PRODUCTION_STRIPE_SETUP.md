# Production Stripe Setup Guide - Xyloclime Pro
**Ready for Hundreds of Customers**

This guide provides step-by-step instructions to configure Xyloclime Pro for production with Stripe payment processing, customer management, and subscription handling at scale.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Stripe Account Setup](#stripe-account-setup)
3. [Create Products & Pricing](#create-products--pricing)
4. [Configure Environment Variables](#configure-environment-variables)
5. [Deploy API Endpoints](#deploy-api-endpoints)
6. [Configure Customer Portal](#configure-customer-portal)
7. [Set Up Webhooks](#set-up-webhooks)
8. [Update Frontend Configuration](#update-frontend-configuration)
9. [Testing Guide](#testing-guide)
10. [Go Live Checklist](#go-live-checklist)
11. [Scaling Considerations](#scaling-considerations)

---

## Prerequisites

- ✅ Vercel account (for hosting)
- ✅ Stripe account
- ✅ Firebase account (for user authentication & data)
- ✅ Domain name (optional but recommended)
- ✅ Business bank account
- ✅ Tax information ready

---

## Stripe Account Setup

### Step 1: Create Stripe Account

1. Go to https://stripe.com
2. Click **Start now** and create account
3. Verify your email address
4. Complete business profile:
   - Business name: **Xyloclime Pro** (or your company name)
   - Business type: Select appropriate type
   - Website: Your production URL
   - Phone number: Business contact
   - Address: Business address

### Step 2: Activate Account

Stripe requires activation before accepting real payments:

1. Go to **Settings** → **Account**
2. Complete **Business details**:
   - Legal business name
   - Tax ID / EIN
   - Business address
3. Add **Bank account** for payouts:
   - Routing number
   - Account number
   - Account holder name
4. Verify **Identity** (Stripe will request documents):
   - Government-issued ID
   - Business verification documents (if applicable)

⏱️ **Activation time**: 1-3 business days

---

## Create Products & Pricing

### Step 3: Create Products in Stripe

🔴 **IMPORTANT**: Do this in **TEST MODE** first, then repeat in **LIVE MODE** when ready.

#### Create Pro Plan ($29/month)

1. Go to **Products** → **Add Product**
2. Fill in details:
   ```
   Name: Xyloclime Pro
   Description: Professional weather analysis with unlimited projects and advanced features
   Statement descriptor: XYLOCLIME PRO (appears on customer credit card)
   ```
3. Click **Add pricing**:
   ```
   Price: $29.00 USD
   Billing period: Monthly (recurring every month)
   ```
4. **Save product**
5. ⭐ **Copy the Price ID** → Starts with `price_...` → You'll need this!

#### Create Enterprise Plan ($99/month)

1. **Add Product** again
2. Fill in details:
   ```
   Name: Xyloclime Enterprise
   Description: Enterprise features with API access, team collaboration, and priority support
   Statement descriptor: XYLOCLIME ENT
   ```
3. **Add pricing**:
   ```
   Price: $99.00 USD
   Billing period: Monthly (recurring every month)
   ```
4. **Save product**
5. ⭐ **Copy the Price ID** → Starts with `price_...`

### Optional: Add Annual Pricing (20% discount)

Consider offering annual plans for better retention:

```
Pro Annual: $279/year (save $69)
Enterprise Annual: $950/year (save $238)
```

---

## Configure Environment Variables

### Step 4: Get Stripe API Keys

1. In Stripe Dashboard: **Developers** → **API Keys**
2. You'll see:
   - **Publishable key**: `pk_test_...` (TEST) or `pk_live_...` (LIVE)
   - **Secret key**: `sk_test_...` (TEST) or `sk_live_...` (LIVE)

⚠️ **SECURITY WARNING**: NEVER commit secret keys to Git!

### Step 5: Add Environment Variables to Vercel

1. Go to Vercel Dashboard → Your Project
2. Click **Settings** → **Environment Variables**
3. Add these variables:

| Name | Value (Test Mode) | Value (Production) |
|------|-------------------|---------------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | (Get from Step 7) | (Get from Step 7) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same as STRIPE_PUBLISHABLE_KEY | Same as STRIPE_PUBLISHABLE_KEY |

**Environments**: Check all three:
- ✅ Production
- ✅ Preview
- ✅ Development

---

## Deploy API Endpoints

### Step 6: Verify API Files Exist

Your project should have these files in the `api/` directory:

```
api/
├── create-checkout-session.js ✅ Creates payment sessions
├── create-portal-session.js   ✅ Manages subscriptions
├── check-subscription.js       ✅ Verifies access
└── stripe-webhook.js           ✅ Handles events
```

All files are already created! Just deploy them.

### Step 7: Deploy to Vercel

```bash
# Make sure you're in the project directory
cd C:\Users\noah.edwards\xyloclime

# Deploy to production
vercel --prod
```

Your API endpoints will be available at:
```
https://your-domain.vercel.app/api/create-checkout-session
https://your-domain.vercel.app/api/create-portal-session
https://your-domain.vercel.app/api/check-subscription
https://your-domain.vercel.app/api/stripe-webhook
```

---

## Configure Customer Portal

### Step 8: Enable Customer Portal in Stripe

The Customer Portal allows customers to manage their subscriptions, update payment methods, and view invoices.

1. Go to **Settings** → **Billing** → **Customer portal**
2. Click **Activate test link** (or **Activate** in live mode)
3. Configure portal settings:

**Customer information**:
- ✅ Allow customers to update email
- ✅ Allow customers to update billing address

**Payment methods**:
- ✅ Allow customers to update payment methods
- ✅ Save new payment methods for future use

**Subscriptions**:
- ✅ Allow customers to cancel subscriptions
- ✅ Cancellation takes effect: **At the end of billing period**
- ✅ Allow customers to switch plans
- ✅ Prorate subscription changes: **Always invoice immediately**

**Invoices**:
- ✅ Provide invoice history for: **Last 12 months**

4. Click **Save**

---

## Set Up Webhooks

### Step 9: Register Webhook Endpoint

Webhooks notify your backend when subscriptions change.

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Configure:
   ```
   Endpoint URL: https://your-domain.vercel.app/api/stripe-webhook
   Description: Xyloclime Pro Subscription Events
   ```

4. Select events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.created`
   - ✅ `customer.updated`

5. Click **Add endpoint**

6. ⭐ **Copy the Signing Secret** → Starts with `whsec_...`

7. Add to Vercel environment variables:
   ```
   Name: STRIPE_WEBHOOK_SECRET
   Value: whsec_...
   ```

8. **IMPORTANT**: Create separate webhooks for TEST and LIVE modes!

---

## Update Frontend Configuration

### Step 10: Update landing.js

Edit `landing.js` and replace placeholder values:

```javascript
// Line 4: Add your Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_live_YOUR_ACTUAL_LIVE_KEY_HERE';  // Use pk_test_ for testing

// Lines 10-13: Add your Price IDs from Step 3
const PRICE_IDS = {
    pro: 'price_1234567890abcdef',        // Your Pro monthly price ID
    enterprise: 'price_abcdef1234567890'  // Your Enterprise monthly price ID
};
```

### Step 11: Test Frontend Integration

1. Make sure Stripe.js loads:
   ```html
   <script src="https://js.stripe.com/v3/"></script>
   ```
   ✅ Already included in `landing.html`

2. Verify buttons have correct IDs:
   ```html
   <button id="pro-subscribe-btn">Subscribe to Pro</button>
   <button id="enterprise-subscribe-btn">Subscribe to Enterprise</button>
   ```
   ✅ Already configured in `landing.html`

---

## Testing Guide

### Step 12: Test in Test Mode

⚠️ **CRITICAL**: Always test thoroughly in TEST MODE before going live!

#### Test Cards

Use these test card numbers:

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | ✅ Payment succeeds |
| `4000 0000 0000 0002` | ❌ Card declined |
| `4000 0025 0000 3155` | 🔐 Requires 3D Secure authentication |
| `4000 0000 0000 9995` | ❌ Insufficient funds |

**Expiry**: Any future date (e.g., 12/25)
**CVC**: Any 3 digits (e.g., 123)
**ZIP**: Any 5 digits (e.g., 12345)

#### Test Subscription Flow

1. **Open landing page**: `https://your-domain.vercel.app/landing.html`

2. **Click "Subscribe to Pro"**
   - Should redirect to Stripe Checkout
   - URL starts with `https://checkout.stripe.com/`

3. **Fill in test payment**:
   ```
   Email: test@example.com
   Card: 4242 4242 4242 4242
   Expiry: 12/25
   CVC: 123
   Name: Test Customer
   ZIP: 12345
   ```

4. **Complete payment**
   - Should redirect back to `index.html?payment_success=true`
   - Should see success notification

5. **Check Stripe Dashboard**:
   - **Payments** → See test payment
   - **Customers** → See new customer
   - **Subscriptions** → See active subscription

6. **Test Customer Portal**:
   - Customer should be able to access portal
   - Can update payment method
   - Can cancel subscription
   - Can view invoice history

#### Test Webhooks

1. Go to **Developers** → **Webhooks** → Your endpoint
2. Click **Send test webhook**
3. Select event: `checkout.session.completed`
4. Verify your API receives and processes it
5. Check Vercel logs for confirmation

---

## Go Live Checklist

### Step 13: Pre-Launch Checklist

Before switching to LIVE mode:

#### Business Setup
- [ ] Stripe account fully activated
- [ ] Bank account added and verified
- [ ] Identity verification complete
- [ ] Tax information submitted
- [ ] Terms of Service agreed

#### Technical Setup
- [ ] All API endpoints tested in test mode
- [ ] Webhooks working correctly
- [ ] Customer Portal configured
- [ ] Email notifications working
- [ ] Error handling tested
- [ ] Refund policy defined

#### Legal & Compliance
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] Refund Policy published (e.g., 14-day money-back guarantee)
- [ ] GDPR compliance (if serving EU customers)
- [ ] PCI compliance (Stripe handles this, but document it)

#### Product Setup in LIVE Mode
- [ ] Create products in LIVE mode (repeat Step 3)
- [ ] Get LIVE Price IDs
- [ ] Update environment variables with LIVE keys
- [ ] Update landing.js with LIVE keys
- [ ] Register webhook for LIVE mode

### Step 14: Switch to Live Mode

1. **Toggle to LIVE MODE** in Stripe Dashboard
2. **Create products again** in live mode (new Price IDs!)
3. **Get LIVE API keys**
4. **Update Vercel environment variables**:
   ```
   STRIPE_SECRET_KEY = sk_live_...
   STRIPE_PUBLISHABLE_KEY = pk_live_...
   STRIPE_WEBHOOK_SECRET = whsec_live_...
   ```
5. **Update landing.js**:
   ```javascript
   const STRIPE_PUBLISHABLE_KEY = 'pk_live_...';
   const PRICE_IDS = {
       pro: 'price_live_...',
       enterprise: 'price_live_...'
   };
   ```
6. **Register webhook** for live mode
7. **Deploy to production**:
   ```bash
   vercel --prod
   ```

8. **Test with real card** (⚠️ YOU WILL BE CHARGED!):
   - Use your own credit card
   - Complete a test purchase
   - Immediately cancel in Customer Portal
   - Verify refund processes

---

## Scaling Considerations

### For Hundreds of Customers

#### 1. **Performance**
- ✅ Vercel serverless functions auto-scale
- ✅ Stripe handles millions of requests
- ✅ Firebase Firestore scales automatically
- **Action**: No changes needed for 100-1000 customers

#### 2. **Rate Limiting**
Stripe rate limits (per second):
- **Test mode**: 25 requests/second
- **Live mode**: 100 requests/second (can be increased)

**For high volume**:
- Implement retry logic with exponential backoff
- Already implemented in `api/*.js` files ✅

#### 3. **Webhook Reliability**
- Stripe retries failed webhooks automatically
- Keep webhook processing under 30 seconds
- Return 200 status immediately, process async
- **Current implementation**: ✅ Optimized

#### 4. **Database Considerations**
For hundreds of customers:
- **Firebase Free Plan**: 50K reads/day, 20K writes/day
- **Firebase Blaze Plan**: $0.06 per 100K reads

**Recommendation**: Switch to Blaze Plan when hitting 100+ customers

#### 5. **Monitoring**

Set up monitoring for:
- Failed payments → Email alerts
- Subscription cancellations → Track churn
- Webhook failures → Investigate immediately
- API errors → Vercel logs

**Tools**:
- Stripe Dashboard: Real-time metrics
- Vercel Analytics: Function performance
- Firebase Console: Usage stats

#### 6. **Customer Support**

Scale your support:
- **1-50 customers**: Manual email support
- **50-200 customers**: Help desk system (e.g., Zendesk)
- **200+ customers**: Knowledge base + live chat

#### 7. **Subscription Management**

**Handle edge cases**:
- ✅ Dunning management (Stripe handles retries)
- ✅ Upgrade/downgrade flows (Customer Portal)
- ✅ Proration (Stripe calculates automatically)
- ✅ Refunds (14-day money-back guarantee)

#### 8. **Revenue Recognition**

For compliance:
- Stripe provides detailed reports
- Track MRR (Monthly Recurring Revenue)
- Monitor churn rate
- Calculate LTV (Lifetime Value)

---

## Security Best Practices

### For Production Deployment

1. **Never expose secret keys**
   - ✅ Keep in Vercel environment variables
   - ❌ Never commit to Git
   - ❌ Never send in frontend requests

2. **Verify webhook signatures**
   - ✅ Already implemented in `stripe-webhook.js`
   - Prevents malicious webhook attacks

3. **Validate all inputs**
   - ✅ Price IDs validated
   - ✅ Customer emails sanitized
   - ✅ Metadata checked

4. **Use HTTPS everywhere**
   - ✅ Vercel provides automatic HTTPS
   - ✅ Stripe requires HTTPS for webhooks

5. **Implement rate limiting**
   - Consider adding rate limiting to API endpoints
   - Vercel provides DDoS protection

---

## Troubleshooting

### Common Issues

**❌ "Stripe publishable key not configured"**
- Update `landing.js` with your actual key
- Make sure key starts with `pk_test_` or `pk_live_`

**❌ "Failed to create checkout session"**
- Check Vercel logs for error details
- Verify STRIPE_SECRET_KEY is set correctly
- Ensure Price ID is valid

**❌ "Webhook signature verification failed"**
- STRIPE_WEBHOOK_SECRET must match Stripe Dashboard
- Webhook endpoint must be publicly accessible
- Check webhook signing secret is from correct mode (test/live)

**❌ "Payment succeeded but user not upgraded"**
- Check webhook is registered correctly
- Verify webhook is receiving events (Stripe Dashboard → Webhooks → Events)
- Check Vercel function logs

---

## Support Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Support**: https://support.stripe.com
- **Vercel Documentation**: https://vercel.com/docs
- **Firebase Documentation**: https://firebase.google.com/docs

---

## Success Metrics to Track

After going live, monitor:

1. **Financial Metrics**:
   - MRR (Monthly Recurring Revenue)
   - Churn rate
   - ARPU (Average Revenue Per User)
   - LTV (Customer Lifetime Value)

2. **Operational Metrics**:
   - New signups per day/week/month
   - Conversion rate (free → paid)
   - Failed payment rate
   - Support ticket volume

3. **Technical Metrics**:
   - API response times
   - Webhook success rate
   - Error rates
   - Uptime percentage

---

## Congratulations! 🎉

Your Xyloclime Pro platform is now production-ready with:

✅ Stripe payment processing
✅ Subscription management
✅ Customer portal
✅ Webhook event handling
✅ Scalable architecture
✅ Security best practices

**Ready to serve hundreds of customers!**

---

*Last updated: December 2025*
