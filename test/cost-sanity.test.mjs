/**
 * Cost sanity guard tests — verifies the fix for the contradictory cost bug
 * (report showed "中估值 $104,632 / 低估 $166 ～ 高估 $104,632").
 *
 * Run: node test/cost-sanity.test.mjs
 *
 * These replicate the exact logic embedded in:
 *   - analyze.html / share.html  → render-time band guard
 *   - functions/api/analyze.js   → server scenario sanity check
 *   - js/api-client.js           → client pass-through + local low/mid/high mapping
 */

let pass = 0, fail = 0;
function check(name, expected, actual) {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  if (ok) { pass++; console.log(`✅ ${name}`); }
  else    { fail++; console.log(`❌ ${name}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`); }
}

// ── Render-time band guard (analyze.html / share.html) ──────────────────────
function applyBandGuard(cost) {
  const c = { ...cost };
  if (typeof c.mid === 'number' && c.mid > 0) {
    const bandBroken = !(c.low < c.mid && c.mid < c.high)
                       || c.low < c.mid * 0.4
                       || c.high > c.mid * 2.5;
    if (bandBroken) {
      c.low  = Math.round(c.mid * 0.75);
      c.high = Math.round(c.mid * 1.35);
    }
  }
  return c;
}

// ── Server / client scenario sanity check ───────────────────────────────────
function scenariosSane(consM, recM, aggM) {
  return consM > 0 && recM > 0 && aggM > 0 &&
         consM > recM && recM > aggM &&
         aggM >= consM * 0.25;
}

// Scenario 1: Happy path — the live-token report (correct ordering) is untouched
{
  const out = applyBandGuard({ low: 6961, mid: 10653, high: 19379 });
  check('S1 happy path: low<mid<high preserved unchanged',
    { low: 6961, mid: 10653, high: 19379 }, out);
}

// Scenario 2: The reported bug — mid==high, absurd low → re-derived band
{
  const out = applyBandGuard({ low: 166, mid: 104632, high: 104632 });
  // low<mid*0.4 (166<41852) AND mid==high (not strictly <) → re-derive
  check('S2 reported bug: mid==high & low=$166 → sane band',
    { low: Math.round(104632 * 0.75), mid: 104632, high: Math.round(104632 * 1.35) }, out);
  if (!(out.low < out.mid && out.mid < out.high)) { fail++; console.log('❌ S2 invariant low<mid<high broken'); }
}

// Scenario 3: Inverted band (low>high) → re-derived
{
  const out = applyBandGuard({ low: 20000, mid: 10000, high: 5000 });
  check('S3 inverted band → re-derived from mid',
    { low: 7500, mid: 10000, high: 13500 }, out);
}

// Scenario 4: high absurdly large (>2.5x mid) → re-derived
{
  const out = applyBandGuard({ low: 8000, mid: 10000, high: 90000 });
  check('S4 high>2.5x mid → re-derived',
    { low: 7500, mid: 10000, high: 13500 }, out);
}

// Scenario 5: mid missing / zero → guard is a no-op (other code handles fallback)
{
  const out = applyBandGuard({ low: 0, mid: 0, high: 0 });
  check('S5 mid==0 → guard no-op', { low: 0, mid: 0, high: 0 }, out);
}

// Scenario 6: Server sanity — valid ordered scenarios accepted (no TCO override)
check('S6 sane scenarios accepted', true, scenariosSane(19379, 10653, 6961));

// Scenario 7: Server sanity — the bug data rejected (triggers TCO override)
check('S7 bug data (166/104632/104632) rejected', false, scenariosSane(166, 104632, 104632));

// Scenario 8: Server sanity — aggressive==recommended rejected (mid==high cause)
check('S8 aggressive==recommended rejected', false, scenariosSane(20000, 10000, 10000));

// Scenario 9: Server sanity — savings too deep (agg < 25% of cons) rejected
check('S9 agg savings >75% rejected', false, scenariosSane(10000, 5000, 1000));

// Scenario 10: Server sanity — zero recommended rejected
check('S10 zero recommended rejected', false, scenariosSane(10000, 0, 5000));

// ── Real engine acceptance: 台灣銀行核心帳務系統 ─────────────────────────────
import { calculateFinOpsTCO } from '../functions/api/analyze.js';

const bankInput = {
  projectName: '台灣銀行核心帳務系統',
  targetCloud: 'AWS',
  companySize: 'enterprise',
  systemCount: 60,
  drRequirements: 'rto1h',
  dataClassification: 'highly-confidential',
  dataSize: 'large',
  txVolume: 'very_high',
  complianceLevel: 'high',
  hasPersonalData: 'yes',
  hasFinancialData: 'yes',
  envCount: 4,
  migrationDriver: 'compliance',
  industry: 'banking',
};

const tco = calculateFinOpsTCO(bankInput);
const bd  = tco.breakdown;
const bdSum = bd.compute + bd.database + bd.storage + bd.network + bd.security + bd.dr_backup;
const low  = tco.aggressive;   // 低估
const mid  = tco.recommended;  // 中估
const high = tco.conservative; // 高估

console.log(`\n— 台灣銀行核心帳務系統 實機輸出 —`);
console.log(`  低估(aggressive): $${low.toLocaleString()}`);
console.log(`  中估(recommended): $${mid.toLocaleString()}`);
console.log(`  高估(conservative): $${high.toLocaleString()}`);
console.log(`  明細6項加總: $${bdSum.toLocaleString()}  (compute ${bd.compute}, db ${bd.database}, storage ${bd.storage}, network ${bd.network}, security ${bd.security}, dr ${bd.dr_backup})`);
console.log(`  high/low = ${(high / low).toFixed(2)}  | |bdSum-mid|/mid = ${(Math.abs(bdSum - mid) / mid * 100).toFixed(2)}%\n`);

check('A1 低 < 中 < 高', true, low < mid && mid < high);
check('A2 high/low ≤ 4', true, (high / low) <= 4);
check('A3 明細6項加總 ≈ 中估（誤差 <5%）', true, Math.abs(bdSum - mid) / mid < 0.05);
check('A4 中估 = 大字數字，且 ≠ 高估（無重複）', true, mid > 0 && mid !== high);

// Reproducibility: same input twice → identical numbers
const tco2 = calculateFinOpsTCO(bankInput);
check('A5 可重現：同輸入兩次數字一致',
  JSON.stringify([tco.aggressive, tco.recommended, tco.conservative]),
  JSON.stringify([tco2.aggressive, tco2.recommended, tco2.conservative]));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
