import axios from 'axios';

// crypto.randomUUID() only exists in secure contexts (HTTPS, or the special-cased
// `localhost`) — on a live server reached over plain HTTP it's simply not a function,
// and calling it throws synchronously, before the request it's building for ever
// reaches axios. crypto.getRandomValues() IS available everywhere, so this still
// produces a proper random v4 UUID on http, only falling back to Math.random if even
// that's missing. Same implementation already proven in mern-ludo/src/utils/browser.js
// (randomId()) for the exact same reason — kept identical rather than reinvented.
const newKey = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'));
    return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join(''),
    ].join('-');
};

const http = axios.create({ baseURL: '/api/v1', withCredentials: true });

/* ── Attach JWT to every request ── */
http.interceptors.request.use(cfg => {
    const token = localStorage.getItem('panel_token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

/*
 * Normalize id → _id in response payloads so existing panel code
 * (which uses user._id) works with the new backend (which returns user.id).
 */
function normalizeIds(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        obj.forEach(normalizeIds);
        return;
    }
    if (obj.id !== undefined && obj._id === undefined) obj._id = obj.id;
    Object.values(obj).forEach(v => {
        if (v && typeof v === 'object') normalizeIds(v);
    });
}

/* ── Token-refresh state ── */
let isRefreshing  = false;
let failedQueue   = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
    failedQueue = [];
};

const forceLogout = () => {
    localStorage.removeItem('panel_user');
    localStorage.removeItem('panel_token');
    localStorage.removeItem('panel_refresh_token');
    window.location.replace('/login');
};

/* ── Auto-refresh on 401, logout only if refresh also fails ── */
http.interceptors.response.use(
    res => {
        if (res.data) normalizeIds(res.data);
        return res;
    },
    async err => {
        const original  = err.config;
        const url       = original?.url || '';
        const isAuth    = url.includes('/auth/');

        if (err.response?.status !== 401 || isAuth || original?._retry) {
            return Promise.reject(err);
        }

        const storedRefresh = localStorage.getItem('panel_refresh_token');
        if (!storedRefresh) { forceLogout(); return Promise.reject(err); }

        /* If a refresh is already running, queue this request */
        if (isRefreshing) {
            return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
                .then(newToken => {
                    original.headers.Authorization = `Bearer ${newToken}`;
                    return http(original);
                });
        }

        original._retry  = true;
        isRefreshing     = true;

        try {
            /* Use raw axios so this call bypasses our interceptor */
            const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken: storedRefresh });
            const { accessToken, refreshToken: newRefresh } = data.data;

            localStorage.setItem('panel_token', accessToken);
            if (newRefresh) localStorage.setItem('panel_refresh_token', newRefresh);

            processQueue(null, accessToken);

            original.headers.Authorization = `Bearer ${accessToken}`;
            return http(original);
        } catch (refreshErr) {
            processQueue(refreshErr, null);
            forceLogout();
            return Promise.reject(refreshErr);
        } finally {
            isRefreshing = false;
        }
    }
);

const clean = obj => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

/* ── Auth — Admin and Promoter both use the unified /auth endpoints ── */

/* Admin: login with email + password */
export const adminLogin = (email, password) => http.post('/auth/login-password', { identifier: email, password });

/* Promoter OTP login */
export const promoterSendOtp = (phone, country_code) =>
    http.post('/auth/send-otp', { mobile: `+${country_code}${phone}`, channel: 'mobile' });

export const promoterResendOtp = (phone, country_code) =>
    http.post('/auth/send-otp', { mobile: `+${country_code}${phone}`, channel: 'mobile' });

export const promoterVerifyOtp = (phone, otp, country_code) =>
    http.post('/auth/login-otp', { mobile: `+${country_code}${phone}`, otp, channel: 'mobile' });

/* Promoter password login (email or phone as identifier) */
export const promoterLoginEmail = (email, password) =>
    http.post('/auth/login-password', { identifier: email, password });

export const promoterLoginPhone = (phone, country_code, password) =>
    http.post('/auth/login-password', { identifier: `+${country_code}${phone}`, password });

/* Forgot / reset password — link-based only in new backend */
export const promoterForgotPassword = identifier => http.post('/auth/forgot-password', { identifier });

export const promoterResetPassword = (token, password) => http.post('/auth/reset-password', { token, password });

