// Vercel Serverless Function for Stripe Customer Portal
// Allows customers to manage their subscriptions, update payment methods, view invoices

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customerId } = req.body;

    // Validate input
    if (!customerId) {
      return res.status(400).json({ error: 'Missing required parameter: customerId' });
    }

    console.log(`[STRIPE] Creating portal session for customer: ${customerId}`);

    // Create Stripe Customer Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin || 'https://xyloxlime-pro.vercel.app'}/index.html`,
    });

    console.log(`[STRIPE] Portal session created: ${session.id}`);

    res.status(200).json({
      url: session.url
    });

  } catch (error) {
    console.error('[STRIPE] Error creating portal session:', error);
    res.status(500).json({
      error: error.message || 'Failed to create portal session'
    });
  }
};
