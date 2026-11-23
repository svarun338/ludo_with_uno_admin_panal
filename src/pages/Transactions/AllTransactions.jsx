import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllTransactions, fetchTransactionTotals } from '../../api';
import { DetailDrawer, WhoTag } from '../Matches/Matches';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import TimezoneSelect from '../../components/TimezoneSelect';
import { useTimezone, getTz, todayIn, fmtDateTimeIn, dayRangeText } from '../../utils/timezone';
import PageBtn from '../../components/PageBtn';

/* ── Icons ── */
const ChevL = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevR = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='9 18 15 12 9 6'/></svg>;
const XIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' stroke='currentColor' className='w-4 h-4'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>;

const TX_TYPE_STYLE = {
    DEPOSIT:        'bg-emerald-50 text-emerald-700 border-emerald-200',
    WITHDRAWAL:     'bg-amber-50 text-amber-700 border-amber-200',
    GAME_ENTRY:     'bg-slate-100 text-slate-600 border-slate-200',
    GAME_WIN:       'bg-indigo-50 text-indigo-700 border-indigo-200',
    REFERRAL_BONUS: 'bg-purple-50 text-purple-700 border-purple-200',
    BONUS_CREDIT:   'bg-pink-50 text-pink-700 border-pink-200',
    ADMIN_CREDIT:   'bg-teal-50 text-teal-700 border-teal-200',
    ADMIN_DEBIT:    'bg-red-50 text-red-700 border-red-200',
    ROLLBACK:       'bg-gray-100 text-gray-600 border-gray-200',
    DABBA_CREDIT:   'bg-sky-50 text-sky-700 border-sky-200',
    DABBA_DEBIT:    'bg-orange-50 text-orange-700 border-orange-200',
};
const TX_STATUS_STYLE = {
    COMPLETED:   'bg-emerald-50 text-emerald-700',
    PENDING:     'bg-amber-50 text-amber-600',
    FAILED:      'bg-red-50 text-red-700',
    ROLLED_BACK: 'bg-gray-100 text-gray-500',
};
// ROLLBACK = entry fee / withdrawal refunded back to the player, so it is money in.
const CREDIT_TYPES = new Set(['DEPOSIT','GAME_WIN','ROLLBACK','REFERRAL_BONUS','BONUS_CREDIT','ADMIN_CREDIT','DABBA_CREDIT']);
const MATCH_STATUS_STYLE = { COMPLETED: 'text-emerald-600', PLAYING: 'text-indigo-600', READY: 'text-sky-600', WAITING: 'text-amber-600', CANCELLED: 'text-red-500' };

// [Game-only transactions, 2026-10-27] Type filter limited to game types; title changed to 'Game Transactions'.
// This page shows Ludo game money only (entry fees, winnings, refunds).
const TX_TYPES = [
    { value: '',           label: 'All Types'  },
    { value: 'GAME_ENTRY', label: 'Entry fee'  },
    { value: 'GAME_WIN',   label: 'Winnings'   },
    { value: 'ROLLBACK',   label: 'Refund'     },
];
const TX_STATUSES = [
    { value: '',           label: 'All Status'  },
    { value: 'COMPLETED',  label: 'Completed'   },
    { value: 'PENDING',    label: 'Pending'     },
    { value: 'FAILED',     label: 'Failed'      },
    { value: 'ROLLED_BACK',label: 'Rolled Back' },
];

const PAGE_LIMIT = 20;

/* ── Skeleton ── */
const Skeleton = memo(function Skeleton() {
    return <>{Array.from({length:12}).map((_,i) => (
        <tr key={i} className='border-b border-slate-50'>
            {[24,100,80,110,60,60,60,60,120].map((w,j) => (
                <td key={j} className='px-4 py-3.5'>
                    <div className='h-3 bg-slate-100 rounded animate-pulse' style={{width:w}} />
                </td>
            ))}
        </tr>
    ))}</>;
});

