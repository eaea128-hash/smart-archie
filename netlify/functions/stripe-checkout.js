/**
 * CloudFrame — /api/stripe-checkout
 * 建立 Stripe Checkout Session
 * POST body: { plan: 'pro' | 'enterprise', successUrl, cancelUrl }
 * Headers: Authorization: Bearer <supabase-token>
 */
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-04-10' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PLANS = {
  pro: {
    name: '專業版 Pro',
    price_id: process.env.STRIPE_PRICE_PRO || '',   // set in Netlify env
    amount: 1990,
    currency: 'twd',
  },
  enterprise: null, // contact sales
};

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export const handler = async (event) => {
  const corsH = cors(event.headers?.origin || '*');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsH, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsH, body: '{}' };

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 503, headers: corsH, body: JSON.stringify({ error: 'Stripe 尚未設定' }) };
  }

  const token = (event.headers?.authorization || '').replace('Bearer ', '').trim();
  if (!token) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '未提供 Token' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, headers: corsH, body: JSON.stringify({ error: '認證失敗' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: corsH, body: '{}' }; }

  const { plan = 'pro', successUrl, cancelUrl } = body;
  const planConfig = PLANS[plan];
  if (!planConfig) return { statusCode: 400, headers: corsH, body: JSON.stringify({ error: '無效方案' }) };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{
        price: planConfig.price_id,
        quantity: 1,
      }],
      metadata: { user_id: user.id, plan },
      success_url: successUrl || `${event.headers?.origin || 'https://unique-jelly-da79b4.netlify.app'}/dashboard.html?payment=success`,
      cancel_url: cancelUrl || `${event.headers?.origin || 'https://unique-jelly-da79b4.netlify.app'}/dashboard.html?payment=cancelled`,
    });

    return {
      statusCode: 200,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    };
  } catch (err) {
    console.error('[stripe-checkout]', err);
    return { statusCode: 500, headers: corsH, body: JSON.stringify({ error: err.message }) };
  }
};
