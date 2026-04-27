/**
 * CloudFrame — /api/stripe-checkout
 * 建立 Stripe Checkout Session
 * POST body: { plan: 'pro' | 'enterprise', successUrl, cancelUrl }
 * Headers: Authorization: Bearer <supabase-token>
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || '*';
  const corsH  = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsH });
  if (request.method !== 'POST') return new Response('{}', { status: 405, headers: corsH });

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Stripe 尚未設定' }), { status: 503, headers: corsH });
  }

  // Initialise clients inside handler
  const stripe   = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const PLANS = {
    pro: {
      name: '專業版 Pro',
      price_id: env.STRIPE_PRICE_PRO || '',
      amount: 1990,
      currency: 'twd',
    },
    enterprise: null, // contact sales
  };

  const token = (request.headers.get('authorization') || '').replace('Bearer ', '').trim();
  if (!token) return new Response(JSON.stringify({ error: '未提供 Token' }), { status: 401, headers: corsH });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return new Response(JSON.stringify({ error: '認證失敗' }), { status: 401, headers: corsH });

  let body;
  try { body = await request.json().catch(() => ({})); } catch { return new Response('{}', { status: 400, headers: corsH }); }

  const { plan = 'pro', successUrl, cancelUrl } = body;
  const planConfig = PLANS[plan];
  if (!planConfig) return new Response(JSON.stringify({ error: '無效方案' }), { status: 400, headers: corsH });

  try {
    const baseUrl = origin !== '*' ? origin : 'https://unique-jelly-da79b4.netlify.app';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{
        price: planConfig.price_id,
        quantity: 1,
      }],
      metadata: { user_id: user.id, plan },
      success_url: successUrl || `${baseUrl}/dashboard.html?payment=success`,
      cancel_url: cancelUrl || `${baseUrl}/dashboard.html?payment=cancelled`,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[stripe-checkout]', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsH });
  }
}
