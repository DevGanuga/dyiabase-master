// Netlify Function: Handle Stripe Webhooks
// POST /.netlify/functions/stripe-webhook

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin access
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle the event
  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        await handleCheckoutComplete(session);
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object;
        await handleSubscriptionUpdate(subscription);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        await handleSubscriptionCanceled(subscription);
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        await handlePaymentFailed(invoice);
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error('Webhook handler error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function handleCheckoutComplete(session) {
  const supabaseUserId = session.metadata?.supabase_user_id || session.client_reference_id;
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  if (!supabaseUserId) {
    console.error('No Supabase user ID in session metadata');
    return;
  }

  // Get subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const plan = subscription.items.data[0]?.price?.lookup_key || 
               (subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly');

  // Update junkprofit_users with subscription info
  const { error } = await supabase
    .from('junkprofit_users')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: 'active',
      subscription_plan: plan,
      subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('auth_user_id', supabaseUserId);

  if (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }

  console.log(`Subscription activated for user ${supabaseUserId}`);
}

async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;
  const status = subscription.status; // active, past_due, canceled, etc.
  const plan = subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';

  // Map Stripe status to our status
  let ourStatus = 'inactive';
  if (status === 'active') ourStatus = 'active';
  else if (status === 'trialing') ourStatus = 'trialing';
  else if (status === 'past_due') ourStatus = 'past_due';
  else if (status === 'canceled') ourStatus = 'canceled';

  const { error } = await supabase
    .from('junkprofit_users')
    .update({
      subscription_status: ourStatus,
      subscription_plan: plan,
      subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log(`Subscription updated for customer ${customerId}: ${ourStatus}`);
}

async function handleSubscriptionCanceled(subscription) {
  const customerId = subscription.customer;

  const { error } = await supabase
    .from('junkprofit_users')
    .update({
      subscription_status: 'canceled',
      subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }

  console.log(`Subscription canceled for customer ${customerId}`);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;

  const { error } = await supabase
    .from('junkprofit_users')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('Error updating payment failed status:', error);
    throw error;
  }

  console.log(`Payment failed for customer ${customerId}`);
}