/*
 * OTP-based forgot password — NOT available in the new backend.
 * These stubs throw a descriptive error so callers get clear feedback.
 * Remove once the new backend exposes this feature.
 */
export const promoterForgotSendOtp = () =>
    Promise.reject({
        response: { data: { message: 'OTP-based password reset is not supported. Use the email reset link.' } },
    });

export const promoterForgotResetPassword = () =>
    Promise.reject({
        response: { data: { message: 'OTP-based password reset is not supported. Use the email reset link.' } },
    });

/* Promoter registration — initiates signup and sends OTP */
export const promoterSignupInit = ({ firstName, lastName, email, phone, password }) =>
    http.post('/auth/register-promoter', {
        mobile: phone.startsWith('+') ? phone : `+${phone}`,
        displayName: `${firstName} ${lastName}`.trim(),
        email,
        password,
    });

/* Verify OTP after signup to activate account and get session */
export const verifySignupOtp = ({ mobile, email, otp }) =>
    http.post('/auth/verify-signup', { mobile, email, otp, channel: 'mobile' });

/* Resend OTP for unverified account */
export const resendVerificationOtp = ({ mobile, email }) =>
    http.post('/auth/resend-verification', { mobile, email });

/* No longer needed — kept for backward compat */
export const promoterSignupComplete = () =>
    Promise.reject({
        response: { data: { message: 'Use verifySignupOtp to complete registration.' } },
    });

/* ── Session ── */
export const getMe    = ()      => http.get('/auth/me');
export const logoutApi = ()     => http.post('/auth/logout').catch(() => {});
export const changePassword = (currentPassword, newPassword) =>
    http.post('/auth/change-password', { currentPassword, newPassword });

/* ── Users (admin panel) ── */
export const fetchUsers = params => {
    const p = clean(params);
    /* Backend accepts combined 'name', not separate firstName/lastName */
    const nameParts = [p.firstName, p.lastName].filter(Boolean);
    if (nameParts.length) p.name = nameParts.join(' ');
    delete p.firstName;
    delete p.lastName;
    /* Map date range params */
    if (p.fromDate) { p.startDate = p.fromDate; delete p.fromDate; }
    if (p.toDate)   { p.endDate   = p.toDate;   delete p.toDate;   }
    /* Map verified filter → isVerified */
    if (p.verified === 'verified')   { p.isVerified = 'true';  delete p.verified; }
    if (p.verified === 'unverified') { p.isVerified = 'false'; delete p.verified; }
    if (p.verified === '' || p.verified === undefined) delete p.verified;
    /* Map active filter → isActive */
    if (p.active === 'active')   { p.isActive = 'true';  delete p.active; }
    if (p.active === 'inactive') { p.isActive = 'false'; delete p.active; }
    if (p.active === '' || p.active === undefined) delete p.active;
    /* Remove unsupported params */
    delete p.hasReferral;
    delete p.referralFrom;
    delete p.referralTo;
    /* Map status filter — backend accepts 'active'|'blocked'|'suspended'|'pending' */
    if (p.status === 'inactive') p.status = 'suspended';
    /* role is supported — keep it */
    return http.get('/admin/users', { params: p });
};

export const createUser = ({ firstName, lastName, email, phone, country_code, password, role }) => {
    const body = {
        displayName: `${firstName} ${lastName}`.trim(),
        role: role || 'user',
    };
    if (email)    body.email    = email;
    if (phone)    body.mobile   = `+${country_code || '91'}${phone.replace(/\D/g, '')}`;
    if (password) body.password = password;
    /* /admin/users handles all roles including promoter:
       when role=promoter it auto-creates PromoterProfile + referralCode */
    return http.post('/admin/users', body);
};

/* Change a user's role */
export const changeUserRole = (userId, role) => http.patch('/admin/change-role', { userId, role });

/* Block / unblock maps status toggle to separate new-backend endpoints */
export const updateUserStatus = (id, status) => {
    const isBlock = ['inactive', 'blocked', 'BLOCKED'].includes(status);
    return http.patch(isBlock ? '/admin/block-user' : '/admin/unblock-user', { userId: id });
};
export const blockUser   = (id) => http.patch('/admin/block-user',   { userId: id });
export const unblockUser = (id) => http.patch('/admin/unblock-user', { userId: id });

/* Wallet: credit (deposit) — new backend uses /admin/money-manage */
export const depositUser = (id, amount) =>
    http.post('/admin/money-manage', {
        userId: id,
        action: 'CREDIT',
        balanceType: 'DEPOSIT',
        amount: String(amount),
        reason: 'Admin deposit',
        idempotencyKey: newKey(),
    });

