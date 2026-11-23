export const PAGE_LIMIT = 20;
// Today in India time as YYYY-MM-DD - money pages open on today.
export const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export const fmtDate  = iso  => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtMoney = n    => `₹${(n ?? 0).toLocaleString('en-IN')}`;
/* Supports both old {firstName,lastName} and new {displayName} user shapes */
export const getInits = u => {
    if (!u) return '?';
    if (u.displayName) {
        const p = u.displayName.trim().split(/\s+/);
        return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
    }
    return (`${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`).toUpperCase() || '?';
};
export const capWord  = s    => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
export const capWords = s    => s ? s.split(' ').map(capWord).join(' ') : '';
export const fullName = u => {
    if (!u) return '';
    if (u.displayName) return u.displayName;
    return `${capWords(u.firstName)} ${capWords(u.lastName)}`.trim();
};
export const alignCls = a    => a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
export const avatarBg = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
