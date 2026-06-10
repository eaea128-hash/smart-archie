export {
  RISK_RULES,
  evaluateRules,
  explainRiskForSystem,
  getRuleById,
  getRulesByCategory,
} from "@/lib/risk-rules";
export type { RiskRule, RuleEvaluationResult, TriggeredRule } from "@/lib/risk-rules";