/* Wallet: debit (withdrawal) — new backend uses /admin/money-manage */
export const withdrawUser = (id, amount) =>
    http.post('/admin/money-manage', {
        userId: id,
        action: 'DEBIT',
        balanceType: 'DEPOSIT',
        amount: String(amount),
        reason: 'Admin withdrawal',
        idempotencyKey: newKey(),
    });

export const updateUser = (id, { firstName, lastName, displayName, email, mobile, phone, country_code }) => {
    const body = {};
    const name = displayName || [firstName, lastName].filter(Boolean).join(' ').trim();
    if (name)   body.displayName = name;
    if (email)  body.email       = email;
    const mob = mobile || (phone ? `+${country_code || '91'}${phone.replace(/\D/g, '')}` : null);
    if (mob)    body.mobile      = mob;
    return http.patch(`/admin/users/${id}`, body);
};
export const updateUserProfile = updateUser;
export const deleteUser = id => http.delete(`/admin/users/${id}`);

/* ── Promoters (admin panel) ── */
export const fetchPromoters = params => {
    const p = clean(params);
    /* Backend accepts combined 'name', not separate firstName/lastName */
    const nameParts = [p.firstName, p.lastName].filter(Boolean);
    if (nameParts.length) p.name = nameParts.join(' ');
    delete p.firstName;
    delete p.lastName;
    /* Map date range params */
    if (p.fromDate) { p.startDate = p.fromDate; delete p.fromDate; }
    if (p.toDate)   { p.endDate   = p.toDate;   delete p.toDate;   }
    /* Map verified/active UI filters → backend params */
    if (p.verified === 'verified')   { p.isVerified = 'true';  delete p.verified; }
    if (p.verified === 'unverified') { p.isVerified = 'false'; delete p.verified; }
    if (p.verified === '' || p.verified === undefined) delete p.verified;
    if (p.active === 'active')   { p.isActive = 'true';  delete p.active; }
    if (p.active === 'inactive') { p.isActive = 'false'; delete p.active; }
    if (p.active === '' || p.active === undefined) delete p.active;
    /* Map status filter */
    if (p.status === 'inactive') p.status = 'suspended';
    return http.get('/admin/promoters', { params: p });
};

export const createPromoter = ({ firstName, lastName, email, phone, country_code, password }) => {
    const body = {
        displayName: `${firstName} ${lastName}`.trim(),
        role: 'promoter',
    };
    if (email)    body.email    = email;
    if (phone)    body.mobile   = `+${country_code || '91'}${(phone || '').replace(/\D/g, '')}`;
    if (password) body.password = password;
    return http.post('/admin/users', body);
};

export const updatePromoter = (id, { firstName, lastName, displayName, email, mobile, phone, country_code }) => {
    const body = {};
    const name = displayName || [firstName, lastName].filter(Boolean).join(' ').trim();
    if (name)   body.displayName = name;
    if (email)  body.email       = email;
    const mob = mobile || (phone ? `+${country_code || '91'}${phone.replace(/\D/g, '')}` : null);
    if (mob)    body.mobile      = mob;
    return http.patch(`/admin/promoters/${id}`, body);
};
export const deletePromoter = id => http.delete(`/admin/promoters/${id}`);
export const updatePromoterStatus = (id, status) => {
    const endpoint = status === 'inactive' || status === 'blocked' ? '/admin/block-user' : '/admin/unblock-user';
    return http.patch(endpoint, { userId: id });
};

