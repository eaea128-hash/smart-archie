/* ============================================================
   Smart Archie — Shared Utilities
   Version 1.0
   ============================================================ */

'use strict';

// ── Toast Notifications ──────────────────────────────────────
const Toast = (() => {
  let container = null;
  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }
  function show({ title, message = '', type = 'info', duration = 4000 }) {
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-msg">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
    `;
    getContainer().appendChild(el);
    if (duration > 0) {
      setTimeout(() => {
        el.style.animation = 'toastOut 0.3s ease both';
        setTimeout(() => el.remove(), 300);
      }, duration);
    }
    return el;
  }
  return {
    info:    (title, msg) => show({ title, message: msg, type: 'info' }),
    success: (title, msg) => show({ title, message: msg, type: 'success' }),
    warning: (title, msg) => show({ title, message: msg, type: 'warning' }),
    error:   (title, msg) => show({ title, message: msg, type: 'error', duration: 6000 }),
  };
})();

// ── Loading Overlay ──────────────────────────────────────────
const Loading = (() => {
  let overlay = null;
  function get() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="spinner spinner-lg" style="border-top-color:var(--c-accent-teal);border-color:rgba(255,255,255,0.15)"></div>
        <div class="loading-text" id="loading-text">分析中...</div>
        <div class="loading-sub" id="loading-sub">AI 雲端顧問正在評估您的需求</div>
      `;
      document.body.appendChild(overlay);
    }
    return overlay;
  }
  return {
    show(text = '分析中...', sub = 'AI 雲端顧問正在評估您的需求') {
      const o = get();
      o.querySelector('#loading-text').textContent = text;
      o.querySelector('#loading-sub').textContent = sub;
      o.classList.add('active');
    },
    hide() { get().classList.remove('active'); },
    setText(text, sub) {
      const o = get();
      if (text) o.querySelector('#loading-text').textContent = text;
      if (sub)  o.querySelector('#loading-sub').textContent = sub;
    }
  };
})();

// ── DOM Helpers ──────────────────────────────────────────────
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  });
  children.forEach(c => {
    if (typeof c === 'string') e.insertAdjacentHTML('beforeend', c);
    else if (c) e.appendChild(c);
  });
  return e;
}
function show(elOrSel) {
  const e = typeof elOrSel === 'string' ? $(elOrSel) : elOrSel;
  if (e) e.classList.remove('hidden');
}
function hide(elOrSel) {
  const e = typeof elOrSel === 'string' ? $(elOrSel) : elOrSel;
  if (e) e.classList.add('hidden');
}
function toggle(elOrSel, force) {
  const e = typeof elOrSel === 'string' ? $(elOrSel) : elOrSel;
  if (e) e.classList.toggle('hidden', force);
}

// ── Animate Progress Bars ────────────────────────────────────
function animateKPI(container) {
  const items = $$(`.kpi-fill, .progress-fill`, container || document);
  items.forEach(item => {
    const target = item.dataset.width || item.style.getPropertyValue('--target') || '0%';
    requestAnimationFrame(() => {
      setTimeout(() => { item.style.width = target; }, 100);
    });
  });
}

// ── Format Helpers ───────────────────────────────────────────
const fmt = {
  number(n) { return new Intl.NumberFormat('zh-TW').format(n); },
  currency(n, currency = 'USD') {
    if (currency === 'USD') return `$${fmt.number(n)}`;
    return `NT$${fmt.number(n)}`;
  },
  percent(n) { return `${Math.round(n)}%`; },
  date(d) {
    const date = d ? new Date(d) : new Date();
    return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  },
  datetime(d) {
    const date = d ? new Date(d) : new Date();
    return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  },
  relativeTime(d) {
    const diff = (Date.now() - new Date(d)) / 1000;
    if (diff < 60)    return '剛剛';
    if (diff < 3600)  return `${Math.floor(diff/60)} 分鐘前`;
    if (diff < 86400) return `${Math.floor(diff/3600)} 小時前`;
    if (diff < 86400*7) return `${Math.floor(diff/86400)} 天前`;
    return fmt.date(d);
  },
};

