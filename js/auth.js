/* ============================================================
   Smart Archie — Auth Module (LocalStorage-based simulation)
   In production: replace with Supabase / JWT authentication
   ============================================================ */

'use strict';

const Auth = (() => {
  const USERS_KEY    = 'archie_users';
  const SESSION_KEY  = 'archie_session';
  const QUOTA_KEY    = 'archie_quota';

  // Seed a demo user on first load
  function seedDemoUser() {
    const users = getUsers();
    if (!users.find(u => u.email === 'demo@smartarchie.ai')) {
      users.push({
        id: 'user_demo',
        name: '王大明',
        email: 'demo@smartarchie.ai',
        password: 'demo1234',
        role: 'user',
        plan: 'pro',
        company: 'Archie Demo Corp',
        createdAt: new Date(Date.now() - 86400 * 30 * 1000).toISOString(),
        avatar: 'WD',
      });
      users.push({
        id: 'user_admin',
        name: '系統管理員',
        email: 'admin@smartarchie.ai',
        password: 'admin1234',
        role: 'admin',
        plan: 'enterprise',
        company: 'Smart Archie',
        createdAt: new Date(Date.now() - 86400 * 90 * 1000).toISOString(),
        avatar: 'SA',
      });
      saveUsers(users);
    }
  }

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
    catch { return []; }
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }
  function saveSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, password: undefined })); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function login(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return { success: false, error: '電子信箱或密碼不正確' };
    saveSession(user);
    return { success: true, user };
  }

  function register({ name, email, password, company = '' }) {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: '此電子信箱已被使用' };
    }
    const avatar = name.split('').slice(0, 2).map(c => c.toUpperCase()).join('');
    const newUser = {
      id: `user_${Date.now().toString(36)}`,
      name, email, password, company,
      role: 'user', plan: 'free',
      createdAt: new Date().toISOString(),
      avatar,
    };
    users.push(newUser);
    saveUsers(users);
    saveSession(newUser);
    return { success: true, user: newUser };
  }

  function logout() {
    clearSession();
    window.location.href = 'login.html';
  }

  function currentUser() { return getSession(); }

  function isLoggedIn() { return !!getSession(); }

  function requireAuth(redirect = 'login.html') {
    if (!isLoggedIn()) {
      window.location.href = redirect;
      return false;
    }
    return true;
  }

  function requireAdmin() {
    const user = currentUser();
    if (!user || user.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  }

  // ── Quota Management ────────────────────────────────────
  const PLAN_QUOTA = { free: 3, pro: 30, enterprise: 999 };

  function getQuota(userId) {
    try {
      const key = `${QUOTA_KEY}_${userId}`;
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      const thisMonth = new Date().toISOString().slice(0, 7);
      if (!data || data.month !== thisMonth) {
        return { month: thisMonth, used: 0 };
      }
      return data;
    } catch { return { month: new Date().toISOString().slice(0, 7), used: 0 }; }
  }

  function saveQuota(userId, data) {
    localStorage.setItem(`${QUOTA_KEY}_${userId}`, JSON.stringify(data));
  }

  function checkQuota() {
    const user = currentUser();
    if (!user) return { allowed: false, reason: '未登入' };
    const limit = PLAN_QUOTA[user.plan] || 3;
    const quota = getQuota(user.id);
    if (quota.used >= limit) {
      return { allowed: false, used: quota.used, limit, reason: `本月分析額度 (${limit} 次) 已用完，請升級方案` };
    }
    return { allowed: true, used: quota.used, limit, remaining: limit - quota.used };
  }

  function consumeQuota() {
    const user = currentUser();
    if (!user) return false;
    const quota = getQuota(user.id);
    quota.used += 1;
    saveQuota(user.id, quota);
    return true;
  }

  // ── Profile helpers ──────────────────────────────────────
  function updateProfile(updates) {
    const users = getUsers();
    const user  = currentUser();
    if (!user) return false;
    const idx = users.findIndex(u => u.id === user.id);
    if (idx === -1) return false;
    const updated = { ...users[idx], ...updates };
    users[idx] = updated;
    saveUsers(users);
    saveSession(updated);
    return true;
  }

  function getAllUsers() { return getUsers().map(u => ({ ...u, password: undefined })); }

  // ── Render user info in nav ──────────────────────────────
  function injectNavUser() {
    const user = currentUser();
    if (!user) return;
    const avatarEl = document.getElementById('nav-avatar');
    const nameEl   = document.getElementById('nav-name');
    const quotaEl  = document.getElementById('nav-quota');
    const quota = getQuota(user.id);
    const limit = PLAN_QUOTA[user.plan] || 3;
    if (avatarEl) avatarEl.textContent = user.avatar || user.name.slice(0, 2);
    if (nameEl)   nameEl.textContent   = user.name;
    if (quotaEl)  quotaEl.textContent  = `${quota.used}/${limit} 次`;
  }

  // Init
  seedDemoUser();

  return {
    login, register, logout, currentUser, isLoggedIn,
    requireAuth, requireAdmin, checkQuota, consumeQuota,
    updateProfile, getAllUsers, getQuota,
    PLAN_QUOTA, injectNavUser,
  };
})();

window.Auth = Auth;
