// Vercel Serverless Function to Check Subscription Status
// Verifies if a user has an active subscription

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { customerId, email } = req.method === 'POST' ? req.body : req.query;

    if (!customerId && !email) {
      return res.status(400).json({
        error: 'Missing required parameter: customerId or email',
        hasAccess: false
      });
    }

    console.log(`[STRIPE] Checking subscription for customer: ${customerId || email}`);

    let customer;

    // Find customer by email if customerId not provided
    if (!customerId && email) {
      const customers = await stripe.customers.list({
        email: email,
        limit: 1
      });

      if (customers.data.length === 0) {
        return res.status(200).json({
          hasAccess: false,
          tier: 'free',
          status: 'no_subscription'
        });
      }

      customer = customers.data[0];
    } else {
      customer = await stripe.customers.retrieve(customerId);
    }

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      // Check for trialing subscriptions
      const trialingSubscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'trialing',
        limit: 1
      });

      if (trialingSubscriptions.data.length > 0) {
        const subscription = trialingSubscriptions.data[0];
        return res.status(200).json({
          hasAccess: true,
          tier: subscription.metadata.tier || 'pro',
          status: 'trialing',
          customerId: customer.id,
          subscriptionId: subscription.id,
          trialEnd: subscription.trial_end
        });
      }

      return res.status(200).json({
        hasAccess: false,
        tier: 'free',
        status: 'no_active_subscription',
        customerId: customer.id
      });
    }

    const subscription = subscriptions.data[0];

    res.status(200).json({
      hasAccess: true,
      tier: subscription.metadata.tier || 'pro',
      status: subscription.status,
      customerId: customer.id,
      subscriptionId: subscription.id,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

  } catch (error) {
    console.error('[STRIPE] Error checking subscription:', error);
    res.status(500).json({
      error: error.message || 'Failed to check subscription',
      hasAccess: false
    });
  }
};
