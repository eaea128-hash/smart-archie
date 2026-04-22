/**
 * CloudFrame — /api/stripe-webhook
 * 處理 Stripe 訂閱事件，更新 Supabase 用戶方案
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-04-10' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const planMap = {
    // map Stripe price IDs to plan names
    [process.env.STRIPE_PRICE_PRO]: 'pro',
  };

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan || 'pro';
        if (userId) {
          await supabase.from('profiles').update({ plan, stripe_customer_id: session.customer }).eq('id', userId);
          console.log(`[stripe-webhook] User ${userId} upgraded to ${plan}`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        // Downgrade to free on cancellation
        const sub = stripeEvent.data.object;
        const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', sub.customer).single();
        if (profile) {
          await supabase.from('profiles').update({ plan: 'free' }).eq('id', profile.id);
          console.log(`[stripe-webhook] Customer ${sub.customer} downgraded to free`);
        }
        break;
      }
      case 'invoice.payment_failed': {
        console.warn('[stripe-webhook] Payment failed for customer:', stripeEvent.data.object.customer);
        break;
      }
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err);
    return { statusCode: 500, body: 'Internal error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
