import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    fetchBoatById, updateBoat, depositBoat, withdrawBoat,
    blockUser as apiBlockUser, unblockUser as apiUnblockUser,
} from '../../api';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { toast } from '../../toast';

/* ── Icons ── */
const BackIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const EditIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>;
const WalletIcon= () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><rect x='2' y='5' width='20' height='14' rx='2'/><line x1='2' y1='10' x2='22' y2='10'/></svg>;
const XIcon     = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' stroke='currentColor' className='w-4 h-4'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>;
const MailIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'/><polyline points='22,6 12,13 2,6'/></svg>;
const PhoneIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z'/></svg>;
const CalIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><rect x='3' y='4' width='18' height='18' rx='2' ry='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>;
const TxIcon    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><line x1='12' y1='1' x2='12' y2='23'/><path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'/></svg>;

const AVATARS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
const avatarBg = n => AVATARS[(n?.charCodeAt(0)||0) % AVATARS.length];

/* ─── Balance Adjust Modal ─── */
const AdjustModal = memo(function AdjustModal({ open, type, balance, onClose, onConfirm }) {
    const [amount,  setAmount]  = useState('');
    const [loading, setLoading] = useState(false);
    const [err,     setErr]     = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) { setAmount(''); setErr(''); setTimeout(() => inputRef.current?.focus(), 50); }
    }, [open]);

    if (!open) return null;

    const isCredit  = type === 'credit';
    const amt       = Number(amount) || 0;
    // Support both admin serializer format (total) and WalletService format (totalBalance)
    const currentBal = balance?.total ?? balance?.totalBalance ?? 0;

    const confirm = async () => {
        if (!amt || amt <= 0) return setErr('Enter a valid amount greater than 0.');
        if (!isCredit && balance !== null && amt > currentBal)
            return setErr(`Insufficient balance — current: ${fmtMoney(currentBal)}`);
        setLoading(true); setErr('');
        try { await onConfirm(amt); onClose(); }
        catch (e) { setErr(e.response?.data?.message || 'Something went wrong.'); }
        finally { setLoading(false); }
    };

    return (
        <div className='fixed inset-0 bg-black/50 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4'>
            <div className='bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>
                <div className={`px-6 py-5 flex items-center gap-3 ${isCredit ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                    <div className='w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white'><WalletIcon /></div>
                    <div className='flex-1'>
                        <h3 className='text-white font-bold text-base'>{isCredit ? 'Add Balance' : 'Deduct Balance'}</h3>
                        <p className='text-white/80 text-xs mt-0.5'>Bot wallet adjustment</p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white'><XIcon /></button>
                </div>
                <div className='px-6 py-5 space-y-4'>
                    <div className='flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100'>
                        <span className='text-sm text-slate-500 font-medium'>Current Balance</span>
                        <span className='text-lg font-bold text-slate-800'>{balance !== null ? fmtMoney(currentBal) : '—'}</span>
                    </div>
                    <div className='space-y-1.5'>
                        <label className='text-xs font-semibold text-slate-500 uppercase tracking-wider'>Amount (₹)</label>
                        <div className='relative'>
                            <span className='absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm pointer-events-none'>₹</span>
                            <input ref={inputRef} type='number' min={1} value={amount} placeholder='0'
                                onChange={e => { setAmount(e.target.value); setErr(''); }}
                                onKeyDown={e => { if (e.key==='Enter') confirm(); if (e.key==='Escape') onClose(); }}
                                className='w-full h-12 pl-8 pr-4 border-[1.5px] border-slate-200 rounded-xl text-lg font-semibold text-slate-800 bg-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10' />
                        </div>
                        {amt > 0 && (
                            <p className='text-[11px] text-slate-400'>
                                After: <span className='font-semibold text-slate-600'>{fmtMoney(isCredit ? currentBal + amt : currentBal - amt)}</span>
                            </p>
                        )}
                    </div>
                    {err && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{err}</p>}
                </div>
                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50'>Cancel</button>
                    <button onClick={confirm} disabled={loading || !amount}
                        className={`flex-1 h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isCredit ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
                        {loading ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : (isCredit ? '+ Add' : '− Deduct')}
                        {!loading && amt ? ` ${fmtMoney(amt)}` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
});

/* ─── Edit Boat Modal ─── */
const EditModal = memo(function EditModal({ open, boat, onClose, onSaved }) {
    const [form, setForm] = useState({ displayName: '', email: '' });
    const [errs, setErrs] = useState({});
    const [apiErr, setApiErr] = useState('');
    const [loading, setLoading] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (open && boat) {
            setForm({ displayName: boat.displayName || '', email: boat.email || '' });
            setErrs({}); setApiErr('');
            setTimeout(() => ref.current?.focus(), 60);
        }
    }, [open, boat]);

    if (!open) return null;

    const submit = async () => {
        const e = {};
        if (form.displayName && form.displayName.trim().length < 2) e.displayName = 'Min 2 chars';
        if (form.email && !/^[^@]+@[^@]+\.[a-zA-Z]{2,}$/.test(form.email.trim())) e.email = 'Invalid email';
        setErrs(e);
        if (Object.keys(e).length) return;
        setLoading(true); setApiErr('');
        try {
            const res = await updateBoat(boat._id, {
                displayName: form.displayName.trim() || undefined,
                email: form.email.trim() || undefined,
            });
            toast.success('Bot updated');
            onSaved?.(res.data.data);
            onClose();
        } catch (err) {
            setApiErr(err.response?.data?.message || 'Update failed');
        } finally { setLoading(false); }
    };

    const inputCls = hasErr => `w-full h-10 px-3.5 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${hasErr ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/10'}`;

    return (
        <div className='fixed inset-0 bg-black/50 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4'>
            <div className='bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>
                <div className='px-6 py-5 flex items-center justify-between bg-indigo-600'>
                    <div>
                        <h3 className='text-white font-bold text-base'>Edit Bot</h3>
                        <p className='text-indigo-200 text-xs mt-0.5'>{boat?.displayName}</p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white'><XIcon /></button>
                </div>
                <div className='px-6 py-5 space-y-4'>
                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Bot Name</label>
                        <input ref={ref} type='text' value={form.displayName}
                            onChange={e => { setForm(p=>({...p,displayName:e.target.value})); setErrs(p=>({...p,displayName:''})); }}
                            placeholder='LudoBot-001'
                            className={inputCls(errs.displayName)} />
                        {errs.displayName && <p className='text-[10px] text-red-500'>{errs.displayName}</p>}
                    </div>
                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Email Address</label>
                        <input type='email' value={form.email}
                            onChange={e => { setForm(p=>({...p,email:e.target.value})); setErrs(p=>({...p,email:''})); }}
                            placeholder='bot@example.com'
                            className={inputCls(errs.email)} />
                        {errs.email && <p className='text-[10px] text-red-500'>{errs.email}</p>}
                    </div>
                    {apiErr && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiErr}</p>}
                </div>
                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50'>Cancel</button>
                    <button onClick={submit} disabled={loading}
                        className='flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60'>
                        {loading ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
});

