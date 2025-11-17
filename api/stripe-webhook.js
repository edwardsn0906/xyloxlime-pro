// Vercel Serverless Function for Stripe Webhooks
// This handles subscription events from Stripe and updates Firestore

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Note: You'll need to set up Firebase Admin SDK for this to work
// For now, this is a template - see STRIPE_SETUP.md for full implementation

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[WEBHOOK] Received event: ${event.type}`);

  // Handle different event types
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('[WEBHOOK] Error processing event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// ============================================================================
// Event Handlers
// ============================================================================

async function handleCheckoutComplete(session) {
  console.log('[WEBHOOK] Checkout completed:', session.id);

  const customerEmail = session.customer_email;
  const tier = session.metadata.tier;
  const customerId = session.customer;

  // TODO: Update Firestore user document
  // This requires Firebase Admin SDK - see STRIPE_SETUP.md
  console.log(`User ${customerEmail} subscribed to ${tier}`);

  /*
  Example Firestore update:
  const usersRef = admin.firestore().collection('users');
  const snapshot = await usersRef.where('email', '==', customerEmail).get();

  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0];
    await userDoc.ref.update({
      subscriptionTier: tier,
      subscriptionStatus: 'active',
      stripeCustomerId: customerId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  */
}

async function handleSubscriptionCreated(subscription) {
  console.log('[WEBHOOK] Subscription created:', subscription.id);

  const customerId = subscription.customer;
  const status = subscription.status;
  const tier = subscription.metadata.tier;

  // TODO: Update user in Firestore
  console.log(`Subscription ${subscription.id} created for customer ${customerId}`);
}

async function handleSubscriptionUpdated(subscription) {
  console.log('[WEBHOOK] Subscription updated:', subscription.id);

  const customerId = subscription.customer;
  const status = subscription.status;

  // TODO: Update user subscription status in Firestore
  console.log(`Subscription ${subscription.id} status: ${status}`);
}

async function handleSubscriptionDeleted(subscription) {
  console.log('[WEBHOOK] Subscription deleted:', subscription.id);

  const customerId = subscription.customer;

  // TODO: Downgrade user to free tier in Firestore
  console.log(`Subscription ${subscription.id} canceled`);
}

async function handlePaymentSucceeded(invoice) {
  console.log('[WEBHOOK] Payment succeeded:', invoice.id);

  // Payment successful - subscription will remain active
  const customerId = invoice.customer;
  console.log(`Payment succeeded for customer ${customerId}`);
}

async function handlePaymentFailed(invoice) {
  console.log('[WEBHOOK] Payment failed:', invoice.id);

  // Payment failed - Stripe will retry automatically
  // You might want to send a notification to the user
  const customerId = invoice.customer;
  console.log(`Payment failed for customer ${customerId}`);
}