/* ── Boats (full CRUD via /admin/bots) ── */
export const fetchBoats   = params => http.get('/admin/bots', { params: clean(params) });
export const fetchBoatById = boatId => http.get(`/admin/bots/${boatId}`);
export const createBoat  = ({ displayName, email, phone, country_code, botDifficulty }) => {
    const body = {};
    if (botDifficulty)       body.botDifficulty = botDifficulty;
    if (displayName?.trim()) body.displayName = displayName.trim();
    if (email?.trim())       body.email       = email.trim();
    if (phone)               body.mobile      = `+${country_code || '91'}${(phone || '').replace(/\D/g, '')}`;
    return http.post('/admin/bots', body);
};
export const updateBoat = (id, data) => {
    const body = {};
    if (data.displayName !== undefined) body.displayName = data.displayName;
    if (data.email       !== undefined) body.email       = data.email;
    if (data.mobile      !== undefined) body.mobile      = data.mobile;
    if (data.botDifficulty !== undefined) body.botDifficulty = data.botDifficulty;
    return http.patch(`/admin/bots/${id}`, body);
};
export const updateBoatStatus = (id, status) => {
    const isBlock = ['inactive', 'blocked', 'BLOCKED'].includes(status);
    return http.patch(isBlock ? '/admin/block-user' : '/admin/unblock-user', { userId: id });
};
/* Live bulk change: one call sets every bot's difficulty (EASY | MEDIUM | HARD). */
export const setAllBotsDifficulty = botDifficulty => http.patch('/admin/bots/difficulty', { botDifficulty });
export const deleteBoat = id => http.delete(`/admin/bots/${id}`);

/* Boat wallet operations (reuse existing adminMoneyManage endpoint) */
export const depositBoat  = (id, amount) =>
    http.post('/admin/money-manage', { userId: id, action: 'CREDIT', balanceType: 'DEPOSIT', amount: String(amount), reason: 'Admin boat deposit',    idempotencyKey: newKey() });
export const withdrawBoat = (id, amount) =>
    http.post('/admin/money-manage', { userId: id, action: 'DEBIT',  balanceType: 'DEPOSIT', amount: String(amount), reason: 'Admin boat withdrawal', idempotencyKey: newKey() });

/* Boat transaction history (same wallet-transactions endpoint as users) */
export const fetchBoatTransactions = (boatId, params) =>
    http.get(`/admin/wallet/transactions/${boatId}`, { params: clean({ page: 1, limit: 20, ...params }) });

/* ── Global all-transactions view ── */
export const fetchAllTransactions = params =>
    http.get('/admin/transactions', { params: clean({ page: 1, limit: 20, ...params }) });
export const fetchTransactionTotals = params =>
    http.get('/admin/transactions/totals', { params: clean({ ...params }) });

/* ── Promoter self-service ── */
export const generateMyCode = () => http.post('/promoter/generate-code');
export const getMyStats     = () => http.get('/promoter/profile');
export const getMyReferrals = (params) =>
    http.get('/promoter/referrals', { params: clean({ page: params?.page || 1, limit: params?.limit || 20 }) });

/* Promoter's own wallet (uses general /wallet endpoints) */
export const getMyWalletBalance = () => http.get('/wallet/balance');
export const getMyWalletHistory = (params) =>
    http.get('/wallet/history', { params: clean({ page: params?.page || 1, limit: params?.limit || 20, ...params }) });

/* ── Admin: single user detail ── */
export const fetchUserById = (userId) => http.get(`/admin/users/${userId}`);

/* ── Pool Management ── */
export const fetchPools = (params) => {
    const p = clean({ page: 1, limit: 20, ...params });
    return http.get('/admin/pools', { params: p });
};
export const fetchPoolDetail  = (id) => http.get(`/admin/pools/${id}`);
export const createPool       = ({ name, description, entryFee, maxPlayers, targetOpenMatches, isActive, quickMatchEnabled }) =>
    http.post('/admin/pools', { name, description, entryFee: String(entryFee), maxPlayers, targetOpenMatches, isActive, quickMatchEnabled });
export const updatePool       = (id, { name, description, entryFee, maxPlayers, targetOpenMatches, isActive, quickMatchEnabled }) => {
    const body = {};
    if (name              !== undefined) body.name              = name;
    if (description       !== undefined) body.description       = description;
    if (entryFee          !== undefined) body.entryFee          = String(entryFee);
    if (maxPlayers        !== undefined) body.maxPlayers        = maxPlayers;
    if (targetOpenMatches !== undefined) body.targetOpenMatches = targetOpenMatches;
    if (isActive          !== undefined) body.isActive          = isActive;
    if (quickMatchEnabled !== undefined) body.quickMatchEnabled = quickMatchEnabled;
    return http.put(`/admin/pools/${id}`, body);
};
export const togglePool  = (id)       => http.patch(`/admin/pools/${id}/toggle`);
export const deletePool  = (id)       => http.delete(`/admin/pools/${id}`);

/* ── Match-wide settings (currently: Public Match on/off) ── */
export const fetchMatchSettings  = ()      => http.get('/admin/pools/settings');
export const updateMatchSettings = (body)  => http.patch('/admin/pools/settings', body);

