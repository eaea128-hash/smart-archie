/**
 * CloudFrame — Auth Module v2.0
 * 使用 Supabase Auth 取代 localStorage 明文儲存
 * 保持與 v1.0 相同的公開 API 介面，確保其他頁面無需修改
 *
 * 降級策略：若 Supabase 未設定，自動切換回 localStorage 模式（Demo 用）
 */

'use strict';

const Auth = (() => {

  const PLAN_QUOTA = { free: 3, pro: 30, enterprise: 999 };

  // ── 判斷使用哪種模式 ────────────────────────────────────────
  function useSupabase() {
    return typeof SupabaseClient !== 'undefined' && SupabaseClient.isConfigured();
  }

  function sb() {
    return (typeof SupabaseClient !== 'undefined' && SupabaseClient.getClient?.()) || null;
  }

  function monthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ════════════════════════════════════════════════════════════
  //  SUPABASE MODE
  // ════════════════════════════════════════════════════════════

  async function sbLogin(email, password) {
    const client = sb();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: _friendlyAuthError(error.message) };

    const { data: profile } = await client
      .from('profiles').select('*').eq('id', data.user.id).single();

    const user = {
      id:      data.user.id,
      email:   data.user.email,
      name:    profile?.name    || data.user.user_metadata?.name || email.split('@')[0],
      company: profile?.company || '',
      role:    profile?.role    || 'user',
      plan:    profile?.plan    || 'free',
    };
    _saTrack('User Logged In', { method: 'email' });
    return { success: true, user };
  }

  async function sbRegister({ name, email, password, company = '' }) {
    const client = sb();
    const { data, error } = await client.auth.signUp({
      email, password,
      options: {
        data: { name, company, role: 'user' },
        emailRedirectTo: `${location.origin}/login.html?verified=1`,
      },
    });
    if (error) return { success: false, error: _friendlyAuthError(error.message) };
    _saTrack('User Registered', { plan: 'free' });
    return { success: true, needsVerification: !data.session, user: { email, name } };
  }

  async function sbLogout() {
    await sb()?.auth.signOut();
    _saReset();
    window.location.href = 'login.html';
  }

  async function sbCurrentUser() {
    const client = sb();
    const { data: { session } } = await client.auth.getSession();
    if (!session) return null;
    const { data: profile } = await client
      .from('profiles').select('*').eq('id', session.user.id).single();
    return {
      id:      session.user.id,
      email:   session.user.email,
      name:    profile?.name    || session.user.user_metadata?.name || '',
      company: profile?.company || '',
      role:    profile?.role    || 'user',
      plan:    profile?.plan    || 'free',
    };
  }

  async function sbUpdateProfile(updates) {
    const client = sb();
    const { data: { session } } = await client.auth.getSession();
    if (!session) return false;
    const { error } = await client.from('profiles')
      .update({ name: updates.name, company: updates.company })
      .eq('id', session.user.id);
    return !error;
  }

  async function sbCheckQuota() {
    const client = sb();
    const { data: { session } } = await client.auth.getSession();
    if (!session) return { allowed: false, reason: '請先登入' };
    const { data: profile } = await client
      .from('profiles').select('plan').eq('id', session.user.id).single();
    const plan  = profile?.plan || 'free';
    const limit = PLAN_QUOTA[plan] || 3;
    const { data: quota } = await client.from('quota_usage').select('used')
      .eq('user_id', session.user.id).eq('month_key', monthKey()).single();
    const used = quota?.used || 0;
    return { allowed: used < limit, used, limit, remaining: limit - used, plan };
  }

  async function sbConsumeQuota() {
    const client = sb();
    const { data: { session } } = await client.auth.getSession();
    if (!session) return false;
    const { error } = await client.rpc('increment_quota', {
      p_user_id: session.user.id, p_month_key: monthKey(),
    });
    return !error;
  }

  async function sbGetAllUsers() {
    const client = sb();
    const { data, error } = await client
      .from('admin_user_stats').select('*').order('created_at', { ascending: false });
    return error ? [] : (data || []);
  }

  async function sbUpdateUserPlan(userId, plan) {
    const { error } = await sb().from('profiles').update({ plan }).eq('id', userId);
    return !error;
  }

  async function sbUpdateUserRole(userId, role) {
    const { error } = await sb().from('profiles').update({ role }).eq('id', userId);
    return !error;
  }

  async function sbForgotPassword(email) {
    const { error } = await sb().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password.html`,
    });
    return !error;
  }

  async function sbResetPassword(newPassword) {
    const { error } = await sb().auth.updateUser({ password: newPassword });
    return !error;
  }

  // ════════════════════════════════════════════════════════════
  //  LOCALSTORAGE FALLBACK MODE
  // ════════════════════════════════════════════════════════════

  const LS = {
    USERS:   'archie_users',
    SESSION: 'archie_session',
    QUOTA:   (id) => `archie_quota_${id}`,
  };

  function lsGet(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  function lsSeedDemo() {
    const users = lsGet(LS.USERS, []);
    if (users.length) return;
    lsSet(LS.USERS, [
      { id:'demo-001', name:'Demo User', email:'demo@smartarchie.ai',  password:'demo1234',  role:'user',  plan:'pro',        company:'CloudFrame Demo' },
      { id:'admin-001',name:'Admin',     email:'admin@smartarchie.ai', password:'admin1234', role:'admin', plan:'enterprise', company:'CloudFrame' },
    ]);
  }

  function lsLogin(email, password) {
    lsSeedDemo();
    const user = lsGet(LS.USERS, []).find(u => u.email === email && u.password === password);
    if (!user) return { success: false, error: '帳號或密碼不正確，請確認後再試' };
    lsSet(LS.SESSION, { userId: user.id, loginAt: Date.now() });
    return { success: true, user: { ...user, password: undefined } };
  }

  function lsRegister({ name, email, password, company = '' }) {
    lsSeedDemo();
    const users = lsGet(LS.USERS, []);
    if (users.find(u => u.email === email)) return { success: false, error: '此 Email 已被使用' };
    const user = { id: 'u_' + Date.now(), name, email, password, company, role: 'user', plan: 'free' };
    users.push(user);
    lsSet(LS.USERS, users);
    lsSet(LS.SESSION, { userId: user.id, loginAt: Date.now() });
    return { success: true, user: { ...user, password: undefined } };
  }

  function lsLogout() { localStorage.removeItem(LS.SESSION); window.location.href = 'login.html'; }

  function lsCurrentUser() {
    lsSeedDemo();
    const session = lsGet(LS.SESSION, null);
    if (!session) return null;
    const user = lsGet(LS.USERS, []).find(u => u.id === session.userId);
    return user ? { ...user, password: undefined } : null;
  }

  function lsUpdateProfile(updates) {
    const session = lsGet(LS.SESSION, null);
    if (!session) return false;
    const users = lsGet(LS.USERS, []);
    const idx   = users.findIndex(u => u.id === session.userId);
    if (idx < 0) return false;
    Object.assign(users[idx], updates);
    lsSet(LS.USERS, users);
    return true;
  }

  function lsCheckQuota() {
    const user  = lsCurrentUser();
    if (!user) return { allowed: false, reason: '請先登入' };
    const limit = PLAN_QUOTA[user.plan] || 3;
    const mk    = monthKey();
    const quota = lsGet(LS.QUOTA(user.id), { month: '', used: 0 });
    if (quota.month !== mk) { quota.month = mk; quota.used = 0; }
    return { allowed: quota.used < limit, used: quota.used, limit, remaining: limit - quota.used, plan: user.plan };
  }

  function lsConsumeQuota() {
    const user = lsCurrentUser();
    if (!user) return false;
    const mk    = monthKey();
    const quota = lsGet(LS.QUOTA(user.id), { month: mk, used: 0 });
    if (quota.month !== mk) { quota.month = mk; quota.used = 0; }
    quota.used++;
    lsSet(LS.QUOTA(user.id), quota);
    return true;
  }

  function lsGetAllUsers() {
    lsSeedDemo();
    return lsGet(LS.USERS, []).map(u => ({ ...u, password: undefined }));
  }

  // ════════════════════════════════════════════════════════════
  //  UNIFIED PUBLIC API
  // ════════════════════════════════════════════════════════════

  let _cachedUser = null;
  let _cacheTs    = 0;

  async function _getUser() {
    const now = Date.now();
    if (_cachedUser && now - _cacheTs < 30_000) return _cachedUser;
    _cachedUser = useSupabase() ? await sbCurrentUser() : lsCurrentUser();
    _cacheTs    = now;
    return _cachedUser;
  }

  function _clearCache() { _cachedUser = null; _cacheTs = 0; }

  // Analytics helpers（不強依賴）
  function _saTrack(event, props) {
    try { if (typeof SA_Analytics !== 'undefined') SA_Analytics.track(event, props); } catch {}
  }
  function _saReset() {
    try { if (typeof SA_Analytics !== 'undefined') SA_Analytics.reset(); } catch {}
  }

  // 友善錯誤訊息
  function _friendlyAuthError(msg) {
    if (!msg) return '發生未知錯誤，請重試';
    if (msg.includes('Invalid login'))       return '帳號或密碼不正確，請確認後再試';
    if (msg.includes('Email not confirmed')) return '請先點擊驗證信中的連結啟用帳號';
    if (msg.includes('User already registered')) return '此 Email 已被使用，請直接登入';
    if (msg.includes('Password should be'))  return '密碼長度至少需要 6 個字元';
    if (msg.includes('rate limit'))          return '嘗試次數過多，請稍後再試';
    return msg;
  }

  // ── Public methods ─────────────────────────────────────────

  async function login(email, password) {
    const result = useSupabase() ? await sbLogin(email, password) : lsLogin(email, password);
    if (result.success) { _cachedUser = result.user; _cacheTs = Date.now(); }
    return result;
  }

  async function register(opts) {
    return useSupabase() ? sbRegister(opts) : lsRegister(opts);
  }

  async function logout() {
    _clearCache();
    return useSupabase() ? sbLogout() : lsLogout();
  }

  function currentUser() {
    if (_cachedUser) return _cachedUser;
    if (!useSupabase()) return lsCurrentUser();
    return null;
  }

  async function currentUserAsync() { return _getUser(); }

  function isLoggedIn() {
    if (!useSupabase()) return !!lsCurrentUser();
    return !!Object.keys(localStorage).find(k => k.includes('supabase') && k.includes('auth-token'));
  }

  function requireAuth(redirect = 'login.html') {
    if (!isLoggedIn()) { window.location.href = redirect; return false; }
    return true;
  }

  async function requireAdmin() {
    const user = await _getUser();
    if (!user || user.role !== 'admin') { window.location.href = 'dashboard.html'; return false; }
    return true;
  }

  async function checkQuota()    { return useSupabase() ? sbCheckQuota()    : lsCheckQuota();    }
  async function consumeQuota()  { return useSupabase() ? sbConsumeQuota()  : lsConsumeQuota();  }
  async function updateProfile(u){ _clearCache(); return useSupabase() ? sbUpdateProfile(u) : lsUpdateProfile(u); }
  async function getAllUsers()    { return useSupabase() ? sbGetAllUsers()   : lsGetAllUsers();   }
  async function updateUserPlan(id, plan) { return useSupabase() ? sbUpdateUserPlan(id, plan) : false; }
  async function updateUserRole(id, role) { return useSupabase() ? sbUpdateUserRole(id, role) : false; }
  async function forgotPassword(email)    { return useSupabase() ? sbForgotPassword(email)    : false; }
  async function resetPassword(pw)        { return useSupabase() ? sbResetPassword(pw)        : false; }

  async function getQuota(userId) {
    if (useSupabase()) {
      const { data } = await sb().from('quota_usage').select('used')
        .eq('user_id', userId).eq('month_key', monthKey()).single();
      return { month: monthKey(), used: data?.used || 0 };
    }
    return lsGet(LS.QUOTA(userId), { month: monthKey(), used: 0 });
  }

  async function injectNavUser() {
    const user = await _getUser();
    const quotaEl = document.getElementById('nav-quota');

    if (!user) {
      if (quotaEl) quotaEl.textContent = '未登入';
      return;
    }

    // 各種 data-attribute 注入
    document.querySelectorAll('[data-nav-user-name]').forEach(el  => { el.textContent = user.name || user.email; });
    document.querySelectorAll('[data-nav-user-email]').forEach(el => { el.textContent = user.email; });
    document.querySelectorAll('[data-nav-user-plan]').forEach(el  => { el.textContent = (user.plan || 'free').toUpperCase(); });

    // Quota 顯示
    if (quotaEl) {
      const q = await checkQuota().catch(() => ({ used: 0, limit: 3 }));
      quotaEl.textContent = `${q.used}/${q.limit} 次`;
    }

    // 管理員連結
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      el.style.display = user.role === 'admin' ? '' : 'none';
    });
    const adminLinkEl = document.getElementById('adminLink');
    if (adminLinkEl) adminLinkEl.style.display = user.role === 'admin' ? '' : 'none';

    // Sidebar + navbar avatar
    const initial = (user.name || user.email || 'U')[0].toUpperCase();
    const map = {
      sidebarUserName:  user.name || user.email,
      sidebarUserEmail: user.email,
      sidebarUserPlan:  (user.plan || 'free').toUpperCase(),
      sidebarAvatar:    initial,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });

    // Navbar avatar — update text + add click-to-profile
    const navAvatar = document.getElementById('nav-avatar');
    if (navAvatar) {
      navAvatar.textContent = initial;
      navAvatar.title = `${user.name || user.email}（點擊前往個人資料）`;
      if (!navAvatar._clickBound) {
        navAvatar._clickBound = true;
        navAvatar.addEventListener('click', () => {
          // If on dashboard, switch to profile tab; else navigate there
          if (typeof switchTab === 'function') {
            switchTab('profile');
          } else {
            window.location.href = 'dashboard.html#profile';
          }
        });
      }
    }

    // Analytics identify
    _saTrack('__identify__', { $email: user.email, $name: user.name, plan: user.plan });
  }

  // Supabase auth state listener
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      if (useSupabase()) {
        sb()?.auth.onAuthStateChange(() => _clearCache());
      }
    });
  }

  return {
    login, register, logout,
    currentUser, currentUserAsync,
    isLoggedIn, requireAuth, requireAdmin,
    checkQuota, consumeQuota,
    updateProfile, getAllUsers,
    updateUserPlan, updateUserRole,
    forgotPassword, resetPassword,
    injectNavUser, getQuota,
    PLAN_QUOTA, useSupabase,
  };

})();
