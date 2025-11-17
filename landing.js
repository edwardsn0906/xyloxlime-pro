// Xyloclime Pro Landing Page - Stripe Integration

// TODO: Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_KEY_HERE'; // Get this from Stripe Dashboard

// Initialize Stripe
let stripe;

// Price IDs - These will be created in Stripe Dashboard
const PRICE_IDS = {
    pro: 'price_PRO_MONTHLY_ID', // Replace with actual Stripe Price ID for $29/month
    enterprise: 'price_ENTERPRISE_MONTHLY_ID' // Replace with actual Stripe Price ID for $99/month
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Stripe.js
    if (STRIPE_PUBLISHABLE_KEY !== 'pk_test_YOUR_KEY_HERE') {
        stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
        console.log('[STRIPE] Initialized successfully');
    } else {
        console.warn('[STRIPE] Publishable key not configured. Please update landing.js');
    }

    // Bind subscription buttons
    const proButton = document.getElementById('pro-subscribe-btn');
    const enterpriseButton = document.getElementById('enterprise-subscribe-btn');

    if (proButton) {
        proButton.addEventListener('click', () => handleSubscribe('pro'));
    }

    if (enterpriseButton) {
        enterpriseButton.addEventListener('click', () => handleSubscribe('enterprise'));
    }

    // Handle URL parameters (e.g., success/cancel redirects from Stripe)
    handleUrlParameters();
});

/**
 * Handle subscription button click
 * @param {string} tier - 'pro' or 'enterprise'
 */
async function handleSubscribe(tier) {
    if (!stripe) {
        alert('Payment system is currently being configured. Please check back soon!');
        console.error('[STRIPE] Stripe not initialized');
        return;
    }

    const button = tier === 'pro'
        ? document.getElementById('pro-subscribe-btn')
        : document.getElementById('enterprise-subscribe-btn');

    // Disable button and show loading state
    button.disabled = true;
    button.textContent = 'Loading...';

    try {
        // In production, this would call your backend API to create a checkout session
        // For now, we'll redirect to Stripe Checkout directly
        const priceId = PRICE_IDS[tier];

        if (priceId === 'price_PRO_MONTHLY_ID' || priceId === 'price_ENTERPRISE_MONTHLY_ID') {
            alert('Stripe products need to be configured. Please see STRIPE_SETUP.md for instructions.');
            console.error('[STRIPE] Price IDs not configured');
            button.disabled = false;
            button.textContent = tier === 'pro' ? 'Subscribe to Pro' : 'Subscribe to Enterprise';
            return;
        }

        // Create checkout session
        // NOTE: In production, you MUST create the checkout session on your backend
        // This is a simplified example - see STRIPE_SETUP.md for backend implementation
        const response = await createCheckoutSession(tier, priceId);

        if (response.error) {
            throw new Error(response.error);
        }

        // Redirect to Stripe Checkout
        const { error } = await stripe.redirectToCheckout({
            sessionId: response.sessionId
        });

        if (error) {
            throw new Error(error.message);
        }

    } catch (error) {
        console.error('[STRIPE] Subscription error:', error);
        alert('There was an error processing your subscription. Please try again.');

        // Re-enable button
        button.disabled = false;
        button.textContent = tier === 'pro' ? 'Subscribe to Pro' : 'Subscribe to Enterprise';
    }
}

/**
 * Create a Stripe Checkout session
 * Calls the Vercel serverless function to create a checkout session
 * @param {string} tier - Subscription tier
 * @param {string} priceId - Stripe Price ID
 * @returns {Promise<Object>} - Session data
 */
async function createCheckoutSession(tier, priceId) {
    try {
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
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create checkout session');
        }

        return await response.json();
    } catch (error) {
        console.error('[STRIPE] Error creating checkout session:', error);
        throw error;
    }
}

/**
 * Handle URL parameters after Stripe redirect
 */
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);

    // Check if user was redirected from Stripe
    if (urlParams.has('success')) {
        // Payment successful
        showNotification('Payment successful! Welcome to Xyloclime Pro!', 'success');

        // Redirect to app after a moment
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }

    if (urlParams.has('canceled')) {
        // Payment canceled
        showNotification('Payment canceled. Feel free to try again when ready!', 'info');
    }
}

/**
 * Show notification to user
 * @param {string} message - Notification message
 * @param {string} type - 'success', 'error', or 'info'
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#00ff88' : type === 'error' ? '#ff4444' : '#00d4ff'};
        color: #0a0e27;
        padding: 1.5rem 2rem;
        border-radius: 10px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translate(-50%, -100px);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translate(-50%, 0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -100px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
