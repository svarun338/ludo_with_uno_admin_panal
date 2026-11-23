import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchUserById, depositUser, withdrawUser, blockUser as apiBlockUser, unblockUser as apiUnblockUser } from '../../api';
import { toast } from '../../toast';
import { avatarBg, getInits, fmtDate, fmtMoney } from '../../utils/helpers';

/* ── Icons ── */
const BackIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const WalletIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'><rect x='2' y='5' width='20' height='14' rx='2'/><line x1='2' y1='10' x2='22' y2='10'/></svg>;
const UserIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>;
const TxIcon     = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'><polyline points='23 6 13.5 15.5 8.5 10.5 1 18'/><polyline points='17 6 23 6 23 12'/></svg>;
const BlockIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><circle cx='12' cy='12' r='10'/><line x1='4.93' y1='4.93' x2='19.07' y2='19.07'/></svg>;
const CheckIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='20 6 9 17 4 12'/></svg>;
const PlusIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>;
const MinusIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='5' y1='12' x2='19' y2='12'/></svg>;

const STATUS_STYLE = {
    ACTIVE:               'bg-emerald-50 text-emerald-700 border-emerald-200',
    BLOCKED:              'bg-red-50 text-red-700 border-red-200',
    SUSPENDED:            'bg-amber-50 text-amber-700 border-amber-200',
    PENDING_VERIFICATION: 'bg-slate-100 text-slate-600 border-slate-200',
};

