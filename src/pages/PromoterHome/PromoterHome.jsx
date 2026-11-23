import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getMyStats, getMyReferrals, getMyWalletBalance } from '../../api';
import { toast } from '../../toast';
import { usePanelAuth } from '../../context/AuthContext';
import { avatarBg, getInits, fmtDate, fmtMoney } from '../../utils/helpers';

/* ── Icons ── */
const UserIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>;
const WalletIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'><rect x='2' y='5' width='20' height='14' rx='2'/><line x1='2' y1='10' x2='22' y2='10'/></svg>;
const CodeIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'><polyline points='16 18 22 12 16 6'/><polyline points='8 6 2 12 8 18'/></svg>;
const TxIcon     = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'><polyline points='23 6 13.5 15.5 8.5 10.5 1 18'/><polyline points='17 6 23 6 23 12'/></svg>;
const CopyIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><rect x='9' y='9' width='13' height='13' rx='2'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/></svg>;
const ArrowRight = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='9 18 15 12 9 6'/></svg>;

const STATUS_DOT = {
    ACTIVE:    'bg-emerald-500',
    BLOCKED:   'bg-red-500',
    SUSPENDED: 'bg-amber-500',
};

/* ── Stat Card ── */
function StatCard({ icon, label, value, sub, accent, to }) {
    const card = (
        <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent}`}>
                {icon}
            </div>
            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider'>{label}</p>
            <p className='text-3xl font-extrabold text-slate-800 mt-1'>{value}</p>
            {sub && <p className='text-xs text-slate-400 mt-1'>{sub}</p>}
        </div>
    );
    return to ? <Link to={to}>{card}</Link> : card;
}

export default function PromoterHome() {
    const { user } = usePanelAuth();

    const [profile,  setProfile]  = useState(null);
    const [balance,  setBalance]  = useState(null);
    const [referrals,setReferrals]= useState([]);
    const [refTotal, setRefTotal] = useState(0);
    const [loading,  setLoading]  = useState(true);
    const [balLoad,  setBalLoad]  = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([getMyStats(), getMyReferrals({ page: 1, limit: 5 })])
            .then(([statsRes, refRes]) => {
                setProfile(statsRes.data.data);
                const d = refRes.data.data || {};
                setReferrals(d.referrals || []);
                setRefTotal(refRes.data.pagination?.total ?? d.statistics?.total ?? 0);
            })
            .catch(() => {})
            .finally(() => setLoading(false));

        getMyWalletBalance()
            .then(r => setBalance(r.data.data))
            .catch(() => {})
            .finally(() => setBalLoad(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const copyCode = async (code) => {
        try { await navigator.clipboard.writeText(code); toast.success('Referral code copied!'); }
        catch { toast.error('Failed to copy'); }
    };

    const greetName = user?.displayName?.split(' ')[0] || 'Promoter';

    const totalBal = balance
        ? parseFloat(balance.depositBalance||0) + parseFloat(balance.winningBalance||0) + parseFloat(balance.bonusBalance||0)
        : 0;

    return (
        <div className='space-y-6'>
            {/* Greeting */}
            <div>
                <h1 className='text-2xl font-extrabold text-slate-800'>Welcome back, {greetName}!</h1>
                <p className='text-sm text-slate-400 mt-1'>Here's your promoter dashboard overview.</p>
            </div>

            {/* Referral Code Banner */}
            {!loading && profile?.referralCode && (
                <div className='bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white shadow-lg'>
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                        <div>
                            <p className='text-xs font-bold text-emerald-200 uppercase tracking-widest mb-1'>Your Referral Code</p>
                            <div className='flex items-center gap-3'>
                                <code className='text-3xl font-extrabold tracking-[0.2em]'>{profile.referralCode}</code>
                                <button onClick={() => copyCode(profile.referralCode)}
                                    className='flex items-center gap-1.5 h-8 px-3 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors'>
                                    <CopyIcon />Copy
                                </button>
                            </div>
                            <p className='text-xs text-emerald-200 mt-2'>Share this code with players to grow your network</p>
                        </div>
                        <div className='shrink-0 flex items-center gap-4 sm:gap-6'>
                            <div className='text-center'>
                                <p className='text-2xl font-extrabold'>{profile.totalReferrals || 0}</p>
                                <p className='text-xs text-emerald-200'>Total Referrals</p>
                            </div>
                            <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${profile.status === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-red-400/30 text-red-200'}`}>
                                {profile.status}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {loading && (
                <div className='bg-slate-200 rounded-2xl h-32 animate-pulse' />
            )}

            {/* Stat Cards */}
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
                <StatCard
                    icon={<UserIcon />}
                    label='Total Referrals'
                    value={loading ? '…' : (profile?.totalReferrals || 0).toLocaleString()}
                    sub='Users you referred'
                    accent='bg-indigo-50 text-indigo-600'
                    to='/dashboard/users'
                />
                <StatCard
                    icon={<WalletIcon />}
                    label='Wallet Balance'
                    value={balLoad ? '…' : fmtMoney(totalBal)}
                    sub='Total available'
                    accent='bg-emerald-50 text-emerald-600'
                    to='/dashboard/wallet'
                />
                <StatCard
                    icon={<TxIcon />}
                    label='Deposit Balance'
                    value={balLoad ? '…' : fmtMoney(parseFloat(balance?.depositBalance||0))}
                    sub='From deposits'
                    accent='bg-blue-50 text-blue-600'
                />
                <StatCard
                    icon={<CodeIcon />}
                    label='Winning Balance'
                    value={balLoad ? '…' : fmtMoney(parseFloat(balance?.winningBalance||0))}
                    sub='From winnings'
                    accent='bg-amber-50 text-amber-600'
                />
            </div>

            {/* Recent Referrals */}
            <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
                <div className='p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between'>
                    <p className='text-sm font-bold text-slate-700'>Recent Referrals</p>
                    <Link to='/dashboard/users' className='flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline'>
                        View all <ArrowRight />
                    </Link>
                </div>

                {loading ? (
                    <div className='divide-y divide-slate-50'>
                        {Array.from({length: 5}).map((_,i) => (
                            <div key={i} className='flex items-center gap-3 px-5 py-4'>
                                <div className='w-9 h-9 rounded-xl bg-slate-100 animate-pulse shrink-0'/>
                                <div className='flex-1 space-y-1.5'><div className='h-3 w-36 bg-slate-100 rounded animate-pulse'/><div className='h-2 w-24 bg-slate-100 rounded animate-pulse'/></div>
                            </div>
                        ))}
                    </div>
                ) : referrals.length === 0 ? (
                    <div className='flex flex-col items-center py-14 gap-3'>
                        <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300'><UserIcon /></div>
                        <p className='text-sm font-semibold text-slate-500'>No referrals yet</p>
                        <p className='text-xs text-slate-400 text-center max-w-xs'>Share your referral code to start building your network</p>
                    </div>
                ) : (
                    <div className='divide-y divide-slate-50'>
                        {referrals.map(ref => {
                            const u = ref.referredUser || ref;
                            return (
                                <div key={u.id || ref.id} className='flex items-center gap-3 px-5 py-4 hover:bg-slate-50/70 transition-colors'>
                                    <div className='w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0'
                                         style={{ background: avatarBg(u.displayName) }}>
                                        {getInits({ displayName: u.displayName })}
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-sm font-semibold text-slate-800 truncate'>{u.displayName}</p>
                                        <p className='text-xs text-slate-400 truncate'>{u.email || u.mobile || '—'}</p>
                                    </div>
                                    <div className='flex flex-col items-end gap-1 shrink-0'>
                                        <div className={`w-2 h-2 rounded-full ${STATUS_DOT[u.status] || 'bg-slate-300'}`} title={u.status}/>
                                        <p className='text-[10px] text-slate-400'>{fmtDate(ref.createdAt || u.createdAt)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {refTotal > 5 && (
                    <div className='px-5 py-3 border-t border-slate-100 bg-slate-50/50'>
                        <Link to='/dashboard/users' className='text-xs font-semibold text-emerald-600 hover:underline'>
                            +{refTotal - 5} more referrals — View all →
                        </Link>
                    </div>
                )}
            </div>

            {/* Quick Links */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <Link to='/dashboard/users'
                    className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all flex items-center gap-4'>
                    <div className='w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0'><UserIcon /></div>
                    <div>
                        <p className='font-bold text-slate-800'>My Referred Users</p>
                        <p className='text-xs text-slate-400 mt-0.5'>View and manage users you referred</p>
                    </div>
                    <ArrowRight />
                </Link>
                <Link to='/dashboard/wallet'
                    className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all flex items-center gap-4'>
                    <div className='w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0'><WalletIcon /></div>
                    <div>
                        <p className='font-bold text-slate-800'>My Wallet</p>
                        <p className='text-xs text-slate-400 mt-0.5'>View balance and transaction history</p>
                    </div>
                    <ArrowRight />
                </Link>
            </div>
        </div>
    );
}
