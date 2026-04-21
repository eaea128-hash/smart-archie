/**
 * Smart Archie — Analytics & Monitoring Module
 * 整合 Sentry（錯誤監控）+ Mixpanel（使用分析）
 *
 * 使用方式（所有頁面統一呼叫）：
 *   SA_Analytics.track('Event Name', { key: value })
 *   SA_Analytics.identify(userId, { email, name, plan })
 *   SA_Analytics.page('Page Name')
 *   SA_Analytics.reset()
 */

(function(global) {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────
  function _isMixpanel()  { return typeof global.mixpanel !== 'undefined'; }
  function _isSentry()    { return typeof global.Sentry   !== 'undefined'; }

  // ── 初始化（從 /api/config 讀取 token）─────────────────────
  async function init() {
    let cfg = global.__SA_CONFIG__ || {};
    if (!cfg.sentryDsn && !cfg.mixpanelToken) {
      try {
        cfg = await fetch('/api/config').then(r => r.json());
        global.__SA_CONFIG__ = cfg;
      } catch { return; }
    }

    // ── Sentry 初始化 ──────────────────────────────────────
    if (cfg.sentryDsn && _isSentry()) {
      Sentry.init({
        dsn:         cfg.sentryDsn,
        environment: cfg.environment || 'production',
        release:     'smart-archie@2.0.0',
        tracesSampleRate: 0.2,
        ignoreErrors: [
          'ResizeObserver loop limit exceeded',
          'Non-Error promise rejection',
        ],
        beforeSend(event) {
          // 移除敏感欄位
          if (event.request?.headers?.Authorization) {
            delete event.request.headers.Authorization;
          }
          return event;
        },
      });
    }

    // ── Mixpanel 初始化 ────────────────────────────────────
    if (cfg.mixpanelToken && _isMixpanel()) {
      mixpanel.init(cfg.mixpanelToken, {
        debug:            cfg.environment !== 'production',
        track_pageview:   true,
        persistence:      'localStorage',
        ignore_dnt:       false,
        batch_requests:   true,
        batch_flush_interval_ms: 5000,
      });
    }

    // 自動記錄頁面
    _autoPage();
  }

  function _autoPage() {
    const pageNames = {
      'index.html':           '首頁',
      'analyze.html':         '分析工具',
      'dashboard.html':       '用戶儀表板',
      'admin-dashboard.html': '管理員後台',
      'login.html':           '登入頁',
      'register.html':        '註冊頁',
      'trends.html':          '趨勢雷達',
      'share.html':           '分享報告',
    };
    const file = location.pathname.split('/').pop() || 'index.html';
    const name = pageNames[file] || file;
    page(name);
  }

  // ── Track 事件 ──────────────────────────────────────────────
  function track(event, props = {}) {
    const enriched = {
      ...props,
      timestamp:   new Date().toISOString(),
      page:        location.pathname,
      app_version: '2.0.0',
    };

    if (_isMixpanel()) {
      try { mixpanel.track(event, enriched); } catch {}
    }

    // Sentry breadcrumb
    if (_isSentry()) {
      try {
        Sentry.addBreadcrumb({
          category: 'user-action',
          message:  event,
          data:     enriched,
          level:    'info',
        });
      } catch {}
    }

    // Dev log
    if (typeof global.__SA_CONFIG__?.environment !== 'undefined' &&
        global.__SA_CONFIG__.environment !== 'production') {
      console.log(`[Analytics] ${event}`, enriched);
    }
  }

  // ── 識別用戶 ────────────────────────────────────────────────
  function identify(userId, traits = {}) {
    if (!userId) return;

    if (_isMixpanel()) {
      try {
        mixpanel.identify(userId);
        mixpanel.people.set({
          $email:    traits.email,
          $name:     traits.name,
          plan:      traits.plan,
          company:   traits.company,
          $last_seen: new Date().toISOString(),
        });
      } catch {}
    }

    if (_isSentry()) {
      try {
        Sentry.setUser({
          id:    userId,
          email: traits.email,
          username: traits.name,
        });
      } catch {}
    }
  }

  // ── 頁面追蹤 ────────────────────────────────────────────────
  function page(name, props = {}) {
    if (_isMixpanel()) {
      try { mixpanel.track('Page View', { page_name: name, ...props }); } catch {}
    }
  }

  // ── 重設（登出時呼叫）──────────────────────────────────────
  function reset() {
    if (_isMixpanel()) { try { mixpanel.reset(); } catch {} }
    if (_isSentry())   { try { Sentry.setUser(null); } catch {} }
  }

  // ── 錯誤回報 ────────────────────────────────────────────────
  function captureError(err, context = {}) {
    console.error('[Analytics] Captured error:', err);
    if (_isSentry()) {
      try {
        Sentry.withScope(scope => {
          Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
          Sentry.captureException(err);
        });
      } catch {}
    }
  }

  // ── 預設事件快捷方式 ─────────────────────────────────────────
  const Events = {
    analysisStarted:   (inputs)  => track('Analysis Started',   { strategy: inputs?.cloudGoal, size: inputs?.companySize }),
    analysisCompleted: (result)  => track('Analysis Completed', { strategy: result?.strategy6R?.primary, source: result?.source, risk: result?.riskRadar?.overall }),
    reportExported:    (format)  => track('Report Exported',    { format }),
    reportShared:      ()        => track('Report Shared'),
    planUpgradeViewed: (plan)    => track('Plan Upgrade Viewed', { target_plan: plan }),
    loginSuccess:      (method)  => track('Login Success',       { method: method || 'email' }),
    registerSuccess:   ()        => track('Register Success'),
    trendsViewed:      (category)=> track('Trends Viewed',       { category }),
  };

  // ── Public API ──────────────────────────────────────────────
  global.SA_Analytics = { init, track, identify, page, reset, captureError, Events };

  // 自動初始化
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);
