import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getMyWalletBalance, getMyWalletHistory } from '../../api';
import { fmtDate, fmtMoney } from '../../utils/helpers';

/* ── Icons ── */
const ChevL = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevR = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='9 18 15 12 9 6'/></svg>;

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
];

const PAGE_LIMIT = 20;

function PageBtn({ onClick, disabled, active, children }) {
    return (
        <button onClick={onClick} disabled={disabled}
            className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all ${active ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600 bg-white disabled:opacity-40'}`}>
            {children}
        </button>
    );
}

function BalCard({ label, value, color, desc }) {
    return (
        <div className='bg-white rounded-2xl p-5 border border-slate-100 shadow-sm'>
            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider'>{label}</p>
            <p className={`text-2xl font-extrabold mt-1 ${color}`}>{fmtMoney(value)}</p>
            {desc && <p className='text-xs text-slate-400 mt-1'>{desc}</p>}
        </div>
    );
}

export default function PromoterWallet() {
    const [balance,  setBalance]  = useState(null);
    const [balLoad,  setBalLoad]  = useState(true);
    const [txns,     setTxns]     = useState([]);
    const [total,    setTotal]    = useState(0);
    const [pages,    setPages]    = useState(1);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [page,     setPage]     = useState(1);
    const [type,     setType]     = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate,   setToDate]   = useState('');
    const dateTimer = useRef(null);

    const loadBalance = useCallback(() => {
        setBalLoad(true);
        getMyWalletBalance()
            .then(r => setBalance(r.data.data))
            .catch(() => {})
            .finally(() => setBalLoad(false));
    }, []);

    const loadHistory = useCallback(() => {
        setLoading(true); setError('');
        const params = { page, limit: PAGE_LIMIT };
        if (type)     params.type      = type;
        if (fromDate) params.startDate = fromDate;
        if (toDate)   params.endDate   = toDate;

        getMyWalletHistory(params)
            .then(r => {
                const d = r.data.data || {};
                setTxns(Array.isArray(d) ? d : (d.transactions || []));
                const p = r.data.pagination || {};
                setTotal(p.total || 0);
                setPages(p.totalPages || 1);
            })
            .catch(e => setError(e.response?.data?.message || 'Failed to load transactions'))
            .finally(() => setLoading(false));
    }, [page, type, fromDate, toDate]);

    useEffect(() => { loadBalance(); }, [loadBalance]);
    useEffect(() => { loadHistory(); }, [loadHistory]);

    const handleDate = (setter, val) => {
        setter(val);
        clearTimeout(dateTimer.current);
        dateTimer.current = setTimeout(() => setPage(1), 350);
    };

    const pageNums = useMemo(() =>
        Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
            .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push('…'); acc.push(p); return acc; }, []),
        [pages, page]);

    const start = (page - 1) * PAGE_LIMIT + 1;
    const end   = Math.min(page * PAGE_LIMIT, total);

    const dep = parseFloat(balance?.depositBalance || 0);
    const win = parseFloat(balance?.winningBalance || 0);
    const bon = parseFloat(balance?.bonusBalance   || 0);

    const selectCls = 'h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all';
    const inputCls  = 'w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all';

    return (
        <div className='space-y-5'>
            <div>
                <h1 className='text-xl font-extrabold text-slate-800'>My Wallet</h1>
                <p className='text-xs text-slate-400 mt-1'>Your balance and transaction history</p>
            </div>

            {/* Balance Cards */}
            {balLoad ? (
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                    {Array.from({length:4}).map((_,i) => <div key={i} className='bg-white rounded-2xl h-24 animate-pulse border border-slate-100'/>)}
                </div>
            ) : (
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                    <BalCard label='Total Balance'  value={dep+win+bon} color='text-slate-800'    desc='All balances combined' />
                    <BalCard label='Deposit'        value={dep}         color='text-indigo-700'   desc='From deposits' />
                    <BalCard label='Winning'        value={win}         color='text-emerald-700'  desc='From game winnings' />
                    <BalCard label='Bonus'          value={bon}         color='text-amber-700'    desc='Bonus credits' />
                </div>
            )}

            {/* Lifetime stats */}
            {!balLoad && balance && (
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                    {[['Total Deposited', balance.totalDeposited, 'text-indigo-600'],
                      ['Total Withdrawn', balance.totalWithdrawn, 'text-red-600'],
                      ['Total Won',       balance.totalWon,       'text-emerald-600']].map(([l,v,c]) => (
                        <div key={l} className='bg-white rounded-xl p-4 border border-slate-100'>
                            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider'>{l}</p>
                            <p className={`text-lg font-bold mt-1 ${c}`}>{fmtMoney(parseFloat(v||0))}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Transaction History */}
            <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
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
                    <div className='flex flex-col items-center py-10 gap-3'>
                        <p className='text-sm text-red-600'>{error}</p>
                        <button onClick={loadHistory} className='h-9 px-5 bg-emerald-500 text-white text-xs font-semibold rounded-xl'>Retry</button>
                    </div>
                )}

                {!error && (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm min-w-[640px]'>
                            <thead>
                                <tr className='bg-slate-50 border-b-[1.5px] border-slate-200'>
                                    {['#','Type','Balance Type','Amount','Before','After','Status','Date'].map(h => (
                                        <th key={h} className='px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({length: 8}).map((_,i) => (
                                        <tr key={i} className='border-b border-slate-50'>
                                            {Array.from({length: 8}).map((__,j) => <td key={j} className='px-4 py-3.5'><div className='h-3 bg-slate-100 rounded animate-pulse w-16'/></td>)}
                                        </tr>
                                    ))
                                ) : txns.length === 0 ? (
                                    <tr><td colSpan={8}>
                                        <div className='flex flex-col items-center py-14 gap-2'>
                                            <p className='text-sm font-semibold text-slate-500'>No transactions found</p>
                                        </div>
                                    </td></tr>
                                ) : (
                                    txns.map((t, i) => {
                                        const isCredit = ['DEPOSIT','GAME_WIN','REFERRAL_BONUS','BONUS_CREDIT','ADMIN_CREDIT'].includes(t.type);
                                        return (
                                            <tr key={t.id} className='border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors'>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 font-mono'>{start + i}</td>
                                                <td className='px-4 py-3.5'>
                                                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${TX_TYPE_STYLE[t.type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {t.type?.replace(/_/g,' ')}
                                                    </span>
                                                </td>
                                                <td className='px-4 py-3.5 text-xs text-slate-500'>{t.balanceType}</td>
                                                <td className={`px-4 py-3.5 text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {isCredit ? '+' : '-'}{fmtMoney(parseFloat(t.amount||0))}
                                                </td>
                                                <td className='px-4 py-3.5 text-xs text-slate-400'>{fmtMoney(parseFloat(t.beforeBalance||0))}</td>
                                                <td className='px-4 py-3.5 text-xs text-slate-600 font-semibold'>{fmtMoney(parseFloat(t.afterBalance||0))}</td>
                                                <td className='px-4 py-3.5'>
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${t.status==='COMPLETED'?'bg-emerald-50 text-emerald-700':t.status==='FAILED'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-600'}`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap'>{fmtDate(t.createdAt)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

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
