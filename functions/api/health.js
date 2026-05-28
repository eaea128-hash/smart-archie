/**
 * CloudFrame — /api/health
 * Lightweight health check — no external API calls.
 * Used by the frontend to determine if the AI engine is reachable.
 *
 * GET /api/health
 * Response: { status: 'ok', ai: true|false, ts: <epoch> }
 */
export async function onRequestGet({ env }) {
  const hasOpenAI  = !!env.OPENAI_API_KEY;
  const hasWorkers = !!env.AI;
  const hasAI      = hasOpenAI || hasWorkers;

  return new Response(
    JSON.stringify({
      status: 'ok',
      ai: hasAI,
      engine: hasOpenAI ? 'openai' : hasWorkers ? 'workers-ai' : 'none',
      ts: Date.now(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
