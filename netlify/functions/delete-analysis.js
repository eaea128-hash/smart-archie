/**
 * CloudFrame - /api/delete-analysis
 * Legacy Netlify fallback for deleting one saved analysis.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export const handler = async (event) => {
  const corsH = cors(event.headers?.origin || '*');

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsH, body: '' };
  }

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const token = (event.headers?.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    return {
      statusCode: 401,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing token' }),
    };
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  const user = authData?.user;
  if (authErr || !user) {
    return {
      statusCode: 401,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication failed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    body = {};
  }

  const { id } = body || {};
  if (!id) {
    return {
      statusCode: 400,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing analysis id' }),
    };
  }

  const { data: record, error: lookupErr } = await supabase
    .from('analyses')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();

  if (lookupErr) {
    return {
      statusCode: 500,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: lookupErr.message }),
    };
  }

  if (!record) {
    return {
      statusCode: 404,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Analysis not found' }),
    };
  }

  if (record.user_id !== user.id) {
    return {
      statusCode: 403,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not allowed to delete this analysis' }),
    };
  }

  const { error: delErr } = await supabase
    .from('analyses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (delErr) {
    return {
      statusCode: 500,
      headers: { ...corsH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: delErr.message }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...corsH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  };
};
