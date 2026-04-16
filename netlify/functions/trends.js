/**
 * Smart Archie — /api/trends
 * Returns curated international cloud advisory trends, regulatory updates,
 * and framework changes from HSBC, AWS, GCP, MAS, HKMA, FCA, etc.
 *
 * GET /api/trends?category=regulatory|cloud|financial|all
 */

// ── Static Curated Trends Database ──────────────────────────────────────────
// Updated quarterly — version 2026-Q1
const TRENDS_DB = {
  version: '2026-Q1',
  last_updated: '2026-04-01',

  categories: {

    // ── Regulatory & Compliance ──────────────────────────────────────────────
    regulatory: [
      {
        id: 'mas-trm-2025-update',
        title: 'MAS TRM Guidelines — 2025 Revision',
        source: 'Monetary Authority of Singapore',
        source_logo: '🇸🇬',
        category: 'regulatory',
        region: 'Singapore / APAC',
        date: '2025-11-15',
        impact: 'high',
        tags: ['MAS', 'TRM', 'Singapore', 'Cloud Outsourcing', 'Operational Resilience'],
        summary: 'MAS updated TRM guidelines mandate enhanced concentration risk assessment for cloud providers, stricter exit planning requirements (minimum 12-month runway), and real-time audit log access for supervisory examinations.',
        key_requirements: [
          'Cloud provider concentration risk must be reported to board quarterly',
          'Exit strategy must demonstrate 12-month migration capability with documented runbooks',
          'Supervisory access: MAS inspectors must have read-only access to security logs within 24 hours of request',
          'Multi-cloud or hybrid-cloud mandatory for Systemically Important Financial Institutions (SIFIs)',
          'Annual cloud resilience testing with results submitted to MAS'
        ],
        action_for_archie: 'All Singapore-jurisdiction analyses must include MAS TRM 2025 gap assessment and exit planning appendix.',
        reference_url: 'https://www.mas.gov.sg/regulation/guidelines/technology-risk-management-guidelines'
      },
      {
        id: 'hkma-ormic-2025',
        title: 'HKMA ORMiC — Cloud Operational Risk Framework Update',
        source: 'Hong Kong Monetary Authority',
        source_logo: '🇭🇰',
        category: 'regulatory',
        region: 'Hong Kong',
        date: '2025-09-30',
        impact: 'high',
        tags: ['HKMA', 'ORMiC', 'Hong Kong', 'Operational Risk', 'Cloud'],
        summary: 'HKMA expanded ORMiC to cover GenAI workloads in cloud environments, requiring AI model governance frameworks and explainability requirements for credit/risk decisions.',
        key_requirements: [
          'AI model risk management framework mandatory for ML workloads in production',
          'Explainability requirements for automated credit decisions (Grade A–C documentation)',
          'Cloud asset inventory must include AI/ML model registry with version control',
          'Data lineage documentation required for all regulatory reporting data pipelines',
          'Third-party AI model vendors subject to same outsourcing risk assessment as cloud providers'
        ],
        action_for_archie: 'Hong Kong analyses must include AI governance layer in Landing Zone design.',
        reference_url: 'https://www.hkma.gov.hk/media/eng/doc/key-functions/banking-stability/supervisory-policy-manual/TM-G-2.pdf'
      },
      {
        id: 'fca-operational-resilience-2025',
        title: 'FCA/PRA Operational Resilience — Cloud Dependency Reporting',
        source: 'Financial Conduct Authority / Prudential Regulation Authority',
        source_logo: '🇬🇧',
        category: 'regulatory',
        region: 'UK / EEA',
        date: '2025-03-31',
        impact: 'high',
        tags: ['FCA', 'PRA', 'UK', 'Operational Resilience', 'Impact Tolerance'],
        summary: 'Post-March 2025 deadline: all FCA/PRA-regulated firms must demonstrate they remain within impact tolerances during cloud provider outages. Severe-but-plausible scenarios must include major CSP (cloud service provider) regional failure.',
        key_requirements: [
          'Impact tolerance statements must explicitly address CSP dependency',
          'Severe-but-plausible scenario: full CSP regional outage (minimum 72 hours)',
          'Self-assessment must include actual end-to-end resilience testing results',
          'Material change notifications required for cloud migrations affecting important business services',
          'Annual resilience testing with board attestation'
        ],
        action_for_archie: 'UK analyses must include FCA/PRA impact tolerance mapping and CSP dependency register.',
        reference_url: 'https://www.bankofengland.co.uk/prudential-regulation/publication/2021/march/operational-resilience-ss'
      },
      {
        id: 'dora-eu-2025',
        title: 'EU DORA — Digital Operational Resilience Act (Live)',
        source: 'European Banking Authority',
        source_logo: '🇪🇺',
        category: 'regulatory',
        region: 'European Union',
        date: '2025-01-17',
        impact: 'critical',
        tags: ['DORA', 'EU', 'ICT Risk', 'Third-Party Risk', 'Resilience Testing'],
        summary: 'DORA is now enforceable across all EU financial entities. Cloud providers designated as Critical ICT Third-Party Service Providers (CTPPs) by ESAs face direct oversight. Financial entities must conduct TLPT (Threat-Led Penetration Testing) annually.',
        key_requirements: [
          'ICT risk management framework must cover cloud workloads end-to-end',
          'CTPP register: all cloud providers must be assessed against DORA Article 28 requirements',
          'TLPT: annual threat-led penetration testing for significant institutions',
          'ICT incident classification and reporting to NCAs within 4 hours (major incidents)',
          'ICT third-party risk management: standardised contractual clauses with CSPs',
          'Information sharing: participation in financial sector intelligence sharing'
        ],
        action_for_archie: 'EU jurisdiction analyses must include full DORA compliance roadmap and CTPP risk register.',
        reference_url: 'https://www.eba.europa.eu/regulation-and-policy/digital-operational-resilience-act-dora'
      }
    ],

    // ── Cloud Platform Updates ───────────────────────────────────────────────
    cloud: [
      {
        id: 'aws-control-tower-af-2025',
        title: 'AWS Control Tower — Account Factory for Terraform (AFT) GA',
        source: 'Amazon Web Services',
        source_logo: '🟠',
        category: 'cloud',
        region: 'Global',
        date: '2025-10-01',
        impact: 'high',
        tags: ['AWS', 'Control Tower', 'Landing Zone', 'Terraform', 'IaC'],
        summary: 'AWS Account Factory for Terraform (AFT) is now the recommended approach for Landing Zone provisioning, replacing manual Account Vending Machine. AFT provides GitOps-driven account provisioning with built-in guardrail inheritance.',
        key_requirements: [
          'AFT pipeline: Terraform-based account provisioning with drift detection',
          'Account customisations via AFT account-request and account-customisations repositories',
          'Integration with AWS Organizations for SCP inheritance',
          'Proactive controls (AWS Config + Security Hub integration)',
          'Immutable infrastructure: all changes via pull request, no console changes in production'
        ],
        recommendation: 'All new Landing Zone deployments should use AFT. Existing deployments should migrate from manual account vending within 12 months.',
        reference_url: 'https://docs.aws.amazon.com/controltower/latest/userguide/aft-overview.html'
      },
      {
        id: 'aws-security-hub-fsbp-v2',
        title: 'AWS Foundational Security Best Practices — v2.0',
        source: 'Amazon Web Services',
        source_logo: '🟠',
        category: 'cloud',
        region: 'Global',
        date: '2025-07-15',
        impact: 'medium',
        tags: ['AWS', 'Security Hub', 'FSBP', 'Compliance', 'GuardDuty'],
        summary: 'FSBP v2.0 adds 47 new controls covering GenAI services (Bedrock), container security (EKS), and data perimeter controls. Financial institutions should target >95% compliance score.',
        new_controls: [
          'Bedrock: model invocation logging enabled',
          'EKS: cluster endpoint not publicly accessible',
          'S3: data perimeter policies restricting cross-account access',
          'RDS: automated backups enabled with cross-region copy',
          'IAM: access analyser enabled with archive rules for expected findings'
        ],
        reference_url: 'https://docs.aws.amazon.com/securityhub/latest/userguide/fsbp-standard.html'
      },
      {
        id: 'gcp-sovereign-controls-2025',
        title: 'GCP Sovereign Controls by Partners — APAC Expansion',
        source: 'Google Cloud Platform',
        source_logo: '🔵',
        category: 'cloud',
        region: 'APAC',
        date: '2025-08-20',
        impact: 'high',
        tags: ['GCP', 'Data Sovereignty', 'APAC', 'Assured Workloads', 'Financial Services'],
        summary: 'GCP expanded Assured Workloads to Singapore and Hong Kong regions, enabling financial institutions to enforce data residency, personnel access controls (Ekm, Access Approval), and regulatory compliance packages natively.',
        key_features: [
          'Assured Workloads: Singapore MAS TRM compliance package',
          'Assured Workloads: Hong Kong HKMA ORMiC alignment',
          'Customer-managed encryption keys (CMEK) enforced via org policy',
          'Access Approval: human approval required before Google personnel access data',
          'VPC Service Controls: data exfiltration prevention for all APAC regulated workloads'
        ],
        reference_url: 'https://cloud.google.com/assured-workloads/docs/overview'
      },
      {
        id: 'azure-caf-financial-services-2025',
        title: 'Azure Cloud Adoption Framework — Financial Services Industry Scenario',
        source: 'Microsoft Azure',
        source_logo: '🔷',
        category: 'cloud',
        region: 'Global',
        date: '2025-06-01',
        impact: 'medium',
        tags: ['Azure', 'CAF', 'Financial Services', 'Landing Zone', 'DORA'],
        summary: 'Microsoft released a Financial Services Industry (FSI) scenario for Azure CAF with pre-built DORA, MAS, and HKMA compliance blueprints. Includes reference architectures for core banking modernisation.',
        key_additions: [
          'FSI Landing Zone: pre-configured with DORA-aligned policies',
          'Core banking reference architecture on Azure with mainframe modernisation patterns',
          'Azure Confidential Computing for sensitive financial calculations',
          'Microsoft Purview for data governance across multi-cloud environments',
          'SWIFT CSP compliance blueprint for payment infrastructure'
        ],
        reference_url: 'https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/industry/financial-services/'
      }
    ],

    // ── Financial Institution Patterns ───────────────────────────────────────
    financial: [
      {
        id: 'hsbc-cloud-2025-patterns',
        title: 'HSBC Cloud Engineering — 2025 Architecture Patterns',
        source: 'HSBC / Industry Intelligence',
        source_logo: '🔴',
        category: 'financial',
        region: 'Global / APAC',
        date: '2025-09-01',
        impact: 'high',
        tags: ['HSBC', 'Hybrid Cloud', 'Data Sovereignty', 'API-First', 'FinOps'],
        summary: 'HSBC\'s cloud journey reveals key patterns for global financial institutions: sovereign cloud enclaves per jurisdiction, unified data platform with regional data residency, and API-first microservices with domain-driven design.',
        architecture_patterns: [
          {
            pattern: 'Sovereign Cloud Enclave',
            description: 'Separate cloud accounts/projects per regulatory jurisdiction (SG, HK, UK, US) with explicit data egress controls. Data never leaves jurisdiction without approved legal instrument.',
            applicability: 'Any institution with multi-jurisdiction operations'
          },
          {
            pattern: 'Hybrid Cloud Integration Fabric',
            description: 'On-premises core systems (mainframes, legacy databases) connected to cloud via dedicated Express/Direct Connect circuits with API gateway mediation. No direct cloud-to-mainframe calls.',
            applicability: 'Institutions with significant on-premises investment (typically banks > 20 years old)'
          },
          {
            pattern: 'FinOps Centre of Excellence',
            description: 'Dedicated FinOps team with chargeback model, 30-day commitment purchase authority, and anomaly detection. Target: >80% reserved/savings plan coverage for predictable workloads.',
            applicability: 'All institutions with > $1M/year cloud spend'
          },
          {
            pattern: 'Zero-Trust Network Architecture',
            description: 'Identity-first access model: no network perimeter trust. Every service-to-service call authenticated and authorised. Mutual TLS everywhere. PAM for privileged access.',
            applicability: 'Financial institutions post-2023 (regulatory expectation)'
          }
        ],
        key_lessons: [
          'Cloud migration of customer-facing applications took 3x longer than estimated without regulatory pre-approval',
          'FinOps saved 35% cost reduction in Year 2 through rightsizing and commitment management',
          'API-first strategy enabled 60% faster time-to-market for new digital products',
          'Data sovereignty tooling cost approximately 15% premium over standard cloud pricing but eliminated regulatory risk'
        ]
      },
      {
        id: 'dbs-gcp-ai-2025',
        title: 'DBS Bank — GCP AI Platform at Scale in Regulated Environment',
        source: 'DBS Bank / Industry Intelligence',
        source_logo: '🏦',
        category: 'financial',
        region: 'Singapore / APAC',
        date: '2025-07-10',
        impact: 'high',
        tags: ['DBS', 'GCP', 'AI/ML', 'MLOps', 'Financial Services'],
        summary: 'DBS\'s journey to deploy 1,000+ AI models in production on GCP demonstrates the MLOps maturity required for regulated financial AI at scale — including model governance, explainability, and bias detection.',
        architecture_patterns: [
          {
            pattern: 'Regulated MLOps Pipeline',
            description: 'Every model deployment requires: risk classification (High/Medium/Low), model card documentation, explainability report (SHAP values), bias testing, and risk committee sign-off for High-risk models.',
            applicability: 'Institutions deploying ML for credit, fraud, or AML decisions'
          },
          {
            pattern: 'Feature Store for Compliance',
            description: 'Centralised Vertex AI Feature Store with lineage tracking. Every feature used in a model decision can be traced back to source data, transformation logic, and point-in-time values. Required for regulatory audits.',
            applicability: 'Any ML use case subject to regulatory review'
          }
        ],
        key_lessons: [
          'Model governance framework took 6 months to establish before first production AI deployment',
          'Investment in explainability tooling reduced model review time by 70%',
          'Centralised feature store eliminated 40% of duplicated data engineering work across teams'
        ]
      },
      {
        id: 'goldman-cloud-native-trading-2025',
        title: 'Goldman Sachs — Cloud-Native Trading Infrastructure Lessons',
        source: 'Goldman Sachs Technology / Industry Intelligence',
        source_logo: '🏛️',
        category: 'financial',
        region: 'Global',
        date: '2025-05-20',
        impact: 'medium',
        tags: ['Goldman Sachs', 'Trading', 'Low Latency', 'Cloud Native', 'Hybrid'],
        summary: 'Goldman\'s experience migrating trading infrastructure reveals: latency-sensitive workloads stay on co-location/on-premises, risk calculation and reporting move to cloud, and middle-office operations are fully cloud-native.',
        workload_classification: [
          { type: 'Retain On-Premises', examples: ['Market data feeds', 'Order management (sub-ms latency)', 'Co-location matching engines'], rationale: 'Network latency economics — cloud cannot compete at μs scale' },
          { type: 'Replatform to Cloud', examples: ['Risk calculation (P&L, VaR, stress testing)', 'Regulatory reporting', 'Trade reconciliation'], rationale: 'Batch/near-realtime, benefits from cloud elasticity and managed services' },
          { type: 'Refactor Cloud-Native', examples: ['Client portal', 'Research platform', 'Middle office workflows', 'KYC/AML pipelines'], rationale: 'High development velocity needed, cloud-native services provide significant leverage' }
        ]
      }
    ],

    // ── Emerging Themes ──────────────────────────────────────────────────────
    emerging: [
      {
        id: 'services-as-software-2025',
        title: 'Services as Software — AI Agents Replace Professional Services',
        source: 'Sequoia Capital / Industry Analysis',
        source_logo: '🌱',
        category: 'emerging',
        region: 'Global',
        date: '2025-12-01',
        impact: 'transformational',
        tags: ['AI Agents', 'Services as Software', 'Agentic AI', 'Professional Services', 'Cloud Advisory'],
        summary: 'The "$4.6T professional services market is being disrupted by AI agents that deliver outcomes, not software licenses." Cloud advisory, legal, accounting, and consulting are early targets. Smart Archie represents this paradigm: AI that delivers the consulting outcome, not a tool to help consultants.',
        implications_for_cloud_advisory: [
          'Traditional: consultant uses tool → produces report → client implements (3-6 month cycle)',
          'New paradigm: AI agent ingests organisation data → delivers actionable plan → monitors implementation → alerts on drift (continuous)',
          'Value metric shifts from "analysis quality" to "outcomes achieved" (cost saved, risk reduced, time-to-cloud shortened)',
          'Pricing model shifts from per-analysis to outcome-based (% of savings achieved, risk score improved)'
        ],
        adoption_curve: 'Early adopters (2024–2026): SaaS cloud advisory platforms. Mainstream (2026–2028): Big-4 advisory firms launch AI-native practices. Disruption complete (2028–2030): Human-led cloud advisory becomes premium niche.',
        reference_url: 'https://sequoiacap.com/article/services-the-new-software/'
      },
      {
        id: 'genai-in-cloud-governance-2025',
        title: 'GenAI for Cloud Governance — Automated Compliance Remediation',
        source: 'AWS / GCP / Industry',
        source_logo: '🤖',
        category: 'emerging',
        region: 'Global',
        date: '2025-10-15',
        impact: 'high',
        tags: ['GenAI', 'Cloud Governance', 'Compliance Automation', 'IaC', 'Security'],
        summary: 'Leading financial institutions are deploying GenAI agents to automatically detect, explain, and remediate cloud compliance violations — reducing time-to-remediation from weeks to hours.',
        use_cases: [
          'Automated IaC review: GenAI reviews Terraform/CloudFormation PRs for security violations before deployment',
          'Compliance drift detection: natural language explanation of Config rule violations with auto-generated remediation PRs',
          'Cost anomaly investigation: GenAI investigates unexpected cloud spend spikes and produces root-cause analysis reports',
          'Security finding triage: GenAI prioritises Security Hub findings by business impact and suggests remediation steps'
        ],
        maturity_level: 'Early adopter phase — production deployments exist at HSBC, JPMorgan, and several Tier-2 banks',
        risks: [
          'Hallucination risk in compliance interpretation — human review gates required for all auto-remediation',
          'Access control: GenAI agents must operate with least-privilege IAM policies',
          'Audit trail: all GenAI-suggested changes must be logged with human approval record'
        ]
      }
    ]
  }
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  const category = event.queryStringParameters?.category || 'all';
  const region   = event.queryStringParameters?.region;
  const impact   = event.queryStringParameters?.impact;

  let items = [];

  if (category === 'all') {
    items = Object.values(TRENDS_DB.categories).flat();
  } else if (TRENDS_DB.categories[category]) {
    items = TRENDS_DB.categories[category];
  } else {
    return {
      statusCode: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Unknown category: ${category}. Valid: ${Object.keys(TRENDS_DB.categories).join(', ')}` }),
    };
  }

  // Filter by region
  if (region) {
    items = items.filter(t => t.region?.toLowerCase().includes(region.toLowerCase()));
  }

  // Filter by impact
  if (impact) {
    items = items.filter(t => t.impact === impact);
  }

  // Sort by date desc
  items = items.sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    body: JSON.stringify({
      version:      TRENDS_DB.version,
      last_updated: TRENDS_DB.last_updated,
      count:        items.length,
      category,
      items,
    }),
  };
};
