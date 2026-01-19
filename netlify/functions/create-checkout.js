// Netlify Function: Create Stripe Checkout Session
// POST /.netlify/functions/create-checkout

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { priceId, userId, userEmail, couponCode } = JSON.parse(event.body);

    if (!priceId || !userId || !userEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: priceId, userId, userEmail' })
      };
    }

    // Build checkout session params
    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.URL}/app.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/landing.html#pricing`,
      customer_email: userEmail,
      client_reference_id: userId, // Supabase user ID for webhook matching
      metadata: {
        supabase_user_id: userId
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId
        }
      }
    };

    // Apply coupon if provided (e.g., GUMROAD20)
    if (couponCode) {
      sessionParams.discounts = [{ coupon: couponCode }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, url: session.url })
    };
  } catch (error) {
    console.error('Checkout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