/* ════════════════════════════════
   BOAT DETAIL PAGE
════════════════════════════════ */
const AVATARS_FULL = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
const bgFor = n => AVATARS_FULL[(n?.charCodeAt(0)||0) % AVATARS_FULL.length];

export default function BoatDetail() {
    const { boatId } = useParams();
    const navigate   = useNavigate();

    const [boat,    setBoat]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    const [adjustModal, setAdjustModal] = useState({ open: false, type: 'credit' });
    const [editModal,   setEditModal]   = useState(false);
    const [blockBusy,   setBlockBusy]   = useState(false);

    const doFetch = useCallback(() => {
        setLoading(true); setError('');
        fetchBoatById(boatId)
            .then(r => setBoat(r.data.data))
            .catch(e => setError(e.response?.data?.message || 'Failed to load boat'))
            .finally(() => setLoading(false));
    }, [boatId]);

    useEffect(() => { doFetch(); }, [doFetch]);

    const handleBlock = useCallback(async () => {
        if (!boat) return;
        const isBlocked = boat.status?.toLowerCase() !== 'active';
        setBlockBusy(true);
        try {
            if (isBlocked) {
                await apiUnblockUser(boatId);
                setBoat(b => ({...b, status: 'ACTIVE'}));
                toast.success('Bot unblocked');
            } else {
                await apiBlockUser(boatId);
                setBoat(b => ({...b, status: 'BLOCKED'}));
                toast.warning('Bot blocked');
            }
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setBlockBusy(false); }
    }, [boat, boatId]);

    const handleAdjust = useCallback(async (amt) => {
        if (adjustModal.type === 'credit') {
            await depositBoat(boatId, amt);
            toast.success(`₹${amt} added to boat balance`);
        } else {
            await withdrawBoat(boatId, amt);
            toast.success(`₹${amt} deducted from boat balance`);
        }
        doFetch();
    }, [adjustModal.type, boatId, doFetch]);

    const handleSaved = useCallback(saved => {
        if (saved) setBoat(b => ({...b, ...saved}));
    }, []);

    if (loading) return (
        <div className='space-y-5'>
            <div className='h-6 w-24 bg-slate-100 rounded animate-pulse' />
            <div className='bg-white rounded-2xl border border-slate-100 p-6 space-y-4'>
                {[80,200,140,100].map((w,i) => <div key={i} className={`h-4 bg-slate-100 rounded animate-pulse`} style={{width:w}} />)}
            </div>
        </div>
    );

    if (error) return (
        <div className='flex flex-col items-center py-20 gap-3'>
            <p className='font-semibold text-slate-700 text-sm'>{error}</p>
            <button onClick={doFetch} className='h-9 px-5 bg-indigo-500 text-white text-xs font-semibold rounded-xl hover:bg-indigo-600'>Retry</button>
        </div>
    );

    if (!boat) return null;

    const isBlocked   = boat.status?.toLowerCase() !== 'active';
    const displayName = boat.displayName || '—';
    const initials    = (() => { const p = displayName.trim().split(/\s+/); return ((p[0]?.[0]||'')+(p[1]?.[0]||'')).toUpperCase() || '?'; })();
    const balance     = boat.balance;

    // Handle both serialization formats:
    //   admin serializeBalance → { total, deposit, winning, bonus }
    //   WalletService._serializeBalance → { totalBalance, depositBalance, winningBalance, bonusBalance }
    const balCards = balance ? [
        { label: 'Total',   value: balance.total   ?? balance.totalBalance   ?? 0, color: 'text-slate-800'   },
        { label: 'Deposit', value: balance.deposit  ?? balance.depositBalance ?? 0, color: 'text-indigo-700'  },
        { label: 'Winning', value: balance.winning  ?? balance.winningBalance ?? 0, color: 'text-emerald-700' },
        { label: 'Bonus',   value: balance.bonus    ?? balance.bonusBalance   ?? 0, color: 'text-amber-700'   },
    ] : null;

    return (
        <div className='space-y-5'>
            {/* Back */}
            <button onClick={() => navigate('/dashboard/boats')} className='flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700'>
                <BackIcon />Back to Bots
            </button>

            {/* Profile card */}
            <div className='bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden'>
                <div className='p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 border-b border-slate-100'>
                    {/* Avatar */}
                    <div className='w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0'
                        style={{ background: bgFor(displayName) }}>
                        {initials}
                    </div>

                    <div className='flex-1 min-w-0'>
                        <div className='flex flex-wrap items-center gap-2 mb-1'>
                            <h1 className='text-xl font-bold text-slate-800'>{displayName}</h1>
                            <span className='px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider'>BOT</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${isBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {boat.status}
                            </span>
                        </div>
                        <p className='text-xs text-slate-400 font-mono mb-3'>{boat._id || boat.id}</p>

                        <div className='flex flex-wrap gap-4 text-xs text-slate-500'>
                            {boat.email  && <span className='flex items-center gap-1.5'><MailIcon />{boat.email}</span>}
                            {boat.mobile && <span className='flex items-center gap-1.5'><PhoneIcon />{boat.mobile}</span>}
                            <span className='flex items-center gap-1.5'><CalIcon />Created {fmtDate(boat.createdAt)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className='flex flex-wrap gap-2 shrink-0'>
                        <button onClick={() => setEditModal(true)}
                            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all'>
                            <EditIcon />Edit
                        </button>
                        <button onClick={() => setAdjustModal({ open: true, type: 'credit' })}
                            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all'>
                            + Add Balance
                        </button>
                        <button onClick={() => setAdjustModal({ open: true, type: 'debit' })}
                            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-all'>
                            − Deduct
                        </button>
                        <button onClick={handleBlock} disabled={blockBusy}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-60 ${isBlocked ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
                            {blockBusy ? <span className='w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin'/> : null}
                            {isBlocked ? 'Unblock' : 'Block'}
                        </button>
                        <Link to={`/dashboard/boats/${boatId}/transactions`}
                            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-all'>
                            <TxIcon />Transactions
                        </Link>
                    </div>
                </div>

                {/* Contact info row */}
                <div className='px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/60 border-b border-slate-100'>
                    <div>
                        <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5'>Email</p>
                        <p className='text-sm text-slate-700'>{boat.email || <span className='text-slate-300'>Not set</span>}</p>
                    </div>
                    <div>
                        <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5'>Phone</p>
                        <p className='text-sm text-slate-700 font-mono'>{boat.mobile || <span className='text-slate-300'>Not set</span>}</p>
                    </div>
                    <div>
                        <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5'>Last Updated</p>
                        <p className='text-sm text-slate-700'>{fmtDate(boat.updatedAt)}</p>
                    </div>
                </div>
            </div>

            {/* Balance cards */}
            {balCards ? (
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                    {balCards.map(({ label, value, color }) => (
                        <div key={label} className='bg-white rounded-2xl p-4 border border-slate-100 shadow-sm'>
                            <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1'>{label}</p>
                            <p className={`text-2xl font-extrabold ${color}`}>{fmtMoney(value)}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className='bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700'>
                    No wallet found for this bot. A wallet is automatically created for bots created from this panel.
                </div>
            )}


            {/* Modals */}
            <AdjustModal
                open={adjustModal.open}
                type={adjustModal.type}
                balance={balance}
                onClose={() => setAdjustModal(m => ({...m, open: false}))}
                onConfirm={handleAdjust}
            />
            <EditModal
                open={editModal}
                boat={boat}
                onClose={() => setEditModal(false)}
                onSaved={handleSaved}
            />
        </div>
    );
}
