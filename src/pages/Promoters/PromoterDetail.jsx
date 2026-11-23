import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchUserById, fetchPromoterReferrals, depositUser, withdrawUser,
         blockUser as apiBlockUser, unblockUser as apiUnblockUser } from '../../api';
import { toast } from '../../toast';
import { avatarBg, getInits, fmtDate, fmtMoney } from '../../utils/helpers';

/* ── Icons ── */
const BackIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevL      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevR      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='9 18 15 12 9 6'/></svg>;
const PlusIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>;
const MinusIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='5' y1='12' x2='19' y2='12'/></svg>;
const BlockIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><circle cx='12' cy='12' r='10'/><line x1='4.93' y1='4.93' x2='19.07' y2='19.07'/></svg>;
const CheckIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='20 6 9 17 4 12'/></svg>;
const CopyIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><rect x='9' y='9' width='13' height='13' rx='2'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/></svg>;

const STATUS_STYLE = {
    ACTIVE:               'bg-emerald-50 text-emerald-700 border-emerald-200',
    BLOCKED:              'bg-red-50 text-red-700 border-red-200',
    SUSPENDED:            'bg-amber-50 text-amber-700 border-amber-200',
    PENDING_VERIFICATION: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PAGE_LIMIT = 20;

function PageBtn({ onClick, disabled, active, children }) {
    return (
        <button onClick={onClick} disabled={disabled}
            className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all ${active ? 'bg-emerald-600 text-white' : 'border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600 bg-white disabled:opacity-40'}`}>
            {children}
        </button>
    );
}

function AdjustModal({ userId, type, onClose, onDone }) {
    const [amount,  setAmount]  = useState('');
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');

    const submit = async () => {
        const n = parseFloat(amount);
        if (!n || n <= 0) { setError('Enter a valid positive amount'); return; }
        setLoading(true); setError('');
        try {
            const res = await (type === 'credit' ? depositUser : withdrawUser)(userId, n);
            toast.success(res.data?.message || (type === 'credit' ? 'Balance credited' : 'Balance debited'));
            onDone();
        } catch (e) {
            setError(e.response?.data?.message || 'Transaction failed');
        } finally { setLoading(false); }
    };

    return (
        <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
            <div className='bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden'>
                <div className={`px-6 py-5 ${type === 'credit' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    <h3 className='text-white font-bold text-base'>{type === 'credit' ? 'Add Balance' : 'Deduct Balance'}</h3>
                </div>
                <div className='px-6 py-5 space-y-4'>
                    <div>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>Amount (₹)</label>
                        <input type='number' min='1' step='0.01' value={amount} onChange={e => setAmount(e.target.value)} placeholder='e.g. 500'
                            className='w-full h-10 px-3.5 border-[1.5px] border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-slate-50' />
                    </div>
                    {error && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{error}</p>}
                </div>
                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50'>Cancel</button>
                    <button onClick={submit} disabled={loading}
                        className={`flex-1 h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center transition-colors disabled:opacity-60 ${type === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                        {loading ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PromoterDetail() {
    const { promoterId } = useParams();
    const navigate       = useNavigate();

    const [user,     setUser]     = useState(null);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [modal,    setModal]    = useState(null);
    const [blocking, setBlocking] = useState(false);

    /* Referrals list state */
    const [refTotal,   setRefTotal]   = useState(0);
    const [refPages,   setRefPages]   = useState(1);
    const [refPage,    setRefPage]    = useState(1);
    const [refLoading, setRefLoading] = useState(false);
    const [refError,   setRefError]   = useState('');
    const [allReferrals, setAllReferrals] = useState([]);

    const loadUser = useCallback(() => {
        setLoading(true); setError('');
        fetchUserById(promoterId)
            .then(r => setUser(r.data.data))
            .catch(e => setError(e.response?.data?.message || 'Failed to load promoter'))
            .finally(() => setLoading(false));
    }, [promoterId]);

    const loadReferrals = useCallback(() => {
        setRefLoading(true); setRefError('');
        fetchPromoterReferrals(promoterId, { page: refPage, limit: PAGE_LIMIT })
            .then(r => {
                const d = r.data.data || {};
                setAllReferrals(d.referrals || []);
                const p = r.data.pagination || {};
                setRefTotal(p.total || 0);
                setRefPages(p.totalPages || 1);
            })
            .catch(e => setRefError(e.response?.data?.message || 'Failed to load referrals'))
            .finally(() => setRefLoading(false));
    }, [promoterId, refPage]);

    useEffect(() => { loadUser(); }, [loadUser]);
    useEffect(() => { loadReferrals(); }, [loadReferrals]);

    const toggleBlock = async () => {
        if (!user) return;
        const isBlocked = user.status === 'BLOCKED';
        if (!window.confirm(isBlocked ? 'Unblock this promoter?' : 'Block this promoter?')) return;
        setBlocking(true);
        try {
            await (isBlocked ? apiUnblockUser : apiBlockUser)(promoterId);
            setUser(u => ({ ...u, status: isBlocked ? 'ACTIVE' : 'BLOCKED' }));
            toast.success(isBlocked ? 'Promoter unblocked' : 'Promoter blocked');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Action failed');
        } finally { setBlocking(false); }
    };

    const copyCode = async (code) => {
        try { await navigator.clipboard.writeText(code); toast.success('Referral code copied!'); }
        catch { toast.error('Failed to copy'); }
    };

    const bal = user?.balance || {};
    const profile = user?.promoterProfile;
    const isBlocked = user?.status === 'BLOCKED';

    /* Referrals pagination nums */
    const refPageNums = useMemo(() =>
        Array.from({ length: refPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === refPages || Math.abs(p - refPage) <= 1)
            .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push('…'); acc.push(p); return acc; }, []),
        [refPages, refPage]);

    if (loading) return (
        <div className='space-y-5'>
            <div className='h-8 w-40 bg-slate-200 rounded-xl animate-pulse'/>
            <div className='bg-white rounded-2xl p-6 shadow-sm border border-slate-100'>
                <div className='flex gap-4'><div className='w-16 h-16 rounded-2xl bg-slate-200 animate-pulse'/><div className='space-y-2 flex-1'><div className='h-5 w-48 bg-slate-200 rounded animate-pulse'/></div></div>
            </div>
        </div>
    );

    if (error) return (
        <div className='flex flex-col items-center py-20 gap-4'>
            <p className='text-sm font-semibold text-slate-700'>{error}</p>
            <button onClick={loadUser} className='h-9 px-6 bg-emerald-500 text-white text-sm font-semibold rounded-xl'>Retry</button>
        </div>
    );

    if (!user) return null;

    const refStart = (refPage - 1) * PAGE_LIMIT + 1;
    const refEnd   = Math.min(refPage * PAGE_LIMIT, refTotal);

    return (
        <div className='space-y-5'>
            <button onClick={() => navigate(-1)} className='flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700'>
                <BackIcon />Back
            </button>

            {/* Header */}
            <div className='bg-white rounded-2xl p-6 shadow-sm border border-slate-100'>
                <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
                    <div className='flex items-center gap-4'>
                        <div className='w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-extrabold shrink-0'
                             style={{ background: avatarBg(user.displayName) }}>
                            {getInits(user)}
                        </div>
                        <div>
                            <h1 className='text-xl font-extrabold text-slate-800'>{user.displayName}</h1>
                            <p className='text-xs text-slate-400 font-mono mt-0.5'>{user.id}</p>
                            <div className='flex flex-wrap gap-1.5 mt-2'>
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${STATUS_STYLE[user.status] || STATUS_STYLE.ACTIVE}`}>
                                    {user.status?.replace('_',' ')}
                                </span>
                                {profile && (
                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${profile.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        Promoter: {profile.status}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <button onClick={() => setModal('credit')}
                            className='flex items-center gap-1.5 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl'>
                            <PlusIcon />Add Balance
                        </button>
                        <button onClick={() => setModal('debit')}
                            className='flex items-center gap-1.5 h-9 px-4 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl'>
                            <MinusIcon />Deduct
                        </button>
                        <button onClick={toggleBlock} disabled={blocking}
                            className={`flex items-center gap-1.5 h-9 px-4 text-xs font-bold rounded-xl border disabled:opacity-60 ${isBlocked ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                            {isBlocked ? <><CheckIcon />Unblock</> : <><BlockIcon />Block</>}
                        </button>
                        <Link to={`/dashboard/promoters/${promoterId}/transactions`}
                            className='flex items-center h-9 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200'>
                            Transactions
                        </Link>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                {/* Contact */}
                <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100'>
                    <p className='font-bold text-slate-700 text-sm mb-4'>Contact Info</p>
                    <dl className='space-y-3'>
                        {[['Email', user.email||'—'],['Mobile',user.mobile||'—'],['Joined',fmtDate(user.createdAt)]].map(([k,v]) => (
                            <div key={k} className='flex justify-between gap-2'>
                                <dt className='text-xs text-slate-400 font-semibold'>{k}</dt>
                                <dd className='text-sm text-slate-700 font-medium text-right'>{v}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                {/* Promoter stats */}
                {profile && (
                    <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100'>
                        <p className='font-bold text-slate-700 text-sm mb-4'>Promoter Stats</p>
                        <dl className='space-y-3'>
                            <div className='flex justify-between items-center gap-2'>
                                <dt className='text-xs text-slate-400 font-semibold'>Referral Code</dt>
                                <dd className='flex items-center gap-2'>
                                    <code className='text-sm font-extrabold text-emerald-700 tracking-widest bg-emerald-50 px-2 py-0.5 rounded'>{profile.referralCode}</code>
                                    <button onClick={() => copyCode(profile.referralCode)} className='text-slate-400 hover:text-emerald-600'><CopyIcon /></button>
                                </dd>
                            </div>
                            <div className='flex justify-between gap-2'>
                                <dt className='text-xs text-slate-400 font-semibold'>Total Referrals</dt>
                                <dd className='text-2xl font-extrabold text-slate-800'>{profile.totalReferrals}</dd>
                            </div>
                            <div className='flex justify-between gap-2'>
                                <dt className='text-xs text-slate-400 font-semibold'>Profile Status</dt>
                                <dd className={`px-2 py-0.5 rounded text-xs font-bold border ${profile.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{profile.status}</dd>
                            </div>
                        </dl>
                    </div>
                )}
            </div>

            {/* Wallet Balance */}
            <div>
                <div className='flex items-center justify-between mb-3'>
                    <p className='font-bold text-slate-700 text-sm'>Wallet Balance</p>
                    <Link to={`/dashboard/promoters/${promoterId}/transactions`} className='text-xs font-semibold text-emerald-600 hover:underline'>View transactions →</Link>
                </div>
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                    {[['Total',   bal.total??0,   'text-slate-800'],
                      ['Deposit', bal.deposit??0,  'text-indigo-700'],
                      ['Winning', bal.winning??0,  'text-emerald-700'],
                      ['Bonus',   bal.bonus??0,    'text-amber-700']].map(([l,v,c]) => (
                        <div key={l} className='bg-white rounded-2xl p-4 border border-slate-100 shadow-sm'>
                            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1'>{l}</p>
                            <p className={`text-2xl font-extrabold ${c}`}>{fmtMoney(v)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Referrals Table */}
            <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
                <div className='p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between'>
                    <p className='text-sm font-bold text-slate-700'>Referred Users</p>
                    {refTotal > 0 && <span className='text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full'>{refTotal.toLocaleString()} total</span>}
                </div>

                {refError && <div className='p-5 text-sm text-red-600'>{refError}</div>}

                {!refError && (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm min-w-[500px]'>
                            <thead>
                                <tr className='bg-slate-50 border-b-[1.5px] border-slate-200'>
                                    {['#','Name','Email','Mobile','Status','Joined'].map(h => (
                                        <th key={h} className='px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {refLoading ? (
                                    Array.from({length:5}).map((_,i) => (
                                        <tr key={i} className='border-b border-slate-50'>
                                            {Array.from({length:6}).map((__,j) => <td key={j} className='px-4 py-3.5'><div className='h-3 bg-slate-100 rounded animate-pulse w-20'/></td>)}
                                        </tr>
                                    ))
                                ) : allReferrals.length === 0 ? (
                                    <tr><td colSpan={6}>
                                        <div className='flex flex-col items-center py-12 gap-2'>
                                            <p className='text-sm font-semibold text-slate-500'>No referrals yet</p>
                                        </div>
                                    </td></tr>
                                ) : (
                                    allReferrals.map((ref, i) => {
                                        const r = ref.referredUser || ref;
                                        return (
                                            <tr key={r.id || i} className='border-b border-slate-50 last:border-0 hover:bg-emerald-50/30 transition-colors'>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 font-mono'>{refStart + i}</td>
                                                <td className='px-4 py-3.5'>
                                                    <div className='flex items-center gap-2'>
                                                        <div className='w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0'
                                                             style={{ background: avatarBg(r.displayName) }}>
                                                            {getInits({ displayName: r.displayName })}
                                                        </div>
                                                        <Link to={`/dashboard/users/${r.id}`} className='font-semibold text-slate-800 hover:text-emerald-700 text-xs'>
                                                            {r.displayName}
                                                        </Link>
                                                    </div>
                                                </td>
                                                <td className='px-4 py-3.5 text-xs text-slate-500 lowercase'>{r.email || '—'}</td>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 font-mono'>{r.mobile || '—'}</td>
                                                <td className='px-4 py-3.5'>
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_STYLE[r.status] || STATUS_STYLE.ACTIVE}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className='px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap'>{fmtDate(r.createdAt || r.joinedAt)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!refLoading && !refError && refPages > 1 && (
                    <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100'>
                        <p className='text-xs text-slate-500'>
                            <span className='font-semibold text-slate-700'>{refStart}–{refEnd}</span> of{' '}
                            <span className='font-semibold text-slate-700'>{refTotal.toLocaleString()}</span>
                        </p>
                        <div className='flex items-center gap-1.5 flex-wrap'>
                            <PageBtn onClick={() => setRefPage(1)}         disabled={refPage===1||refLoading}>«</PageBtn>
                            <PageBtn onClick={() => setRefPage(p=>p-1)}   disabled={refPage===1||refLoading}><ChevL /></PageBtn>
                            {refPageNums.map((p,i) => p==='…'
                                ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                                : <PageBtn key={p} onClick={()=>setRefPage(p)} disabled={refLoading} active={p===refPage}>{p}</PageBtn>
                            )}
                            <PageBtn onClick={() => setRefPage(p=>p+1)}   disabled={refPage===refPages||refLoading}><ChevR /></PageBtn>
                            <PageBtn onClick={() => setRefPage(refPages)}  disabled={refPage===refPages||refLoading}>»</PageBtn>
                        </div>
                    </div>
                )}
            </div>

            {modal && <AdjustModal userId={promoterId} type={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); loadUser(); }} />}
        </div>
    );
}
