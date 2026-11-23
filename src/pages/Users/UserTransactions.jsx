import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchUserTransactions } from '../../api';
import { fmtDate, fmtMoney } from '../../utils/helpers';

/* ── Icons ── */
const BackIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevL    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevR    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='9 18 15 12 9 6'/></svg>;

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

const TX_TYPES = [
    { value: '', label: 'All Types' },
    { value: 'DEPOSIT',        label: 'Deposit'        },
    { value: 'WITHDRAWAL',     label: 'Withdrawal'     },
    { value: 'GAME_ENTRY',     label: 'Game Entry'     },
    { value: 'GAME_WIN',       label: 'Game Win'       },
    { value: 'REFERRAL_BONUS', label: 'Referral Bonus' },
    { value: 'BONUS_CREDIT',   label: 'Bonus Credit'   },
    { value: 'ADMIN_CREDIT',   label: 'Admin Credit'   },
    { value: 'ADMIN_DEBIT',    label: 'Admin Debit'    },
    { value: 'ROLLBACK',       label: 'Rollback'       },
    { value: 'DABBA_CREDIT',   label: 'DABBA Sync Credit' },
    { value: 'DABBA_DEBIT',    label: 'DABBA Sync Debit'  },
];

const PAGE_LIMIT = 20;

function PageBtn({ onClick, disabled, active, children }) {
    return (
        <button onClick={onClick} disabled={disabled}
            className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all ${active ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-500 bg-white disabled:opacity-40'}`}>
            {children}
        </button>
    );
}

export default function UserTransactions() {
    const { userId }  = useParams();
    const navigate    = useNavigate();
    const location    = useLocation();
    const label       = location.pathname.includes('/promoters/') ? 'Promoter'
                      : location.pathname.includes('/boats/')     ? 'Bot'
                      : 'User';

    const [txns,    setTxns]    = useState([]);
    const [balance, setBalance] = useState(null);
    const [total,   setTotal]   = useState(0);
    const [pages,   setPages]   = useState(1);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [page,    setPage]    = useState(1);
    const [type,    setType]    = useState('');
    const [fromDate,setFromDate]= useState('');
    const [toDate,  setToDate]  = useState('');

    const timerRef = useRef(null);

    const doFetch = useCallback(() => {
        setLoading(true); setError('');
        const params = { page, limit: PAGE_LIMIT };
        if (type)     params.type      = type;
        if (fromDate) params.startDate = fromDate;
        if (toDate)   params.endDate   = toDate;

        fetchUserTransactions(userId, params)
            .then(r => {
                const d = r.data.data || {};
                setTxns(d.transactions || []);
                setBalance(d.balance || null);
                const p = r.data.pagination || {};
                setTotal(p.total || 0);
                setPages(p.totalPages || 1);
            })
            .catch(e => setError(e.response?.data?.message || 'Failed to load transactions'))
            .finally(() => setLoading(false));
    }, [userId, page, type, fromDate, toDate]);

    useEffect(() => { doFetch(); }, [doFetch]);

    /* debounce date changes */
    const handleDate = (setter, val) => {
        setter(val);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setPage(1), 300);
    };

    const pageNums = useMemo(() =>
        Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
            .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push('…'); acc.push(p); return acc; }, []),
        [pages, page]);

    const start = (page - 1) * PAGE_LIMIT + 1;
    const end   = Math.min(page * PAGE_LIMIT, total);

    const selectCls = 'h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';
    const inputCls  = 'w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';

    return (
        <div className='space-y-5'>
            {/* Back */}
            <button onClick={() => navigate(-1)} className='flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700'>
                <BackIcon />{label} Transactions
            </button>

            {/* Balance snapshot */}
            {balance && (
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                    {[['Total', (balance.depositBalance??0)+(balance.winningBalance??0)+(balance.bonusBalance??0), 'text-slate-800'],
                      ['Deposit', balance.depositBalance??0, 'text-indigo-700'],
                      ['Winning', balance.winningBalance??0, 'text-emerald-700'],
                      ['Bonus',   balance.bonusBalance??0,   'text-amber-700']].map(([l,v,c]) => (
                        <div key={l} className='bg-white rounded-2xl p-4 border border-slate-100 shadow-sm'>
                            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1'>{l}</p>
                            <p className={`text-xl font-extrabold ${c}`}>{fmtMoney(parseFloat(v))}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Table */}
            <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>

                {/* Filters */}
                <div className='p-4 sm:p-5 border-b border-slate-100 space-y-3'>
                    <p className='text-sm font-bold text-slate-700'>Transaction History</p>
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                        <div>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>Type</label>
                            <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className={selectCls}>
                                {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>From Date</label>
                            <input type='date' value={fromDate} max={toDate||undefined}
                                onChange={e => handleDate(setFromDate, e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>To Date</label>
                            <input type='date' value={toDate} min={fromDate||undefined}
                                onChange={e => handleDate(setToDate, e.target.value)} className={inputCls} />
                        </div>
                    </div>
                    {(type || fromDate || toDate) && (
                        <button onClick={() => { setType(''); setFromDate(''); setToDate(''); setPage(1); }}
                            className='text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-3 h-8 rounded-lg transition-colors'>
                            Clear Filters
                        </button>
                    )}
                </div>

                {error && (
                    <div className='flex flex-col items-center py-12 gap-3'>
                        <p className='text-sm font-semibold text-slate-700'>{error}</p>
                        <button onClick={doFetch} className='h-9 px-5 bg-indigo-500 text-white text-xs font-semibold rounded-xl'>Retry</button>
                    </div>
                )}

                {!error && (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm min-w-[700px]'>
                            <thead>
                                <tr className='bg-slate-50 border-b-[1.5px] border-slate-200'>
                                    {['#','Type','Balance Type','Amount','Before','After','Status','Date','Description'].map(h => (
                                        <th key={h} className='px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({length: 8}).map((_,i) => (
                                        <tr key={i} className='border-b border-slate-50'>
                                            {Array.from({length: 9}).map((__,j) => (
                                                <td key={j} className='px-4 py-3.5'>
                                                    <div className='h-3 bg-slate-100 rounded animate-pulse' style={{ width: j===1 ? 80 : j===8 ? 120 : 60 }} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : txns.length === 0 ? (
                                    <tr><td colSpan={9}>
                                        <div className='flex flex-col items-center py-16 gap-2'>
                                            <p className='font-semibold text-slate-500 text-sm'>No transactions found</p>
                                        </div>
                                    </td></tr>
                                ) : (
                                    txns.map((t, i) => {
                                        const isCredit = ['DEPOSIT','GAME_WIN','REFERRAL_BONUS','BONUS_CREDIT','ADMIN_CREDIT','DABBA_CREDIT'].includes(t.type);
                                        return (
                                            <tr key={t.id} className='border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors'>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 font-mono'>{start + i}</td>
                                                <td className='px-4 py-3.5'>
                                                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${TX_TYPE_STYLE[t.type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {t.type?.replace(/_/g,' ')}
                                                    </span>
                                                </td>
                                                <td className='px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap'>{t.balanceType}</td>
                                                <td className={`px-4 py-3.5 text-sm font-bold whitespace-nowrap ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {isCredit ? '+' : '-'}{fmtMoney(parseFloat(t.amount||0))}
                                                </td>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap'>{fmtMoney(parseFloat(t.beforeBalance||0))}</td>
                                                <td className='px-4 py-3.5 text-xs text-slate-600 font-semibold whitespace-nowrap'>{fmtMoney(parseFloat(t.afterBalance||0))}</td>
                                                <td className='px-4 py-3.5'>
                                                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${TX_STATUS_STYLE[t.status] || 'bg-slate-100 text-slate-500'}`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap'>{fmtDate(t.createdAt)}</td>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 max-w-[160px] truncate'>{t.description || '—'}</td>
                                            </tr>
                                        );
                                    })
                                )}
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
            </div>
        </div>
    );
}
