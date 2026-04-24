/**
 * CloudFrame — Email 共用模組
 * 使用 Resend API 發送交易型 Email
 * 此為內部 helper，不是 Netlify Function endpoint
 *
 * 需要環境變數：RESEND_API_KEY
 */

const RESEND_API = 'https://api.resend.com/emails';
// 使用已驗證的 Resend 網域（待購買 cloudframe.ai 後換回 noreply@cloudframe.ai）
const FROM       = process.env.EMAIL_FROM || 'CloudFrame <onboarding@resend.dev>';
const BRAND_COLOR = '#0F2B3D';
const TEAL_COLOR  = '#1A9BB5';

// ── 品牌 Email 外框 ───────────────────────────────────────────
function emailWrapper(content) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudFrame</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F8;font-family:Inter,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:28px 40px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;height:36px;background:${TEAL_COLOR};border-radius:8px;text-align:center;line-height:36px;">
                  <span style="color:white;font-weight:800;font-size:18px;">A</span>
                </td>
                <td style="padding-left:12px;">
                  <div style="color:white;font-size:18px;font-weight:700;letter-spacing:-0.3px;">CloudFrame</div>
                  <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:1px;">AI Cloud Strategy Advisor</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFB;padding:24px 40px;border-top:1px solid #E8EDF2;">
            <p style="margin:0;font-size:12px;color:#8A9BAB;text-align:center;line-height:1.6;">
              © 2026 CloudFrame ·
              <a href="https://unique-jelly-da79b4.netlify.app/privacy.html" style="color:${TEAL_COLOR};text-decoration:none;">隱私政策</a> ·
              <a href="https://unique-jelly-da79b4.netlify.app/terms.html" style="color:${TEAL_COLOR};text-decoration:none;">服務條款</a>
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#B0BEC9;text-align:center;">
              您收到此信是因為您的帳號已啟用相關通知。如不希望收到，請<a href="mailto:privacy@cloudframe.ai" style="color:#B0BEC9;">聯絡我們</a>。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Email 模板 ────────────────────────────────────────────────

function welcomeTemplate({ name }) {
  return emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:${BRAND_COLOR};">歡迎加入 CloudFrame！🎉</h1>
    <p style="margin:0 0 24px;color:#6B7A8D;font-size:15px;">嗨 ${name}，您的帳號已就緒</p>

    <p style="color:#3D4F60;line-height:1.7;font-size:15px;">
      感謝您選擇 CloudFrame。您現在可以使用 AI 驅動的雲端遷移策略分析，每月享有 <strong>3 次免費分析額度</strong>。
    </p>

    <div style="background:#F0F9FC;border-left:4px solid ${TEAL_COLOR};border-radius:8px;padding:20px;margin:24px 0;">
      <p style="margin:0 0 12px;font-weight:600;color:${BRAND_COLOR};font-size:14px;">快速開始 3 步驟：</p>
      <p style="margin:6px 0;color:#3D4F60;font-size:14px;">① 前往<a href="https://unique-jelly-da79b4.netlify.app/analyze.html" style="color:${TEAL_COLOR};font-weight:600;">需求分析頁面</a></p>
      <p style="margin:6px 0;color:#3D4F60;font-size:14px;">② 填寫貴公司的雲端遷移需求</p>
      <p style="margin:6px 0;color:#3D4F60;font-size:14px;">③ 獲得 AI 生成的 6R 策略報告與成本估算</p>
    </div>

    <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr>
        <td>
          <a href="https://unique-jelly-da79b4.netlify.app/analyze.html"
             style="display:inline-block;background:${TEAL_COLOR};color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
            開始第一次分析 →
          </a>
        </td>
      </tr>
    </table>

    <p style="color:#8A9BAB;font-size:13px;line-height:1.6;">
      如有任何問題，歡迎隨時聯絡 <a href="mailto:contact@cloudframe.ai" style="color:${TEAL_COLOR};">contact@cloudframe.ai</a>
    </p>
  `);
}

function quotaWarningTemplate({ name, used, limit, plan }) {
  const pct        = Math.round((used / limit) * 100);
  const remaining  = limit - used;
  const isNearFull = remaining <= 1;
  const barColor   = isNearFull ? '#E53E3E' : '#C9A84C';

  return emailWrapper(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:${BRAND_COLOR};">
      ${isNearFull ? '⚠️ 分析額度即將用完' : '📊 分析額度提醒'}
    </h1>
    <p style="margin:0 0 24px;color:#6B7A8D;font-size:15px;">嗨 ${name}</p>

    <p style="color:#3D4F60;line-height:1.7;font-size:15px;">
      您本月已使用 <strong>${used} 次</strong>分析，共 ${limit} 次可用額度（${pct}%）。
      ${isNearFull
        ? `<br>您僅剩 <strong style="color:#E53E3E;">${remaining} 次</strong>，請考慮升級 Pro 方案以繼續使用。`
        : `<br>尚餘 <strong>${remaining} 次</strong>可用。`
      }
    </p>

    <!-- 進度條 -->
    <div style="background:#E8EDF2;border-radius:99px;height:10px;margin:20px 0;overflow:hidden;">
      <div style="background:${barColor};width:${pct}%;height:100%;border-radius:99px;transition:width 0.3s;"></div>
    </div>
    <p style="text-align:right;font-size:12px;color:#8A9BAB;margin:-16px 0 20px;">${used}/${limit} 次</p>

    ${plan !== 'pro' && plan !== 'enterprise' ? `
    <div style="background:linear-gradient(135deg,#F7F3E8,#FDF8EE);border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:24px;margin:24px 0;">
      <p style="margin:0 0 8px;font-weight:700;color:${BRAND_COLOR};font-size:15px;">🚀 升級 Pro — 每月 NT$1,990</p>
      <p style="margin:0 0 16px;color:#6B7A8D;font-size:14px;line-height:1.6;">每月 30 次分析 · PDF 匯出 · 歷史記錄無限保存</p>
      <a href="https://unique-jelly-da79b4.netlify.app/dashboard.html#plan"
         style="display:inline-block;background:${BRAND_COLOR};color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
        查看方案
      </a>
    </div>
    ` : ''}

    <p style="color:#8A9BAB;font-size:13px;">
      前往<a href="https://unique-jelly-da79b4.netlify.app/dashboard.html" style="color:${TEAL_COLOR};">儀表板</a>查看詳細使用記錄。
    </p>
  `);
}

// ── 傳送 Email ────────────────────────────────────────────────
export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY 未設定，略過寄信');
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const resp = await fetch(RESEND_API, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from: FROM, to, subject, html }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('[email] Resend error:', data);
      return { success: false, error: data.message || data.name };
    }

    console.log('[email] sent:', data.id, '→', to);
    return { success: true, id: data.id };

  } catch (err) {
    console.error('[email] network error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── 快捷方式 ──────────────────────────────────────────────────
export async function sendWelcomeEmail({ to, name }) {
  return sendEmail({
    to,
    subject: '歡迎加入 CloudFrame！您的帳號已就緒 🎉',
    html:    welcomeTemplate({ name }),
  });
}

export async function sendQuotaWarningEmail({ to, name, used, limit, plan }) {
  return sendEmail({
    to,
    subject: `CloudFrame 額度提醒：您已使用 ${used}/${limit} 次分析`,
    html:    quotaWarningTemplate({ name, used, limit, plan }),
  });
}
