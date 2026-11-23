/*
 * Timezone filter for the report pages (Transactions, Profit & Loss, Matches, Reports, Bot Analytics).
 *
 * 'IST' (default) = India time, 'UTC' = UTC. The choice decides which day a date filter means
 * (sent to the API as `tz`) and how times are shown. One choice is shared by all the report pages while
 * the panel is open; a page reload goes back to IST.
 */
import { useSyncExternalStore } from 'react';

export const TIMEZONES = ['IST', 'UTC'];
const IANA = { IST: 'Asia/Kolkata', UTC: 'UTC' };
const OFFSET_MIN = { IST: 330, UTC: 0 };

let current = 'IST';
const listeners = new Set();

export const getTz = () => current;
export const setTz = tz => {
    const next = tz === 'UTC' ? 'UTC' : 'IST';
    if (next === current) return;
    current = next;
    listeners.forEach(l => l());
};
const subscribe = l => { listeners.add(l); return () => listeners.delete(l); };
export const useTimezone = () => useSyncExternalStore(subscribe, getTz, getTz);

// Calendar day (YYYY-MM-DD) in that timezone, `back` days ago.
export const todayIn = (tz, back = 0) =>
    new Date(Date.now() + OFFSET_MIN[tz === 'UTC' ? 'UTC' : 'IST'] * 60000 - back * 86400000).toISOString().slice(0, 10);

// '28 Oct 2026, 11:42 pm IST' - a timestamp shown in that timezone.
export const fmtDateTimeIn = (iso, tz) => {
    if (!iso) return '—';
    const z = tz === 'UTC' ? 'UTC' : 'IST';
    return `${new Date(iso).toLocaleString('en-IN', { timeZone: IANA[z], day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} ${z}`;
};

// What one day means, for the "Showing:" lines.
export const dayRangeText = tz => (tz === 'UTC' ? 'UTC, 00:00 – 23:59' : 'India time (IST), 12:00 am – 11:59 pm');
