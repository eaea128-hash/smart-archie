/**
 * CloudFrame — /api/stripe-webhook
 * 處理 Stripe 訂閱事件，更新 Supabase 用戶方案
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') return new Response('', { status: 405 });

  // Initialise clients inside handler
  const stripe   = new Stripe(env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-04-10' });
  const supabase = createClient('https://oxownfzafrveihxhuxay.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

  const sig           = request.headers.get('stripe-signature');
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  // Read raw body as text for signature verification
  const rawBody = await request.text().catch(() => '');

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const planMap = {
    // map Stripe price IDs to plan names
    [env.STRIPE_PRICE_PRO]: 'pro',
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
        const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', sub.customer).maybeSingle();
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
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
