// Vercel Serverless Function for Stripe Checkout
// This creates a Stripe Checkout session for subscription payments

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
    const { priceId, tier, userEmail } = req.body;

    // Validate input
    if (!priceId || !tier) {
      return res.status(400).json({ error: 'Missing required parameters: priceId and tier' });
    }

    console.log(`[STRIPE] Creating checkout session for tier: ${tier}`);

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
      success_url: `${req.headers.origin || 'https://xyloxlime-pro.vercel.app'}/index.html?payment_success=true&tier=${tier}`,
      cancel_url: `${req.headers.origin || 'https://xyloxlime-pro.vercel.app'}/landing.html?canceled=true`,

      // Store metadata for webhook processing
      metadata: {
        tier: tier,
        product: 'Xyloclime Pro'
      },

      // If user email provided, pre-fill it
      ...(userEmail && { customer_email: userEmail }),

      // Enable automatic tax calculation (requires Stripe Tax to be enabled)
      automatic_tax: { enabled: true },

      // Allow promotional codes
      allow_promotion_codes: true,

      // Subscription options
      subscription_data: {
        metadata: {
          tier: tier,
          product: 'Xyloclime Pro'
        }
      }
    });

    console.log(`[STRIPE] Checkout session created: ${session.id}`);

    res.status(200).json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('[STRIPE] Error creating checkout session:', error);
    res.status(500).json({
      error: error.message || 'Failed to create checkout session'
    });
  }
};
