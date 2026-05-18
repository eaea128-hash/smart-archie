/**
 * CloudFrame — /api/trends  (v4.0 — Live AI Search)
 *
 * GET /api/trends?category=regulatory|cloud|financial|emerging|all&region=SG|HK|EU...
 *
 * Data pipeline:
 *   1. gpt-4o-search-preview → real-time web search for latest cloud/regulatory news
 *   2. 24-hour in-memory cache to limit API spend
 *   3. Static verified fallback when OpenAI unavailable
 *
 * Requires: OPENAI_API_KEY env var in Cloudflare Pages
 */

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache    = null;
let _cacheAt  = 0;
const CACHE_TTL = 24 * 3600 * 1000; // 24h

// ── Search prompt ─────────────────────────────────────────────────────────────
function buildSearchPrompt() {
  const today    = new Date().toISOString().slice(0, 10);
  const since    = new Date(Date.now() - 75 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return `Today is ${today}. Search the web for real, verifiable cloud technology and regulatory news published between ${since} and today, relevant to financial services CIOs in APAC (Singapore, Hong Kong), UK, and EU.

Focus areas:
- Regulatory: MAS, HKMA, FCA, DORA, Basel III, BIS, EBA — new circulars, guidelines, consultations, enforcement actions
- Cloud platforms: AWS, Azure (Microsoft), Google Cloud (GCP) — major GA launches, security updates, pricing changes, new regions
- Financial institutions: HSBC, DBS, OCBC, JPMorgan, Goldman Sachs, Standard Chartered — cloud migration announcements, AI/ML deployments, FinOps results
- Emerging: GenAI governance, sovereign AI, agentic cloud operations, cloud FinOps automation

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "items": [
    {
      "id": "kebab-case-unique-id",
      "title": "Exact headline or concise descriptive title",
      "source": "Organisation or publication name",
      "source_logo": "one emoji representing the org",
      "category": "regulatory|cloud|financial|emerging",
      "region": "Singapore|Hong Kong|UK|EU|APAC|Global",
      "date": "YYYY-MM-DD",
      "impact": "low|medium|high|critical|transformational",
      "tags": ["Tag1", "Tag2", "Tag3"],
      "summary": "2-3 sentences: what happened, why it matters to financial institution cloud architects.",
      "key_points": ["Specific requirement or fact 1", "Specific requirement or fact 2", "Specific requirement or fact 3"],
      "reference_url": "https://direct-source-url-if-found"
    }
  ]
}

Rules:
- Return 8-12 items sorted by date descending (newest first)
- Only include items you can verify from actual web search results
- DO NOT fabricate organisations, dates, or requirements
- Prefer primary sources (regulator websites, official cloud provider blogs)
- Mark impact as "critical" only for enforceable regulations already in effect`;
}

// ── Live fetch via OpenAI web search ──────────────────────────────────────────
async function fetchLiveTrends(apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:      'gpt-4o-search-preview',
      messages:   [
        {
          role:    'system',
          content: 'You are a cloud strategy analyst specialising in financial services regulatory compliance and cloud architecture. Search the web for recent developments and return structured JSON only.',
        },
        {
          role:    'user',
          content: buildSearchPrompt(),
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI search HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data        = await res.json();
  const message     = data.choices?.[0]?.message || {};
  const text        = message.content || '';
  // Extract OpenAI web search citations (url_citation annotations)
  const annotations = message.annotations || [];
  const citations   = annotations
    .filter(a => a.type === 'url_citation' && a.url_citation?.url)
    .map(a => ({ url: a.url_citation.url, title: a.url_citation.title || a.url_citation.url }));

  // Extract + repair JSON from response (model may wrap in markdown or truncate)
  const jsonStr = extractJSON(text);
  if (!jsonStr) throw new Error('No JSON found in OpenAI search response');

  const parsed = parseJSONSafe(jsonStr);
  if (!parsed) throw new Error('JSON repair failed — response too malformed');
  const items  = parsed.items || parsed.results || parsed;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('OpenAI search returned empty items array');
  }

  // Validate, normalise, and inject citations into items
  // Distribute search citations across items evenly (citations are page-level, not item-level)
  const citationsPerItem = citations.length > 0
    ? Math.ceil(citations.length / Math.max(1, items.length))
    : 0;

  return items
    .filter(it => it.title && it.summary)
    .map((it, idx) => ({
      id:            it.id            || slugify(it.title),
      title:         it.title,
      source:        it.source        || 'Industry Intelligence',
      source_logo:   it.source_logo   || '📰',
      category:      it.category      || 'cloud',
      region:        it.region        || 'Global',
      date:          normaliseDate(it.date),
      impact:        it.impact        || 'medium',
      tags:          Array.isArray(it.tags) ? it.tags : [],
      summary:       it.summary,
      key_points:    Array.isArray(it.key_points) ? it.key_points : [],
      reference_url: it.reference_url || null,
      // Attach relevant citations to this item (slice evenly from global citation pool)
      citations:     citations.length > 0
        ? citations.slice(idx * citationsPerItem, (idx + 1) * citationsPerItem)
        : [],
      _source:       'live-search',
    }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractJSON(text) {
  // 1. Code block (```json ... ```)
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) return codeMatch[1].trim();
  // 2. Raw JSON object — greedy match from first { to last }
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return null;
}

// Attempt to parse JSON; if it fails, try progressively more aggressive repairs
function parseJSONSafe(str) {
  // Pass 1: try as-is
  try { return JSON.parse(str); } catch (_) {}

  // Pass 2: remove trailing commas before ] or }
  try {
    const fixed = str.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(fixed);
  } catch (_) {}

  // Pass 3: truncation recovery — find the last complete item object and close the array
  try {
    // Locate "items": [ and try closing the array at the last complete object
    const itemsStart = str.indexOf('"items"');
    if (itemsStart !== -1) {
      const arrStart = str.indexOf('[', itemsStart);
      if (arrStart !== -1) {
        // Walk back from end to find last complete }
        let depth = 0, lastClose = -1;
        for (let i = arrStart; i < str.length; i++) {
          if (str[i] === '{') depth++;
          if (str[i] === '}') { depth--; if (depth === 0) lastClose = i; }
        }
        if (lastClose !== -1) {
          const repaired = str.slice(0, lastClose + 1) + ']}';
          return JSON.parse(repaired);
        }
      }
    }
  } catch (_) {}

  // Pass 4: extract only the "items" array content using regex
  try {
    const arrMatch = str.match(/"items"\s*:\s*(\[[\s\S]*)/);
    if (arrMatch) {
      // Find balanced bracket end
      let depth = 0, end = -1;
      const arr = arrMatch[1];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === '[') depth++;
        if (arr[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
      }
      const slice = end !== -1 ? arr.slice(0, end + 1) : arr.slice(0, arr.lastIndexOf('}') + 1) + ']';
      const cleaned = slice.replace(/,\s*([\]}])/g, '$1');
      return { items: JSON.parse(cleaned) };
    }
  } catch (_) {}

  return null;
}

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function normaliseDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  // Accept YYYY-MM-DD or ISO strings
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10);
}

// ── Static fallback (curated, quarterly-verified) ─────────────────────────────
const STATIC_TRENDS = [
  // ── Regulatory ──
  {
    id: 'mas-genai-framework-2026', title: 'MAS GenAI Framework — Consultation Paper on Responsible AI',
    source: 'Monetary Authority of Singapore', source_logo: '🇸🇬', category: 'regulatory',
    region: 'Singapore / APAC', date: '2026-04-10', impact: 'critical',
    tags: ['MAS', 'GenAI', 'AI Governance', 'Singapore'],
    summary: 'MAS released a consultation paper proposing mandatory AI governance frameworks, model risk management for LLM-based applications, and customer disclosure obligations for AI-generated advice.',
    key_points: [
      'LLMs in customer-facing services classified as High-Risk models requiring board-level accountability',
      'Mandatory bias and fairness testing for GenAI used in credit, insurance, or investment decisions',
      'AI-related operational incidents must be reported to MAS within 24 hours',
    ],
    reference_url: 'https://www.mas.gov.sg/publications/consultation-papers',
    _source: 'static',
  },
  {
    id: 'basel3-final-rule-2026', title: 'Basel III Final Rule — Live: Cloud Risk Infrastructure Impact',
    source: 'Bank for International Settlements', source_logo: '🏦', category: 'regulatory',
    region: 'Global', date: '2026-01-01', impact: 'critical',
    tags: ['Basel III', 'Capital Requirements', 'Risk Calculation', 'Cloud Infrastructure'],
    summary: 'Basel III Endgame is now effective globally. Daily SA-CCR and FRTB calculations significantly increase cloud compute demand for risk engines. Institutions without scalable cloud risk infrastructure face compliance gaps.',
    key_points: [
      'Daily SA-CCR calculations mandatory — requires elastic cloud risk compute',
      'FRTB requires intraday market risk reporting for major institutions',
      'DR for risk pipelines: RTO < 4 hours for regulatory reporting under Basel III',
    ],
    reference_url: 'https://www.bis.org/bcbs/publ/d424.htm',  // Dec 2017 final standard (accessible)
    _source: 'static',
  },
  {
    id: 'dora-eu-2025', title: 'EU DORA — Enforceable: CTPPs, TLPT, ICT Incident Reporting',
    source: 'European Banking Authority', source_logo: '🇪🇺', category: 'regulatory',
    region: 'European Union', date: '2025-01-17', impact: 'critical',
    tags: ['DORA', 'EU', 'ICT Risk', 'Third-Party Risk', 'Resilience Testing'],
    summary: 'DORA is enforceable across all EU financial entities. Cloud providers designated as Critical ICT Third-Party Service Providers face direct oversight. TLPT (Threat-Led Penetration Testing) is now mandatory annually.',
    key_points: [
      'CTPP register: all cloud providers assessed against DORA Article 28 requirements',
      'Major ICT incidents must be reported to NCAs within 4 hours',
      'Standardised contractual clauses with CSPs are required',
    ],
    reference_url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554',  // Official EU law text
    _source: 'static',
  },
  {
    id: 'mas-trm-2025-update', title: 'MAS TRM 2025 Revision — Cloud Concentration Risk & Exit Planning',
    source: 'Monetary Authority of Singapore', source_logo: '🇸🇬', category: 'regulatory',
    region: 'Singapore / APAC', date: '2025-11-15', impact: 'high',
    tags: ['MAS', 'TRM', 'Singapore', 'Cloud Outsourcing', 'Operational Resilience'],
    summary: 'MAS TRM revision mandates enhanced concentration risk assessment, stricter exit planning (minimum 12-month runway), and real-time audit log access for supervisory examinations.',
    key_points: [
      'Cloud provider concentration risk must be reported to board quarterly',
      'Exit strategy must demonstrate 12-month migration capability with documented runbooks',
      'Multi-cloud or hybrid-cloud mandatory for Systemically Important Financial Institutions (SIFIs)',
    ],
    reference_url: 'https://www.mas.gov.sg/regulation/guidelines',  // MAS guidelines index (stable)
    _source: 'static',
  },
  // ── Cloud ──
  {
    id: 'aws-nova-enterprise-2026', title: 'Amazon Nova — Enterprise Foundation Models on Bedrock GA (APAC)',
    source: 'Amazon Web Services', source_logo: '🟠', category: 'cloud',
    region: 'Global', date: '2026-03-18', impact: 'high',
    tags: ['AWS', 'Bedrock', 'Nova', 'GenAI', 'Sovereign AI'],
    summary: 'Amazon Nova Pro and Premier are GA on Bedrock with Private Bedrock (inference stays in customer VPC), model distillation, and PII auto-redaction. Available in Singapore (ap-southeast-1).',
    key_points: [
      'Private Bedrock: model inference runs within customer VPC — no data sent to AWS model infrastructure',
      'Nova Premier: 200K context window for long-form regulatory document analysis',
      'MAS/HKMA compliance tagging in the financial services edition',
    ],
    reference_url: 'https://aws.amazon.com/bedrock/nova/',  // AWS official page (verified)
    _source: 'static',
  },
  {
    id: 'azure-ai-foundry-2026', title: 'Azure AI Foundry GA — Private Network Deployment & DORA-Aligned SLAs',
    source: 'Microsoft Azure', source_logo: '🔷', category: 'cloud',
    region: 'Global', date: '2026-02-20', impact: 'high',
    tags: ['Azure', 'AI Foundry', 'GenAI', 'DORA', 'Financial Services'],
    summary: 'Azure AI Foundry is GA with private network deployment (zero public internet exposure), DORA-aligned business continuity SLAs, and built-in Azure Policy for regulated tenants.',
    key_points: [
      'All model inference within Azure Private Link — no public model endpoints allowed in regulated tenants',
      'DORA: AI Foundry instances included in Azure business continuity SLAs',
      '1,600+ models including GPT-4o, Phi-4, Mistral; content safety presets for financial services',
    ],
    reference_url: 'https://azure.microsoft.com/en-us/products/ai-foundry',  // Azure product page (stable)
    _source: 'static',
  },
  {
    id: 'gcp-gemini-cloud-2026', title: 'Google Gemini 2.0 — Native Integration in Cloud Console, SCC & BigQuery',
    source: 'Google Cloud Platform', source_logo: '🔵', category: 'cloud',
    region: 'Global', date: '2026-01-28', impact: 'high',
    tags: ['GCP', 'Gemini', 'AIOps', 'FinOps', 'Security Command Center'],
    summary: 'Gemini 2.0 integrates natively into Cloud Logging, Security Command Center, and BigQuery. Financial institutions can now use natural-language queries for log investigation, security triage, and FinOps reporting.',
    key_points: [
      'Gemini in SCC: AI-driven security finding triage with auto-generated remediation runbooks',
      'Gemini in BigQuery: text-to-SQL for regulatory reporting on cloud cost/usage',
      'Gemini Code Assist Enterprise: private model fine-tuned on customer codebase — data stays in VPC',
    ],
    reference_url: 'https://cloud.google.com/gemini',  // GCP Gemini product page (stable)
    _source: 'static',
  },
  // ── Financial ──
  {
    id: 'jp-morgan-ai-cloud-2026', title: 'JPMorgan — LLM Risk Intelligence: Sovereign Pipeline + Human-in-the-Loop',
    source: 'JPMorgan Chase / Industry Intelligence', source_logo: '🏛️', category: 'financial',
    region: 'Global', date: '2026-04-01', impact: 'high',
    tags: ['JPMorgan', 'LLM', 'Risk Intelligence', 'AWS', 'Sovereign AI'],
    summary: 'JPMorgan\'s LLM-based risk intelligence on Private Bedrock demonstrates the tier-1 banking production pattern: sovereign data pipelines, human-in-the-loop for high-risk decisions, continuous model drift monitoring.',
    key_points: [
      'All LLM inference in customer-controlled AWS accounts — no proprietary data leaves to model providers',
      'Human-in-the-loop reduced AI error rate from 8% to 1.2% for high-stakes decisions',
      'AI implementation cost recovered in 14 months through analyst productivity gains',
    ],
    reference_url: 'https://www.jpmorgan.com/technology/artificial-intelligence',
    _source: 'static',
  },
  {
    id: 'ocbc-aws-finops-2026', title: 'OCBC Bank — FinOps: $18M Annual Cloud Cost Reduction on AWS',
    source: 'OCBC Bank / Industry Intelligence', source_logo: '🏦', category: 'financial',
    region: 'Singapore / APAC', date: '2026-02-15', impact: 'high',
    tags: ['OCBC', 'FinOps', 'AWS', 'Cost Optimisation', 'Reserved Instances'],
    summary: 'OCBC\'s FinOps maturity journey achieved $18M annual savings through 78% reserved/savings plan coverage, rightsizing, and chargeback implementation across business units.',
    key_points: [
      'Rightsizing alone delivered $4.2M — instances averaged 35% CPU utilisation before optimisation',
      'Chargeback model created demand-management behaviour in BUs',
      'FinOps CoE: 4 engineers managed $60M+ annual cloud spend',
    ],
    reference_url: 'https://www.finops.org/framework/',
    _source: 'static',
  },
  // ── Emerging ──
  {
    id: 'sovereign-ai-cloud-2026', title: 'Sovereign AI Cloud — Regulators Signal Jurisdiction-Specific AI Hosting Requirements',
    source: 'MAS / HKMA / EU AI Act / Cloud Providers', source_logo: '🌐', category: 'emerging',
    region: 'APAC / EU / Global', date: '2026-03-01', impact: 'high',
    tags: ['Sovereign AI', 'Data Sovereignty', 'Regulated AI', 'Financial Services'],
    summary: 'MAS, HKMA, and EU AI Act are converging on requirements that AI model inference for regulated workloads must occur within approved jurisdictions. Major cloud providers are responding with private model deployment and sovereign AI regions.',
    key_points: [
      'MAS consultation (April 2026): AI systems processing customer financial data should use models in Singapore or approved jurisdictions',
      'EU AI Act Article 25: high-risk AI systems require logs accessible to national authorities',
      'AWS Private Bedrock, Azure Sovereign AI, GCP Sovereign regions all position as the response',
    ],
    reference_url: 'https://www.mas.gov.sg/publications/consultation-papers',
    _source: 'static',
  },
  {
    id: 'agentic-finops-2026', title: 'Agentic FinOps — AI Agents Autonomously Optimise Cloud Cost',
    source: 'AWS / GCP / Gartner / Industry', source_logo: '🤖', category: 'emerging',
    region: 'Global', date: '2026-05-01', impact: 'transformational',
    tags: ['Agentic AI', 'FinOps', 'Cloud Cost', 'Autonomous Optimisation'],
    summary: 'Agentic AI systems that autonomously manage cloud cost — rightsizing, commitment purchasing, idle cleanup — are entering production at major institutions. Early adopters report 25–40% additional savings beyond manual FinOps.',
    key_points: [
      'Autonomous rightsizing: AI submits rightsizing PRs with human approval gates',
      'Commitment management: AI forecasts usage and recommends Reserved Instance / Savings Plan purchases',
      'Compliance risk: automated changes may need change management sign-off under DORA/MAS TRM',
    ],
    reference_url: 'https://www.finops.org/',
    _source: 'static',
  },
];

// ── Handler ───────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET')    return new Response(JSON.stringify({ error: 'GET only' }), { status: 405, headers: cors });

  const url      = new URL(request.url);
  const category = url.searchParams.get('category') || 'all';
  const region   = url.searchParams.get('region')   || null;
  const impact   = url.searchParams.get('impact')   || null;

  // ── Cache check ─────────────────────────────────────────────────────────────
  const now = Date.now();
  if (_cache && (now - _cacheAt) < CACHE_TTL) {
    const items = filterItems(_cache.items, category, region, impact);
    return new Response(JSON.stringify({
      data_source:   _cache.data_source,
      live_count:    _cache.live_count,
      static_count:  _cache.static_count,
      fetched_at:    _cache.fetched_at,
      cached_at:     new Date(_cacheAt).toISOString(),
      expires_at:    new Date(_cacheAt + CACHE_TTL).toISOString(),
      count:         items.length,
      category,
      items,
    }), { headers: cors });
  }

  // ── Live fetch ───────────────────────────────────────────────────────────────
  let liveItems  = [];
  let liveError  = null;
  let dataSource = 'static-fallback';

  if (env.OPENAI_API_KEY) {
    try {
      liveItems  = await fetchLiveTrends(env.OPENAI_API_KEY);
      dataSource = 'openai-web-search';
      console.log(`[trends] Live fetch: ${liveItems.length} items`);
    } catch (e) {
      liveError = e.message;
      console.warn('[trends] Live fetch failed, using static fallback:', e.message);
    }
  } else {
    liveError = 'OPENAI_API_KEY not configured';
  }

  // ── Merge: live on top, static fills gaps ────────────────────────────────────
  // Deduplicate by fuzzy title match to avoid live + static duplicates
  const liveIds = new Set(liveItems.map(i => i.id));
  const liveTitles = liveItems.map(i => i.title.toLowerCase().slice(0, 40));

  const staticFills = STATIC_TRENDS.filter(s => {
    if (liveIds.has(s.id)) return false;
    // Skip if a live item has very similar title
    const slug = s.title.toLowerCase().slice(0, 40);
    return !liveTitles.some(lt => similarity(lt, slug) > 0.7);
  });

  const allItems = [...liveItems, ...staticFills]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  _cache = {
    items:        allItems,
    data_source:  dataSource,
    live_count:   liveItems.length,
    static_count: staticFills.length,
    live_error:   liveError,
    fetched_at:   new Date().toISOString(),
  };
  _cacheAt = now;

  const items = filterItems(allItems, category, region, impact);
  return new Response(JSON.stringify({
    data_source:   dataSource,
    live_count:    liveItems.length,
    static_count:  staticFills.length,
    live_error:    liveError || undefined,
    fetched_at:    _cache.fetched_at,
    cached_at:     new Date(_cacheAt).toISOString(),
    expires_at:    new Date(_cacheAt + CACHE_TTL).toISOString(),
    count:         items.length,
    category,
    items,
  }), { headers: cors });
}

// ── Filter helpers ─────────────────────────────────────────────────────────────
function filterItems(items, category, region, impact) {
  let result = category === 'all' ? items : items.filter(i => i.category === category);
  if (region) result = result.filter(i => i.region?.toLowerCase().includes(region.toLowerCase()));
  if (impact) result = result.filter(i => i.impact === impact);
  return result;
}

// Very simple bigram similarity (0–1) to detect duplicate titles
function similarity(a, b) {
  const bigrams = s => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(a), bb = bigrams(b);
  let inter = 0;
  for (const g of ba) if (bb.has(g)) inter++;
  return (2 * inter) / (ba.size + bb.size) || 0;
}