// ── Local Storage Helpers ────────────────────────────────────
const Store = {
  get(key, def = null) {
    try { const v = localStorage.getItem(`archie_${key}`); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(key, value) {
    try { localStorage.setItem(`archie_${key}`, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) { localStorage.removeItem(`archie_${key}`); },
  clear() {
    Object.keys(localStorage).filter(k => k.startsWith('archie_')).forEach(k => localStorage.removeItem(k));
  }
};

// ── Toggle Group Helper ──────────────────────────────────────
function initToggleGroup(container, multiSelect = false) {
  const buttons = $$(`.toggle-btn`, container);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (multiSelect) {
        btn.classList.toggle('active');
      } else {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      container.dispatchEvent(new Event('change'));
    });
  });
}
function getToggleValue(container) {
  const active = $$('.toggle-btn.active', container);
  return active.map(b => b.dataset.value || b.textContent.trim());
}

// ── Accordion ────────────────────────────────────────────────
function initAccordions(ctx = document) {
  $$('.accordion-header', ctx).forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      item.classList.toggle('open');
    });
  });
}

// ── Tabs ─────────────────────────────────────────────────────
function initTabs(ctx = document) {
  $$('.tab-btn', ctx).forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('[data-tabs]') || btn.closest('.tab-container') || btn.parentElement.parentElement;
      const target = btn.dataset.tab;
      $$('.tab-btn', parent).forEach(b => b.classList.remove('active'));
      $$('.tab-panel', parent).forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = $(`#${target}`, parent) || $(`[data-tab-panel="${target}"]`, parent);
      if (panel) panel.classList.add('active');
    });
  });
}

// ── Range Sliders ────────────────────────────────────────────
function initRangeSliders(ctx = document) {
  $$('input[type="range"]', ctx).forEach(input => {
    const display = $(`.range-value[data-for="${input.id}"]`, ctx) ||
                    input.closest('.range-group')?.querySelector('.range-value');
    function update() {
      if (display) display.textContent = input.dataset.suffix
        ? `${input.value}${input.dataset.suffix}`
        : input.value;
    }
    input.addEventListener('input', update);
    update();
  });
}

// ── Badge Colors ─────────────────────────────────────────────
function strategyBadgeClass(strategy) {
  const map = {
    rehost: 'badge-teal', replatform: 'badge-gold', refactor: 'badge-primary',
    retain: 'badge-warning', retire: 'badge-neutral', repurchase: 'badge-success'
  };
  return map[(strategy||'').toLowerCase()] || 'badge-neutral';
}
function riskColor(score) {
  if (score >= 75) return 'danger';
  if (score >= 50) return 'warning';
  if (score >= 30) return 'info';
  return 'success';
}
function scoreColor(score) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

// ── Copy to Clipboard ────────────────────────────────────────
async function copyText(text, successMsg = '已複製到剪貼板') {
  try {
    await navigator.clipboard.writeText(text);
    Toast.success(successMsg);
  } catch {
    Toast.error('複製失敗', '請手動選取複製');
  }
}

// ── Scroll Reveal ────────────────────────────────────────────
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('animate-up');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  $$('[data-reveal]').forEach(el => observer.observe(el));
}

// ── Validate Form ────────────────────────────────────────────
function validateRequired(form) {
  let valid = true;
  $$('[required]', form).forEach(input => {
    const group = input.closest('.form-group');
    if (!input.value.trim()) {
      valid = false;
      group?.classList.add('has-error');
      const errEl = group?.querySelector('.form-error');
      if (errEl && !errEl.textContent) errEl.textContent = '此欄位為必填';
    } else {
      group?.classList.remove('has-error');
    }
  });
  return valid;
}

// ── Generate ID ──────────────────────────────────────────────
function genId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
}

// ── Debounce ─────────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ── Strategy Labels ──────────────────────────────────────────
const STRATEGY_LABELS = {
  rehost:      '直接遷移 Rehost',
  replatform:  '平台調整 Replatform',
  refactor:    '架構重構 Refactor',
  retain:      '暫緩保留 Retain',
  retire:      '下線退場 Retire',
  repurchase:  '採用 SaaS Repurchase',
};
const STRATEGY_ICONS = {
  rehost: '🔄', replatform: '⚡', refactor: '🏗️', retain: '🔒', retire: '🗑️', repurchase: '☁️'
};

// ── Export ───────────────────────────────────────────────────
window.SA = {
  Toast, Loading, $, $$, el, show, hide, toggle,
  animateKPI, fmt, Store, initToggleGroup, getToggleValue,
  initAccordions, initTabs, initRangeSliders,
  strategyBadgeClass, riskColor, scoreColor,
  copyText, initScrollReveal, validateRequired,
  genId, debounce, STRATEGY_LABELS, STRATEGY_ICONS,
};

// Init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  SA.initAccordions();
  SA.initTabs();
  SA.initRangeSliders();
  SA.initScrollReveal();
});