export default function AllTransactions() {
    const [txns,    setTxns]    = useState([]);
    const [total,   setTotal]   = useState(0);
    const [pages,   setPages]   = useState(1);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    const [page,     setPage]     = useState(1);
    const [type,     setType]     = useState('');
    const [status,   setStatus]   = useState('');
    // Old (all dates by default): const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState('');
    const [fromDate, setFromDate] = useState(() => todayIn(getTz())); // default: today
    const [toDate,   setToDate]   = useState(() => todayIn(getTz()));
    const [sortDir,  setSortDir]  = useState('desc');
    const [playerType, setPlayerType] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search,   setSearch]   = useState('');
    const [totals,   setTotals]   = useState(null);
    const [openMatch, setOpenMatch] = useState(null);
    const tz = useTimezone(); // IST (default) or UTC - which day the dates mean and how times show
    // Dates start at today. If they are still "today" when IST / UTC is switched, move them to that timezone's today.
    const prevTz = useRef(tz);
    useEffect(() => {
        const oldToday = todayIn(prevTz.current);
        prevTz.current = tz;
        if (fromDate === oldToday && toDate === oldToday) { setFromDate(todayIn(tz)); setToDate(todayIn(tz)); setPage(1); }
    }, [tz]); // eslint-disable-line react-hooks/exhaustive-deps
    const today = todayIn(tz);
    const [refreshKey, setRefreshKey] = useState(0); // Refresh button: bump to load again

    /* Wait until typing stops before searching */
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const doFetch = useCallback(() => {
        setLoading(true); setError('');
        const params = { page, limit: PAGE_LIMIT, sortDir };
        if (type)     params.type      = type;
        if (status)   params.status    = status;
        if (fromDate) params.startDate = fromDate;
        if (toDate)   params.endDate   = toDate;
        if (playerType) params.playerType = playerType;
        if (search)   params.search    = search;
        params.tz = tz;

        fetchAllTransactions(params)
            .then(r => {
                setTxns(r.data.data || []);
                const p = r.data.pagination || {};
                setTotal(p.total || 0);
                setPages(p.totalPages || 1);
            })
            .catch(e => setError(e.response?.data?.message || 'Failed to load transactions'))
            .finally(() => setLoading(false));
    }, [page, type, status, fromDate, toDate, sortDir, playerType, search, tz, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Totals for the whole filtered set (all pages) */
    useEffect(() => {
        setTotals(null);
        fetchTransactionTotals({ type, status, startDate: fromDate, endDate: toDate, playerType, search, tz })
            .then(r => setTotals(r.data.data)).catch(() => {});
    }, [type, status, fromDate, toDate, playerType, search, tz, refreshKey]);

    useEffect(() => { doFetch(); }, [doFetch]);

    const clearFilters = () => {
        // Old: setFromDate(''); setToDate('');
        setType(''); setStatus(''); setFromDate(today); setToDate(today);
        setPlayerType(''); setSearchInput(''); setSearch('');
        setSortDir('desc'); setPage(1);
    };

    // Old: const hasFilters = type || status || fromDate || toDate || playerType || search;
    const notToday = fromDate !== today || toDate !== today;
    const hasFilters = type || status || notToday || playerType || search;
    const setDates = (a, b) => { setFromDate(a); setToDate(b); setPage(1); };

    const pageNums = useMemo(() =>
        Array.from({length:pages},(_,i)=>i+1)
            .filter(p => p===1||p===pages||Math.abs(p-page)<=1)
            .reduce((acc,p,idx,arr) => { if(idx>0&&p-arr[idx-1]>1) acc.push('…'); acc.push(p); return acc; },[]),
        [pages, page]);

    const start = (page - 1) * PAGE_LIMIT + 1;
    const end   = Math.min(page * PAGE_LIMIT, total);

    const selCls = 'h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';
    const inpCls = 'w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';

    return (
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>

            {/* Header */}
            <div className='p-5 border-b border-slate-100 space-y-4'>
                <div className='flex items-center justify-between'>
                    <div>
                        <p className='text-sm font-bold text-slate-700'>Game Transactions</p>
                        <p className='text-xs text-slate-400 mt-0.5'>Ludo game money only: entry fees, winnings and refunds of users and bots. Click a match key to see who played it.</p>
                    </div>
                    <div className='flex items-center gap-2'>
                        <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading} className='h-9 px-3 rounded-xl border-[1.5px] border-slate-200 text-sm font-semibold text-slate-600 bg-slate-50 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50 transition-all'>Refresh</button>
                        <button onClick={() => setSortDir(d => d==='desc'?'asc':'desc')}
                            className='h-9 px-3 flex items-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:border-indigo-400 hover:text-indigo-500 transition-all'>
                            {sortDir==='desc' ? '↓ Newest' : '↑ Oldest'}
                        </button>
                        {!loading && (
                            <span className='h-9 flex items-center px-3 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full whitespace-nowrap'>
                                {total.toLocaleString()} txns
                            </span>
                        )}
                    </div>
                </div>

                {/* Search + who */}
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                    <div className='sm:col-span-2'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>Search</label>
                        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                            placeholder='Player name, email, phone or match key (e.g. ROOM_ZNH265)' className={inpCls} />
                    </div>
                    <div>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>Player</label>
                        <div className='flex h-9 p-0.5 bg-slate-100 rounded-xl'>
                            {[['', 'All'], ['user', 'Users'], ['bot', 'Bots']].map(([v, l]) => (
                                <button key={v} onClick={() => { setPlayerType(v); setPage(1); }}
                                    className={`flex-1 rounded-[10px] text-xs font-semibold transition-all ${playerType === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3'>
                    <div>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>Type</label>
                        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className={selCls}>
                            {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>Status</label>
                        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={selCls}>
                            {TX_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>From Date</label>
                        <input type='date' value={fromDate} max={toDate||undefined}
                            onChange={e => { setFromDate(e.target.value); setPage(1); }} className={inpCls} />
                    </div>
                    <div>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>To Date</label>
                        <input type='date' value={toDate} min={fromDate||undefined}
                            onChange={e => { setToDate(e.target.value); setPage(1); }} className={inpCls} />
                    </div>
                    <TimezoneSelect />
                </div>

                <div className='flex flex-wrap gap-2'>
                {notToday && <button onClick={() => setDates(today, today)} className='text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 h-8 rounded-lg'>Today</button>}
                {(fromDate || toDate) && <button onClick={() => setDates('', '')} className='text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 h-8 rounded-lg'>All dates</button>}
                {hasFilters && (
                    <button onClick={clearFilters}
                        className='inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-3 h-8 rounded-lg transition-colors'>
                        <XIcon />Clear Filters
                    </button>
                )}
                </div>
            </div>

            {/* Which dates and players the cards below are for. */}
            {(() => {
                const day = v => { const [y, mo, d] = v.split('-').map(Number); return new Date(y, mo - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
                const period = !fromDate && !toDate ? 'All dates'
                    : fromDate && toDate ? (fromDate === toDate ? day(fromDate) : `${day(fromDate)} – ${day(toDate)}`)
                    : fromDate ? `From ${day(fromDate)}` : `Up to ${day(toDate)}`;
                const who = playerType === 'user' ? 'users only' : playerType === 'bot' ? 'bots only' : 'users and bots';
                return (
                    <p className='px-5 py-2 text-sm text-slate-600 border-t border-slate-100'>
                        Showing: <b className='text-slate-800'>{period}</b> · {who}
                        <span className='text-slate-400'> · every transaction by its own time, like DABBA - this includes matches still playing and cancelled. Settled-match totals are on Profit &amp; Loss. · days in {dayRangeText(tz)}</span>
                    </p>
                );
            })()}

            {/* Totals for the current filters, in plain words. The three money cards carry DABBA's names so
                they can be compared with the DABBA wallet; the last card says who won or lost overall. */}
            {(() => {
                const amt = t => totals ? (totals.byType || []).filter(r => r.type === t).reduce((a, r) => a + r.amount, 0) : null;
                const who = playerType === 'user' ? 'Users' : playerType === 'bot' ? 'Bots' : 'Players';
                const result = !totals ? null
                    : totals.net > 0 ? `${who} won ${fmtMoney(totals.net)}`
                    : totals.net < 0 ? `${who} lost ${fmtMoney(-totals.net)}`
                    : `${who} came out even`;
                const cards = [
                    ['Transactions', totals ? totals.count.toLocaleString() : null, 'text-slate-800', status ? 'Rows in the table below' : 'Completed rows (money that really moved)'],
                    ['Join fees paid (all)', totals ? fmtMoney(amt('GAME_ENTRY')) : null, 'text-red-600', 'All entry-fee transactions · DABBA: Ludo Game Debit'],
                    ['Winnings received (all)', totals ? fmtMoney(amt('GAME_WIN')) : null, 'text-emerald-600', 'All winning transactions · DABBA: Ludo Game Credit'],
                    ['Refunded (all)', totals ? fmtMoney(amt('ROLLBACK')) : null, 'text-amber-600', 'Cancelled matches · DABBA: Ludo Game Cancel'],
                    ['Result', result, totals && totals.net < 0 ? 'text-red-600' : 'text-emerald-600', 'Winnings + refunds − join fees'],
                ];
                return (
                    <>
                        <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-px bg-slate-100 border-b border-slate-100'>
                            {cards.map(([label, value, tone, hint]) => (
                                <div key={label} className='bg-white px-5 py-3'>
                                    <p className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</p>
                                    {value === null
                                        ? <div className='h-5 w-20 mt-1 bg-slate-100 rounded animate-pulse' />
                                        : <p className={`text-lg font-bold mt-0.5 ${tone}`}>{value}</p>}
                                    <p className='text-[11px] text-slate-400 mt-0.5'>{hint}</p>
                                </div>
                            ))}
                        </div>
                        <p className={`px-5 py-2 text-xs border-b ${playerType === 'user' ? 'text-slate-500 bg-slate-50 border-slate-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
                            {playerType === 'user'
                                ? 'These are the same numbers as the DABBA wallet for these dates.'
                                : 'Bots exist only in Ludo (they play with platform money), so DABBA never has their transactions - choose "Users" to compare with DABBA. Platform profit is on the Profit & Loss page.'}
                        </p>
                    </>
                );
            })()}

            {/* Error */}
            {error && (
                <div className='flex flex-col items-center py-14 gap-3'>
                    <p className='text-sm font-semibold text-slate-700'>{error}</p>
                    <button onClick={doFetch} className='h-9 px-5 bg-indigo-500 text-white text-xs font-semibold rounded-xl hover:bg-indigo-600'>Retry</button>
                </div>
            )}

            {/* Table */}
            {!error && (
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm min-w-[1150px]'>
                        <thead>
                            <tr className='bg-slate-50 border-b-[1.5px] border-slate-200'>
                                {/* Before/After columns hidden for now - add 'Before','After' back after 'Amount' to show them */}
                                {['#','User','Type','Match','Bal. Type','Amount','Status','Date','Description'].map(h => (
                                    <th key={h} className='px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <Skeleton /> : txns.length === 0 ? (
                                <tr><td colSpan={9}>
                                    <div className='flex flex-col items-center py-16 gap-2'>
                                        <p className='font-semibold text-slate-500 text-sm'>No transactions found</p>
                                        {hasFilters && <button onClick={clearFilters} className='text-xs text-indigo-500 hover:underline'>Clear filters</button>}
                                    </div>
                                </td></tr>
                            ) : txns.map((t, i) => {
                                const isCredit = CREDIT_TYPES.has(t.type);
                                const user = t.user;
                                return (
                                    <tr key={t.id} className='border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors'>
                                        <td className='px-4 py-3.5 text-xs text-slate-400 font-mono'>{start + i}</td>
                                        <td className='px-4 py-3.5 min-w-[140px]'>
                                            {user ? (
                                                <Link to={`/dashboard/users/${user._id || user.id}`}
                                                    className='group'>
                                                    <div className='flex items-center gap-1.5'>
                                                        <WhoTag isBot={user.isBot} />
                                                        <p className='text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors truncate max-w-[110px]'>
                                                            {user.displayName || '—'}
                                                        </p>
                                                    </div>
                                                    <p className='text-[10px] text-slate-400 truncate max-w-[120px]'>{user.email || user.mobile || ''}</p>
                                                </Link>
                                            ) : <span className='text-slate-300 text-xs'>—</span>}
                                        </td>
                                        <td className='px-4 py-3.5'>
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${TX_TYPE_STYLE[t.type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                {(t.type || '').replace(/_/g,' ')}
                                            </span>
                                        </td>
                                        <td className='px-4 py-3.5 min-w-[150px]'>
                                            {t.match ? (
                                                <button onClick={() => setOpenMatch(t.match.roomId)} className='text-left group'>
                                                    <p className='font-mono text-xs font-bold text-indigo-600 group-hover:underline'>{t.match.roomId}</p>
                                                    <p className='text-[10px] text-slate-400'>
                                                        <span className={MATCH_STATUS_STYLE[t.match.roomStatus] || ''}>{t.match.roomStatus}</span>
                                                        {' · '}{t.match.type === 'PRIVATE' ? 'Private' : 'Quick'} · {fmtMoney(t.match.entryFee)}
                                                    </p>
                                                    {t.match.players.filter(p => p.id !== user?.id).length > 0 && (
                                                        <p className='text-[10px] text-slate-500 truncate max-w-[170px]'>
                                                            vs {t.match.players.filter(p => p.id !== user?.id).map(p => `${p.displayName}${p.isBot ? ' (bot)' : ''}`).join(', ')}
                                                        </p>
                                                    )}
                                                </button>
                                            ) : <span className='text-slate-300 text-xs'>—</span>}
                                        </td>
                                        <td className='px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap'>{t.balanceType}</td>
                                        <td className={`px-4 py-3.5 text-sm font-bold whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isCredit ? '+' : '-'}{fmtMoney(t.amount || 0)}
                                        </td>
                                        {/* Before/After columns hidden for now
                                        <td className='px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap'>{fmtMoney(t.beforeBalance || 0)}</td>
                                        <td className='px-4 py-3.5 text-xs text-slate-600 font-semibold whitespace-nowrap'>{fmtMoney(t.afterBalance || 0)}</td>
                                        */}
                                        <td className='px-4 py-3.5'>
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${TX_STATUS_STYLE[t.status] || 'bg-slate-100 text-slate-500'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        {/* Old (date only, browser timezone): {fmtDate(t.createdAt)} */}
                                        <td className='px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap'>{fmtDateTimeIn(t.createdAt, tz)}</td>
                                        <td className='px-4 py-3.5 text-xs text-slate-400 max-w-[160px] truncate' title={t.description || ''}>{t.description || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && pages > 1 && (
                <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100'>
                    <p className='text-xs text-slate-500'>
                        <span className='font-semibold text-slate-700'>{start}–{end}</span> of{' '}
                        <span className='font-semibold text-slate-700'>{total.toLocaleString()}</span>
                        {' '}· Page <span className='font-semibold text-slate-700'>{page}</span>/<span className='font-semibold text-slate-700'>{pages}</span>
                    </p>
                    <div className='flex items-center gap-1.5 flex-wrap'>
                        <PageBtn onClick={() => setPage(1)}        disabled={page===1||loading}>«</PageBtn>
                        <PageBtn onClick={() => setPage(p=>p-1)}  disabled={page===1||loading}><ChevL /></PageBtn>
                        {pageNums.map((p,i) => p==='…'
                            ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                            : <PageBtn key={p} onClick={()=>setPage(p)} disabled={loading} active={p===page}>{p}</PageBtn>
                        )}
                        <PageBtn onClick={() => setPage(p=>p+1)}  disabled={page===pages||loading}><ChevR /></PageBtn>
                        <PageBtn onClick={() => setPage(pages)}    disabled={page===pages||loading}>»</PageBtn>
                    </div>
                </div>
            )}
            {openMatch && <DetailDrawer matchId={openMatch} onClose={() => setOpenMatch(null)} />}
        </div>
    );
}
