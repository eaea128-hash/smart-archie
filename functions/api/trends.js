/**
 * CloudFrame — /api/trends
 * Returns curated international cloud advisory trends, regulatory updates,
 * and framework changes from HSBC, AWS, GCP, MAS, HKMA, FCA, etc.
 *
 * GET /api/trends?category=regulatory|cloud|financial|all
 */

// ── Static Curated Trends Database ──────────────────────────────────────────
// Updated quarterly — version 2026-Q2
const TRENDS_DB = {
  version: '2026-Q2',
  last_updated: '2026-05-15',

  categories: {

    // ── Regulatory & Compliance ──────────────────────────────────────────────
    regulatory: [
      {
        id: 'mas-genai-framework-2026',
        title: 'MAS GenAI Framework — Consultation Paper on Responsible AI in Financial Services',
        source: 'Monetary Authority of Singapore',
        source_logo: '🇸🇬',
        category: 'regulatory',
        region: 'Singapore / APAC',
        date: '2026-04-10',
        impact: 'critical',
        tags: ['MAS', 'GenAI', 'AI Governance', 'Singapore', 'Financial Services'],
        summary: 'MAS released a consultation paper on responsible use of GenAI in financial services, proposing mandatory AI governance frameworks, model risk management requirements for LLM-based applications, and customer disclosure obligations for AI-generated advice.',
        key_requirements: [
          'AI Governance Framework: board-level accountability for GenAI deployment risks',
          'Model Risk Management: LLMs used in customer-facing services classified as High-Risk models',
          'Customer disclosure: clear labelling when advice or content is AI-generated',
          'Bias and fairness testing: mandatory for GenAI used in credit, insurance, or investment decisions',
          'Incident reporting: AI-related operational incidents must be reported to MAS within 24 hours',
          'Third-party AI vendors: subject to same Technology Risk Management requirements as cloud providers'
        ],
        action_for_cloudframe: 'All Singapore analyses involving AI/ML workloads must include MAS GenAI compliance layer. Public comment period ends 2026-06-30.',
        reference_url: 'https://www.mas.gov.sg/regulation/consultations'
      },
      {
        id: 'basel3-final-rule-2026',
        title: 'Basel III Final Rule — Cloud Infrastructure Impact on Capital Calculations',
        source: 'Bank for International Settlements / Regional Banking Regulators',
        source_logo: '🏦',
        category: 'regulatory',
        region: 'Global',
        date: '2026-01-01',
        impact: 'critical',
        tags: ['Basel III', 'Capital Requirements', 'Risk Calculation', 'Cloud Infrastructure'],
        summary: 'Basel III Endgame is now effective globally. Banks must run standardised approach capital calculations with daily frequency — significantly increasing cloud compute demand for risk engines. Institutions without scalable cloud risk infrastructure face non-compliance risk.',
        key_requirements: [
          'Daily SA-CCR (Standardised Approach for Counterparty Credit Risk) calculations mandatory',
          'FRTB (Fundamental Review of Trading Book) requires intraday market risk reporting for major institutions',
          'Cloud risk engines must demonstrate auditability: reproducible calculation results with full data lineage',
          'Disaster recovery for risk calculation infrastructure: RTO < 4 hours for regulatory reporting pipelines',
          'Data residency: risk data must remain in jurisdiction of the booking entity'
        ],
        action_for_cloudframe: 'Analyses for institutions with trading books must include FRTB-capable cloud risk infrastructure sizing.',
        reference_url: 'https://www.bis.org/bcbs/publ/d424.htm'
      },
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
        action_for_cloudframe: 'All Singapore-jurisdiction analyses must include MAS TRM 2025 gap assessment and exit planning appendix.',
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
        action_for_cloudframe: 'Hong Kong analyses must include AI governance layer in Landing Zone design.',
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
        action_for_cloudframe: 'UK analyses must include FCA/PRA impact tolerance mapping and CSP dependency register.',
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
        action_for_cloudframe: 'EU jurisdiction analyses must include full DORA compliance roadmap and CTPP risk register.',
        reference_url: 'https://www.eba.europa.eu/regulation-and-policy/digital-operational-resilience-act-dora'
      }
    ],

    // ── Cloud Platform Updates ───────────────────────────────────────────────
    cloud: [
      {
        id: 'aws-nova-enterprise-2026',
        title: 'Amazon Nova — Enterprise-Grade Foundation Models on Bedrock GA',
        source: 'Amazon Web Services',
        source_logo: '🟠',
        category: 'cloud',
        region: 'Global',
        date: '2026-03-18',
        impact: 'high',
        tags: ['AWS', 'Bedrock', 'Nova', 'GenAI', 'Foundation Models', 'Financial Services'],
        summary: 'Amazon Nova Pro and Nova Premier are now Generally Available on Bedrock with enterprise controls: private model deployment (no data leaves customer VPC), model distillation, and built-in PII detection. Financial services editions include MAS/HKMA compliance tagging.',
        key_features: [
          'Nova Premier: 200K context window, optimised for long-form regulatory document analysis',
          'Private Bedrock: model inference runs within customer VPC — no data sent to AWS model infrastructure',
          'Model distillation: fine-tune Nova on proprietary data with full data sovereignty',
          'PII detection: automatic redaction before logging for compliance',
          'Bedrock Guardrails: enhanced hallucination detection for financial fact-checking',
          'APAC availability: Singapore (ap-southeast-1) and Tokyo (ap-northeast-1)'
        ],
        recommendation: 'For financial institutions requiring data sovereignty, Private Bedrock eliminates the GenAI data residency concern. Evaluate as primary LLM platform before external API providers.',
        reference_url: 'https://aws.amazon.com/bedrock/nova/'
      },
      {
        id: 'azure-ai-foundry-2026',
        title: 'Azure AI Foundry — Enterprise GenAI Platform with Built-in Compliance',
        source: 'Microsoft Azure',
        source_logo: '🔷',
        category: 'cloud',
        region: 'Global',
        date: '2026-02-20',
        impact: 'high',
        tags: ['Azure', 'AI Foundry', 'GenAI', 'Compliance', 'Financial Services', 'DORA'],
        summary: 'Azure AI Foundry (formerly Azure AI Studio) is now GA with enterprise-grade compliance controls: private network deployment, DORA-aligned incident response, and Microsoft-managed compliance posture for EU-regulated workloads.',
        key_features: [
          'Private AI deployment: all model inference within Azure Private Link — no public internet exposure',
          'DORA-aligned: AI Foundry instances included in Azure business continuity SLAs',
          'Azure Policy: built-in policies for AI Foundry preventing public model endpoints in regulated tenants',
          'Managed identity integration: service-to-service auth with zero credential management',
          'Model catalogue: 1,600+ models including GPT-4o, Phi-4, Mistral, and open-source models',
          'Content safety: financial services presets blocking prohibited financial advice patterns'
        ],
        recommendation: 'Institutions already on Azure Landing Zone should standardise on AI Foundry for all GenAI workloads — avoids shadow AI proliferation.',
        reference_url: 'https://ai.azure.com/'
      },
      {
        id: 'gcp-gemini-cloud-2026',
        title: 'Google Gemini 2.0 — Native Cloud Operations Integration',
        source: 'Google Cloud Platform',
        source_logo: '🔵',
        category: 'cloud',
        region: 'Global',
        date: '2026-01-28',
        impact: 'high',
        tags: ['GCP', 'Gemini', 'Cloud Operations', 'AIOps', 'FinOps', 'Security'],
        summary: 'Gemini 2.0 is now integrated natively into Google Cloud Console, Cloud Logging, Security Command Center, and BigQuery. Financial institutions can use Gemini for natural-language cloud operations — querying logs, investigating security findings, and generating FinOps reports.',
        key_features: [
          'Gemini in Cloud Logging: natural language log queries replacing complex filter syntax',
          'Gemini in SCC: AI-driven security finding triage with remediation runbooks',
          'Gemini in BigQuery: text-to-SQL for regulatory reporting on cloud cost/usage data',
          'Gemini Code Assist Enterprise: private model fine-tuned on customer codebase — data stays in VPC',
          'Cloud FinOps AI: automated rightsizing recommendations with commitment purchase suggestions',
          'asia-southeast1 availability: Singapore region with Gemini 2.0 Flash and Pro'
        ],
        recommendation: 'For GCP-primary institutions, Gemini integration reduces operational overhead significantly. Evaluate Gemini in SCC for automated compliance remediation.',
        reference_url: 'https://cloud.google.com/gemini/docs/overview'
      },
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
        id: 'jp-morgan-ai-cloud-2026',
        title: 'JPMorgan Chase — LLM-Powered Risk Intelligence Platform',
        source: 'JPMorgan Chase / Industry Intelligence',
        source_logo: '🏛️',
        category: 'financial',
        region: 'Global',
        date: '2026-04-01',
        impact: 'high',
        tags: ['JPMorgan', 'LLM', 'Risk Intelligence', 'AWS', 'Financial Services', 'AI'],
        summary: 'JPMorgan\'s deployment of LLM-based risk intelligence on AWS demonstrates the production pattern for GenAI in tier-1 banking: sovereign data pipelines, human-in-the-loop for high-risk decisions, and continuous model monitoring for regulatory drift.',
        architecture_patterns: [
          {
            pattern: 'Sovereign AI Pipeline',
            description: 'All LLM inference runs in customer-controlled AWS accounts via Private Bedrock. No proprietary data transmitted to model providers. Encryption keys held in customer-managed KMS.',
            applicability: 'Any institution handling material non-public information or client data'
          },
          {
            pattern: 'Human-in-the-Loop Gates',
            description: 'LLM-generated risk summaries and trade recommendations flagged with confidence scores. Scores below 85% require human review before action. All AI-assisted decisions logged with reviewer identity for audit trail.',
            applicability: 'Credit decisions, trade approvals, compliance sign-offs'
          },
          {
            pattern: 'Model Drift Monitoring',
            description: 'Continuous comparison of LLM outputs against ground truth labels. Automated alerts when output distribution shifts > 2σ from baseline. Monthly retraining cycles for production models.',
            applicability: 'All production GenAI applications in regulated environments'
          }
        ],
        key_lessons: [
          'Private model deployment added 30% infrastructure cost but eliminated data sovereignty regulatory risk entirely',
          'Human-in-the-loop reduced AI error rate from 8% to 1.2% for high-stakes decisions',
          'Model drift monitoring caught two significant output degradations before regulatory impact',
          'Total AI implementation cost recovered in 14 months through analyst productivity gains'
        ]
      },
      {
        id: 'ocbc-aws-finops-2026',
        title: 'OCBC Bank — FinOps Transformation: $18M Annual Cloud Cost Reduction',
        source: 'OCBC Bank / Industry Intelligence',
        source_logo: '🏦',
        category: 'financial',
        region: 'Singapore / APAC',
        date: '2026-02-15',
        impact: 'high',
        tags: ['OCBC', 'FinOps', 'AWS', 'Cost Optimisation', 'Reserved Instances', 'Singapore'],
        summary: 'OCBC\'s 3-year FinOps maturity journey on AWS achieved $18M annual savings through systematic commitment management, rightsizing, and chargeback implementation — achieving 78% reserved/savings plan coverage for predictable workloads.',
        architecture_patterns: [
          {
            pattern: 'Chargeback-Driven FinOps',
            description: 'Full cloud cost chargeback to business units with monthly reporting. BU owners given self-service dashboards and savings targets. Resulted in 40% reduction in idle resource waste within 6 months.',
            applicability: 'Institutions with > $5M/year cloud spend across multiple business units'
          },
          {
            pattern: 'Commitment Ladder Strategy',
            description: 'Tiered commitment: 1-year Savings Plans for baseline (60%), 3-year Convertible RIs for long-lived workloads (20%), On-demand for variable (20%). Automated purchase recommendations from Cost Explorer.',
            applicability: 'All institutions with mature FinOps practice'
          }
        ],
        key_lessons: [
          '78% commitment coverage achieved after 18 months — target 80%+ for mature FinOps',
          'Rightsizing alone delivered $4.2M savings — most instances were over-provisioned at 35% average CPU utilisation',
          'Chargeback model created internal demand-management behaviour: teams started requesting smaller instances by default',
          'FinOps CoE headcount: 4 engineers managed $60M+ annual cloud spend'
        ]
      },
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
        id: 'agentic-finops-2026',
        title: 'Agentic FinOps — AI Agents Autonomously Manage Cloud Cost Optimisation',
        source: 'AWS / GCP / Gartner / Industry',
        source_logo: '🤖',
        category: 'emerging',
        region: 'Global',
        date: '2026-05-01',
        impact: 'transformational',
        tags: ['Agentic AI', 'FinOps', 'Cloud Cost', 'Autonomous Optimisation', 'CloudOps'],
        summary: 'A new category of agentic AI systems is emerging that autonomously manages cloud cost optimisation: identifying waste, purchasing commitments, rightsizing instances, and scheduling workloads — with human approval gates for large actions. Early adopters report 25-40% additional savings beyond manual FinOps.',
        use_cases: [
          'Autonomous rightsizing: AI agent continuously monitors CPU/memory utilisation and submits rightsizing PRs for human approval',
          'Commitment management: AI agent recommends and (with approval) purchases Reserved Instances/Savings Plans based on usage forecasting',
          'Idle resource cleanup: AI agent identifies and terminates/hibernates idle resources after configurable inactivity period',
          'Anomaly investigation: AI agent automatically investigates cost spikes, traces to root cause, and generates remediation plan',
          'Scheduled optimisation: AI agent shifts non-time-sensitive workloads to off-peak/spot capacity automatically'
        ],
        maturity_level: 'Early adopter phase (2026) — production at hyperscalers\' own platforms; 15-20% of Fortune 500 financial institutions piloting',
        risks: [
          'Commitment purchase errors: AI miscalculating usage forecasts could result in over-commitment',
          'Compliance exposure: automated changes may require change management sign-off under DORA/MAS TRM',
          'Model hallucination: AI-generated cost analyses must be validated against actual billing data'
        ]
      },
      {
        id: 'sovereign-ai-cloud-2026',
        title: 'Sovereign AI Cloud — Jurisdiction-Specific AI Infrastructure Emerges',
        source: 'AWS / Azure / GCP / National Regulators',
        source_logo: '🌐',
        category: 'emerging',
        region: 'APAC / EU / Global',
        date: '2026-03-01',
        impact: 'high',
        tags: ['Sovereign AI', 'Data Sovereignty', 'Regulated AI', 'National Cloud', 'Financial Services'],
        summary: 'Regulators in Singapore, EU, and Hong Kong are moving toward requiring AI model inference to occur within national or regional boundaries — creating the "Sovereign AI Cloud" category. Major cloud providers are responding with dedicated sovereign AI regions and private model deployment options.',
        developments: [
          'MAS consultation (April 2026): guidance indicates AI systems processing customer financial data must use models hosted in Singapore or approved jurisdictions',
          'EU AI Act (Article 25): high-risk AI systems must maintain comprehensive logs accessible to national authorities — requiring EU-hosted model infrastructure',
          'HKMA: informal guidance indicates LLMs used in credit decisions should use models where data does not leave Hong Kong jurisdiction',
          'AWS Private Bedrock: positions as the sovereign AI solution — model inference stays in customer VPC',
          'Azure Sovereign AI: dedicated sovereign cloud AI capabilities for EU, MAS-regulated markets',
          'GCP Sovereign AI regions: committed to Singapore and Hong Kong AI-specific sovereign capabilities by Q4 2026'
        ],
        action_for_cloudframe: 'Cloud architecture recommendations must now include AI sovereignty layer — which models, which hosting model, which jurisdiction for LLM inference.',
        reference_url: 'https://www.mas.gov.sg/regulation/consultations'
      },
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
        summary: 'The "$4.6T professional services market is being disrupted by AI agents that deliver outcomes, not software licenses." Cloud advisory, legal, accounting, and consulting are early targets. CloudFrame represents this paradigm: AI that delivers the consulting outcome, not a tool to help consultants.',
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
export async function onRequest(context) {
  const { request } = context;

  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const url      = new URL(request.url);
  const params   = Object.fromEntries(url.searchParams);
  const category = params.category || 'all';
  const region   = params.region;
  const impact   = params.impact;

  let items = [];

  if (category === 'all') {
    items = Object.values(TRENDS_DB.categories).flat();
  } else if (TRENDS_DB.categories[category]) {
    items = TRENDS_DB.categories[category];
  } else {
    return new Response(
      JSON.stringify({ error: `Unknown category: ${category}. Valid: ${Object.keys(TRENDS_DB.categories).join(', ')}` }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
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

  return new Response(
    JSON.stringify({
      version:      TRENDS_DB.version,
      last_updated: TRENDS_DB.last_updated,
      count:        items.length,
      category,
      items,
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } }
  );
}