/* ── Wallet Adjust Modal ── */
function AdjustModal({ userId, type, onClose, onDone }) {
    const [amount,  setAmount]  = useState('');
    const [reason,  setReason]  = useState('');
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
                        <input type='number' min='1' step='0.01' value={amount} onChange={e => setAmount(e.target.value)}
                            placeholder='e.g. 500'
                            className='w-full h-10 px-3.5 border-[1.5px] border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 bg-slate-50 transition-all' />
                    </div>
                    <div>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>Reason</label>
                        <input type='text' value={reason} onChange={e => setReason(e.target.value)}
                            placeholder='Brief reason...'
                            className='w-full h-10 px-3.5 border-[1.5px] border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 bg-slate-50 transition-all' />
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

/* ── Balance Card ── */
function BalCard({ label, value, color }) {
    return (
        <div className='bg-white rounded-2xl p-4 border border-slate-100 shadow-sm'>
            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1'>{label}</p>
            <p className={`text-2xl font-extrabold ${color}`}>{fmtMoney(value)}</p>
        </div>
    );
}

export default function UserDetail() {
    const { userId } = useParams();
    const navigate   = useNavigate();

    const [user,    setUser]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [modal,   setModal]   = useState(null); // 'credit' | 'debit' | null
    const [blocking,setBlocking]= useState(false);

    const load = useCallback(() => {
        setLoading(true); setError('');
        fetchUserById(userId)
            .then(r => setUser(r.data.data))
            .catch(e => setError(e.response?.data?.message || 'Failed to load user'))
            .finally(() => setLoading(false));
    }, [userId]);

    useEffect(() => { load(); }, [load]);

    const toggleBlock = async () => {
        if (!user) return;
        const isBlocked = user.status === 'BLOCKED';
        if (!window.confirm(isBlocked ? 'Unblock this user?' : 'Block this user?')) return;
        setBlocking(true);
        try {
            const endpoint = isBlocked ? apiUnblockUser : apiBlockUser;
            await endpoint(userId);
            setUser(u => ({ ...u, status: isBlocked ? 'ACTIVE' : 'BLOCKED' }));
            toast.success(isBlocked ? 'User unblocked' : 'User blocked');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Action failed');
        } finally { setBlocking(false); }
    };

    const onAdjustDone = () => { setModal(null); load(); };

    if (loading) return (
        <div className='space-y-5'>
            <div className='h-8 w-40 bg-slate-200 rounded-xl animate-pulse'/>
            <div className='bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4'>
                <div className='flex gap-4'>
                    <div className='w-16 h-16 rounded-2xl bg-slate-200 animate-pulse'/>
                    <div className='space-y-2 flex-1'><div className='h-5 w-48 bg-slate-200 rounded animate-pulse'/><div className='h-3 w-32 bg-slate-100 rounded animate-pulse'/></div>
                </div>
                {Array.from({length: 4}).map((_,i) => <div key={i} className='h-16 bg-slate-100 rounded-xl animate-pulse'/>)}
            </div>
        </div>
    );

    if (error) return (
        <div className='flex flex-col items-center justify-center py-20 gap-4'>
            <p className='font-semibold text-slate-700'>{error}</p>
            <button onClick={load} className='h-9 px-6 bg-indigo-500 text-white text-sm font-semibold rounded-xl'>Retry</button>
        </div>
    );

    if (!user) return null;

    const isBlocked = user.status === 'BLOCKED';
    const bal = user.balance || {};
    const roles = user.roles || [];

    return (
        <div className='space-y-5'>
            {/* Back */}
            <button onClick={() => navigate(-1)} className='flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors'>
                <BackIcon />Back
            </button>

            {/* Profile Header */}
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
                                {roles.map(r => (
                                    <span key={r} className='px-2 py-0.5 rounded-md text-[11px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-200'>
                                        {r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                ))}
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${STATUS_STYLE[user.status] || STATUS_STYLE.ACTIVE}`}>
                                    {user.status?.replace('_', ' ')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className='flex flex-wrap gap-2'>
                        <button onClick={() => setModal('credit')}
                            className='flex items-center gap-1.5 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors'>
                            <PlusIcon />Add Balance
                        </button>
                        <button onClick={() => setModal('debit')}
                            className='flex items-center gap-1.5 h-9 px-4 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-colors'>
                            <MinusIcon />Deduct
                        </button>
                        <button onClick={toggleBlock} disabled={blocking}
                            className={`flex items-center gap-1.5 h-9 px-4 text-xs font-bold rounded-xl border transition-colors disabled:opacity-60 ${isBlocked ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                            {isBlocked ? <><CheckIcon />Unblock</> : <><BlockIcon />Block</>}
                        </button>
                        <Link to={`/dashboard/users/${userId}/transactions`}
                            className='flex items-center gap-1.5 h-9 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors'>
                            <TxIcon />Transactions
                        </Link>
                    </div>
                </div>
            </div>

            {/* Contact Info */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100'>
                    <div className='flex items-center gap-2 mb-4'><UserIcon /><p className='font-bold text-slate-700 text-sm'>Contact Info</p></div>
                    <dl className='space-y-3'>
                        {[
                            ['Email',    user.email  || '—'],
                            ['Mobile',   user.mobile || '—'],
                            ['Joined',   fmtDate(user.createdAt)],
                            ['Referred By', user.referredBy || 'None'],
                        ].map(([k,v]) => (
                            <div key={k} className='flex justify-between gap-2'>
                                <dt className='text-xs text-slate-400 font-semibold'>{k}</dt>
                                <dd className='text-sm text-slate-700 font-medium text-right'>{v}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                {/* Promoter Profile */}
                {user.promoterProfile && (
                    <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100'>
                        <div className='flex items-center gap-2 mb-4'>
                            <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'><path d='M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z'/></svg>
                            <p className='font-bold text-slate-700 text-sm'>Promoter Profile</p>
                        </div>
                        <dl className='space-y-3'>
                            {[
                                ['Referral Code', <code className='font-bold text-emerald-700 tracking-widest bg-emerald-50 px-2 py-0.5 rounded text-xs'>{user.promoterProfile.referralCode}</code>],
                                ['Status',        user.promoterProfile.status],
                                ['Total Referrals', user.promoterProfile.totalReferrals],
                            ].map(([k, v]) => (
                                <div key={k} className='flex justify-between gap-2 items-center'>
                                    <dt className='text-xs text-slate-400 font-semibold'>{k}</dt>
                                    <dd className='text-sm text-slate-700 font-medium'>{v}</dd>
                                </div>
                            ))}
                        </dl>
                        {user.promoterProfile.recentReferrals?.length > 0 && (
                            <div className='mt-4 pt-4 border-t border-slate-100'>
                                <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3'>Recent Referrals</p>
                                <div className='space-y-2'>
                                    {user.promoterProfile.recentReferrals.map(r => (
                                        <div key={r.id} className='flex items-center justify-between'>
                                            <p className='text-xs font-semibold text-slate-700'>{r.displayName}</p>
                                            <p className='text-[10px] text-slate-400'>{fmtDate(r.joinedAt)}</p>
                                        </div>
                                    ))}
                                </div>
                                <Link to={`/dashboard/promoters/${userId}`} className='mt-3 inline-block text-xs text-emerald-600 hover:underline font-semibold'>
                                    View all referrals →
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Wallet Balance */}
            <div>
                <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center gap-2'><WalletIcon /><p className='font-bold text-slate-700 text-sm'>Wallet Balance</p></div>
                    <Link to={`/dashboard/users/${userId}/transactions`}
                        className='text-xs font-semibold text-indigo-500 hover:underline'>
                        View all transactions →
                    </Link>
                </div>
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                    <BalCard label='Total'   value={bal.total   ?? 0} color='text-slate-800' />
                    <BalCard label='Deposit' value={bal.deposit ?? 0} color='text-indigo-700' />
                    <BalCard label='Winning' value={bal.winning ?? 0} color='text-emerald-700' />
                    <BalCard label='Bonus'   value={bal.bonus   ?? 0} color='text-amber-700' />
                </div>
                {bal.status && (
                    <div className='mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3'>
                        <div className='bg-white rounded-xl p-4 border border-slate-100 shadow-sm col-span-2 sm:col-span-2'>
                            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2'>Lifetime Stats</p>
                            <div className='grid grid-cols-2 gap-3'>
                                {[['Deposited', bal.totalDeposited], ['Withdrawn', bal.totalWithdrawn]].map(([l, v]) => (
                                    <div key={l}>
                                        <p className='text-[10px] text-slate-400'>{l}</p>
                                        <p className='text-sm font-bold text-slate-700'>{fmtMoney(v ?? 0)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className='bg-white rounded-xl p-4 border border-slate-100 shadow-sm col-span-2 sm:col-span-2'>
                            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2'>Wallet Status</p>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${bal.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {bal.status}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {modal && (
                <AdjustModal userId={userId} type={modal} onClose={() => setModal(null)} onDone={onAdjustDone} />
            )}
        </div>
    );
}