/* ── Admin: promoter referrals list ── */
export const fetchPromoterReferrals = (promoterId, params) =>
    http.get(`/admin/promoter/${promoterId}/referrals`, { params: clean({ page: 1, limit: 20, ...params }) });

/* ── Admin: user/promoter transaction history ── */
export const fetchUserTransactions = (userId, params) =>
    http.get(`/admin/wallet/transactions/${userId}`, { params: clean({ page: 1, limit: 20, ...params }) });

/* Alias for promoter transactions (same endpoint) */
export const fetchPromoterTransactions = fetchUserTransactions;

/* ── Admin: Match Recovery (stuck matches after a crash / failed transaction) ── */
export const newIdempotencyKey = () => `mr-${newKey()}`;
export const fetchMatchRecovery        = params => http.get('/admin/match-recovery', { params: clean({ page: 1, limit: 20, ...params }) });
export const fetchMatchRecoveryDetail  = matchId => http.get(`/admin/match-recovery/${matchId}`);
export const fetchMatchRecoveryHistory = matchId => http.get(`/admin/match-recovery/${matchId}/history`);
export const executeMatchRecovery      = (matchId, { action, reason, idempotencyKey }) =>
    http.post(`/admin/match-recovery/${matchId}/execute`, { action, reason, confirmation: true, idempotencyKey });

/* ── Admin: Bot Analytics (daily bot net profit, target, difficulty policy) ── */
// tz: 'IST' (default) or 'UTC' (view only).
// players: 2 or 4 = only that room size; empty = all bot matches combined
// page / limit page the day's bot matches table; totals always cover the whole day.
// Old: export const fetchBotAnalytics      = (date, tz, players) => http.get('/admin/bot-analytics/summary', { params: clean({ date, tz, players }) });
// Old: export const fetchBotAnalytics      = (date, page = 1, limit = 20) => http.get('/admin/bot-analytics/summary', { params: clean({ date, page, limit }) });
export const fetchBotAnalytics      = (date, tz, players, page = 1, limit = 20) => http.get('/admin/bot-analytics/summary', { params: clean({ date, tz, players, page, limit }) });
export const fetchBotTargetConfig   = () => http.get('/admin/bot-analytics/config');
export const saveBotTargetConfig    = body => http.put('/admin/bot-analytics/config', body);
export const fetchBotDifficultyPolicy = () => http.get('/admin/bot-analytics/policy');
export const saveBotDifficultyPolicy  = body => http.put('/admin/bot-analytics/policy', body);
export const fetchBotDecisions      = params => http.get('/admin/bot-analytics/decisions', { params: clean({ page: 1, limit: 10, ...params }) });
export const fetchBotAnalyticsAudit = params => http.get('/admin/bot-analytics/audit', { params: clean({ page: 1, limit: 10, ...params }) });
export const runBotAnalyticsBackfill = body => http.post('/admin/bot-analytics/backfill', body);

/* ── Matches (admin, read-only) ── */
export const fetchMatches       = params  => http.get('/admin/matches', { params: clean({ page: 1, limit: 20, ...params }) });
export const fetchMatchSummary  = params  => http.get('/admin/matches/summary', { params: clean({ ...params }) });
export const fetchMatchDetail   = matchId => http.get(`/admin/matches/${matchId}`);
// Refunds of the matches shown with the same filters (who, how much, when, why).
export const fetchMatchRefunds  = params  => http.get('/admin/matches/refunds', { params: clean({ page: 1, limit: 10, ...params }) });

/* ── Profit & Loss overview (admin, read-only) ── */
export const fetchOverview = params => http.get('/admin/overview', { params: clean({ ...params }) });

/* ── Reports (admin CSV downloads) ── */
export const downloadReport = (kind, params) => http.get(`/admin/reports/${kind}`, { params: clean({ ...params }), responseType: 'blob' });

/* ── Admin: Testing Mode (only allowed DABBA users can enter Ludo / start or join a match) ── */
export const fetchTestMode      = ()                       => http.get('/admin/test-mode');
export const setTestModeEnabled = enabled                  => http.put('/admin/test-mode', { enabled });
export const addTestModeUser    = (dabaUserId, note)       => http.post('/admin/test-mode/users', { dabaUserId, ...(note ? { note } : {}) });
export const removeTestModeUser = dabaUserId               => http.delete(`/admin/test-mode/users/${dabaUserId}`);
