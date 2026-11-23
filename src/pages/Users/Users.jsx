import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { fetchUsers, depositUser, withdrawUser, deleteUser, generateMyCode, getMyStats, getMyReferrals } from '../../api';
import { cacheGet, cacheSet, cacheHas, cacheClear }  from '../../cache';
import { toast }                                       from '../../toast';
import { usePanelAuth } from '../../context/AuthContext';
import CreateUserModal from '../../components/CreateUserModal';
import EditUserModal   from '../../components/EditUserModal';

import { TABLE_COLUMNS }   from '../../constants/tableColumns';
import {
    STATUS_OPTIONS, VERIFIED_OPTIONS, ACTIVE_OPTIONS, HAS_REFERRAL_OPTIONS, SORT_OPTIONS, ROLE_OPTIONS,
    DEFAULT_FIELDS, DEFAULT_PARAMS, PAGE_LIMIT,
} from '../../constants/filterOptions';
import { fmtMoney, fullName } from '../../utils/helpers';

import FilterInput         from '../../components/FilterInput';
import TableHeader         from '../../components/TableHeader';
import TableSkeleton       from '../../components/TableSkeleton';
import MobileCardSkeleton  from '../../components/MobileCardSkeleton';
import UserRow             from '../../components/UserRow';
import UserCard            from '../../components/UserCard';
import ActionModal         from '../../components/ActionModal';
import PageBtn             from '../../components/PageBtn';

import { ChevLIcon, ChevRIcon, PeopleIcon, SortAscIcon, SortDescIcon } from '../../utils/icons';

/* ────────────────────────────────────────────────────
   Users page — orchestration only.
   All column definitions live in constants/tableColumns.jsx.
   All components are imported from components/.
──────────────────────────────────────────────────── */
export default function Users() {
    const { role } = usePanelAuth();
    const isPromoter = role === 'p';

    /* ── Promoter: referral code + stats ── */
    const [myCode,      setMyCode]      = useState('');
    const [myStats,     setMyStats]     = useState({ referredUsers: 0 });
    const [genLoading,  setGenLoading]  = useState(false);

    useEffect(() => {
        if (!isPromoter) return;
        getMyStats().then(r => {
            setMyStats(r.data.data);
            if (r.data.data.referralCode) setMyCode(r.data.data.referralCode);
        }).catch(() => {});
    }, [isPromoter]);

    const generateCode = useCallback(async () => {
        setGenLoading(true);
        try {
            const r = await generateMyCode();
            setMyCode(r.data.data.referralCode);
            toast.success('Referral code generated!');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to generate code');
        } finally { setGenLoading(false); }
    }, []);

    const copyCode = useCallback(async code => {
        try { await navigator.clipboard.writeText(code); toast.success('Referral code copied!'); }
        catch { toast.error('Failed to copy'); }
    }, []);

    const [params,     setParams]     = useState(DEFAULT_PARAMS);
    const [fieldUI,    setFieldUI]    = useState(DEFAULT_FIELDS);
    const fieldRef = useRef(DEFAULT_FIELDS);
    const timerRef = useRef(null);

    /* ── Separate debounce for referral text inputs ── */
    const referralTextRef   = useRef({ referralCode: '', referredBy: '' });
    const referralTimerRef  = useRef(null);
    const [referralUI, setReferralUI] = useState({ referralCode: '', referredBy: '' });

    const [users,       setUsers]       = useState([]);
    const [total,       setTotal]       = useState(0);
    const [pages,       setPages]       = useState(1);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');
    const [modal,       setModal]       = useState({ open: false, type: '', user: null });
    const [createOpen,  setCreateOpen]  = useState(false);
    const [editUser,    setEditUser]    = useState(null);   // null = closed

    /* ── Text-field debounce via ref (no stale closure) ── */
    const setField = useCallback((f, v) => {
        fieldRef.current = { ...fieldRef.current, [f]: v };
        setFieldUI({ ...fieldRef.current });
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(
            () => setParams(p => ({ ...p, page: 1, ...fieldRef.current })),
            380
        );
    }, []);

    const onFirstName = useCallback(v => setField('firstName', v), [setField]);
    const onLastName  = useCallback(v => setField('lastName',  v), [setField]);
    const onEmail     = useCallback(v => setField('email',     v), [setField]);
    const onPhone     = useCallback(v => setField('phone',     v), [setField]);

    /* ── Debounced setter for referral text inputs ── */
    const setReferralField = useCallback((f, v) => {
        referralTextRef.current = { ...referralTextRef.current, [f]: v };
        setReferralUI({ ...referralTextRef.current });
        clearTimeout(referralTimerRef.current);
        referralTimerRef.current = setTimeout(
            () => setParams(p => ({ ...p, page: 1, ...referralTextRef.current })),
            380
        );
    }, []);

    const onReferralCode = useCallback(v => setReferralField('referralCode', v.toUpperCase()), [setReferralField]);
    const onReferredBy   = useCallback(v => setReferralField('referredBy',   v),              [setReferralField]);

    /* ── Dropdown / sort handlers (instant — no debounce needed) ── */
    const setStatus       = useCallback(v => setParams(p => ({ ...p, page: 1, status:       v })), []);
    const setVerified     = useCallback(v => setParams(p => ({ ...p, page: 1, verified:     v })), []);
    const setActive       = useCallback(v => setParams(p => ({ ...p, page: 1, active:       v })), []);
    const setRole         = useCallback(v => setParams(p => ({ ...p, page: 1, role:         v })), []);
    const setFromDate     = useCallback(v => setParams(p => ({ ...p, page: 1, fromDate:     v })), []);
    const setToDate       = useCallback(v => setParams(p => ({ ...p, page: 1, toDate:       v })), []);
    const setHasReferral  = useCallback(v => setParams(p => ({ ...p, page: 1, hasReferral:  v })), []);
    const setReferralFrom = useCallback(v => setParams(p => ({ ...p, page: 1, referralFrom: v })), []);
    const setReferralTo   = useCallback(v => setParams(p => ({ ...p, page: 1, referralTo:   v })), []);
    const goToPage      = useCallback(pg => setParams(p => ({ ...p, page: pg })), []);
    const toggleSort    = useCallback(f  => setParams(p => ({
        ...p, page: 1, sortBy: f,
        sortDir: p.sortBy === f && p.sortDir === 'desc' ? 'asc' : 'desc',
    })), []);
    const toggleSortDir = useCallback(() =>
        setParams(p => ({ ...p, page: 1, sortDir: p.sortDir === 'desc' ? 'asc' : 'desc' })), []);

    const clearAll = useCallback(() => {
        clearTimeout(timerRef.current);
        clearTimeout(referralTimerRef.current);
        fieldRef.current = DEFAULT_FIELDS;
        setFieldUI(DEFAULT_FIELDS);
        referralTextRef.current = { referralCode: '', referredBy: '' };
        setReferralUI({ referralCode: '', referredBy: '' });
        setParams({ ...DEFAULT_PARAMS });
    }, []);

    /* ── Fetch with in-memory cache ── */
    const doFetch = useCallback((p, force = false) => {
        const key = JSON.stringify(p);
        if (!force && cacheHas(key)) {
            const c = cacheGet(key);
            setUsers(c.users ?? []); setTotal(c.total ?? 0); setPages(c.pages ?? 1);
            setLoading(false);
            return;
        }
        setError('');
        let cancelled = false;
        /* Promoters use dedicated referrals endpoint; admins use /admin/users */
        const apiFn = isPromoter ? getMyReferrals : fetchUsers;
        apiFn(p)
            .then(r => {
                if (cancelled) return;
                const d          = r.data.data;
                const pagination = r.data.pagination;
                /* Promoter referrals: data.referrals[].referredUser; Admin users: data is flat array */
                const rawList = Array.isArray(d) ? d : (d.referrals ?? d.users ?? []);
                const users = isPromoter
                    ? rawList.map(r => r.referredUser ? { ...r.referredUser, _id: r.referredUser.id } : r)
                    : rawList;
                const total  = pagination?.total     ?? d.statistics?.total ?? d.total  ?? 0;
                const pages  = pagination?.totalPages ?? d.pages ?? 1;
                setUsers(users); setTotal(total); setPages(pages);
                cacheSet(key, { users, total, pages });
            })
            .catch(e => { if (!cancelled) setError(e.response?.data?.message || 'Network error.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [isPromoter]);

    useEffect(() => { setLoading(true); return doFetch(params); }, [params, doFetch]);

    const refresh = useCallback(() => { cacheClear(); setLoading(true); doFetch(params, true); }, [params, doFetch]);

    /* ── Status / balance update handlers ── */
    const handleStatusUpdated = useCallback((id, s) => {
        setUsers(prev => prev.map(u => u._id === id ? { ...u, status: s } : u));
        cacheClear();
    }, []);

    const handleBalanceUpdated = useCallback((id, newBal) => {
        /* newBal may be a flat number (old API) or object with .total (new API) */
        const bal = typeof newBal === 'object' ? newBal : { total: newBal, deposit: newBal, winning: 0, bonus: 0 };
        setUsers(prev => prev.map(u => u._id === id ? { ...u, balance: bal } : u));
        cacheClear();
    }, []);

    /* ── Wallet Modal ── */
    const openModal  = useCallback((type, user) => setModal({ open: true, type, user }), []);
    const closeModal = useCallback(() => setModal({ open: false, type: '', user: null }), []);

    /* ── Create User ── */
    const handleUserCreated = useCallback(() => {
        cacheClear();
        setLoading(true);
        doFetch({ ...DEFAULT_PARAMS }, true);
    }, [doFetch]);

    /* ── Edit User ── */
    const handleEditProfile = useCallback(user => setEditUser(user), []);
    const handleEditClosed  = useCallback(() => setEditUser(null), []);
    const handleEditSaved   = useCallback(updated => {
        setUsers(prev => prev.map(u => u._id === updated._id ? { ...u, ...updated } : u));
        cacheClear();
        setEditUser(null);
    }, []);

    /* ── Delete User ── */
    const handleDeleteUser = useCallback(async user => {
        const uname = user.displayName || `${user.firstName||''} ${user.lastName||''}`.trim() || 'User';
        if (!window.confirm(`Delete ${uname}? This cannot be undone.`)) return;
        try {
            await deleteUser(user._id);
            setUsers(prev => prev.filter(u => u._id !== user._id));
            setTotal(t => t - 1);
            cacheClear();
            toast.success(`${uname} deleted`);
        } catch (e) {
            const msg = e.response?.data?.message || 'Delete is not supported by the current backend.';
            toast.error(msg);
        }
    }, []);

    const handleConfirm = useCallback(async amount => {
        const { type, user } = modal;
        const res = await (type === 'deposit' ? depositUser : withdrawUser)(user._id, amount);
        /* New backend returns afterBalance (money-manage), old returned balance */
        const d      = res.data?.data ?? {};
        const newBal = Number(d.afterBalance ?? d.balance ?? 0);
        const msg    = res.data?.message || '';
        handleBalanceUpdated(user._id, newBal);
        const name = fullName(user);
        type === 'deposit'
            ? toast.success(msg || `₹${amount.toLocaleString('en-IN')} deposited to ${name}. Balance: ${fmtMoney(newBal)}`)
            : toast.warning(msg || `₹${amount.toLocaleString('en-IN')} withdrawn from ${name}. Balance: ${fmtMoney(newBal)}`);
    }, [modal, handleBalanceUpdated]);

    /* ── Derived ── */
    const { page: curPage, sortBy, sortDir } = params;
    const start    = useMemo(() => (curPage - 1) * PAGE_LIMIT + 1,               [curPage]);
    const end      = useMemo(() => Math.min(curPage * PAGE_LIMIT, total),         [curPage, total]);
    const pageNums = useMemo(() =>
        Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || Math.abs(p - curPage) <= 1)
            .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                acc.push(p); return acc;
            }, []),
        [pages, curPage]);

    const hasFilters = Object.values(fieldUI).some(Boolean)
        || params.status || params.verified || params.active || params.role
        || params.fromDate || params.toDate
        || params.hasReferral
        || referralUI.referralCode || referralUI.referredBy
        || params.referralFrom || params.referralTo;
    const tableMinW  = TABLE_COLUMNS.reduce((s, c) => s + c.width, 0);
    const selectCls  = 'w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10';

    const EmptyState = (
        <div className='flex flex-col items-center justify-center py-16 gap-3'>
            <div className='text-slate-200'><PeopleIcon /></div>
            <p className='font-semibold text-slate-500 text-sm'>No users found</p>
            {hasFilters && <button onClick={clearAll} className='text-xs text-indigo-500 hover:underline'>Clear filters</button>}
        </div>
    );

    return (
        <>

        {/* ── Promoter: Referral Code + Stats banner ── */}
        {isPromoter && (
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5'>
                {/* Referral Code card */}
                <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100'>
                    <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3'>My Referral Code</p>
                    {myCode ? (
                        <div className='flex items-center gap-3'>
                            <code className='text-2xl font-extrabold text-emerald-700 tracking-[0.15em]'>{myCode}</code>
                            <button
                                onClick={() => copyCode(myCode)}
                                title='Copy code'
                                className='flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors'
                            >
                                <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'>
                                    <rect x='9' y='9' width='13' height='13' rx='2'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/>
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className='space-y-2'>
                            <p className='text-xs text-slate-400'>No referral code yet</p>
                            <button
                                onClick={generateCode}
                                disabled={genLoading}
                                className='h-9 px-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60'
                            >
                                {genLoading
                                    ? <span className='w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                                    : <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>
                                }
                                Generate Code
                            </button>
                        </div>
                    )}
                </div>

                {/* Referred Users */}
                <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100'>
                    <p className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2'>Referred Users</p>
                    <p className='text-3xl font-extrabold text-slate-900'>{(myStats.referredUsers || 0).toLocaleString()}</p>
                    <p className='text-xs text-slate-400 mt-1'>Users who signed up with your code</p>
                </div>

                {/* Share hint */}
                <div className='bg-emerald-50 rounded-2xl p-5 border border-emerald-100'>
                    <p className='text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2'>How to refer</p>
                    <p className='text-xs text-slate-600 leading-relaxed'>
                        Share your code with players. When they sign up using your code, they appear in <strong>My Users</strong>.
                    </p>
                    {myCode && (
                        <button
                            onClick={() => copyCode(myCode)}
                            className='mt-3 h-8 px-3 text-[11px] font-bold text-emerald-700 border border-emerald-300 rounded-lg bg-white hover:bg-emerald-50 transition-colors'
                        >
                            Copy {myCode}
                        </button>
                    )}
                </div>
            </div>
        )}

        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>

            {/* ── Toolbar ── */}
            <div className='p-4 sm:p-5 border-b border-slate-100 space-y-4'>

                {/* Card header: title + Create User button (admin only) */}
                <div className='flex items-center justify-between'>
                    <p className='text-sm font-bold text-slate-700'>
                        {isPromoter ? 'My Referred Users' : 'User Management'}
                    </p>
                    <button
                        onClick={() => setCreateOpen(true)}
                        className={`h-9 px-4 flex items-center gap-1.5 text-white text-xs font-bold rounded-xl transition-colors shadow-sm ${isPromoter ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'>
                            <line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/>
                        </svg>
                        Create User
                    </button>
                </div>

                {/* Search inputs — one per field */}
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
                    <FilterInput label='First Name' placeholder='e.g. Rahul'      value={fieldUI.firstName} onChange={onFirstName} />
                    <FilterInput label='Last Name'  placeholder='e.g. Sharma'     value={fieldUI.lastName}  onChange={onLastName}  />
                    <FilterInput label='Email'      placeholder='e.g. rahul@...'  value={fieldUI.email}     onChange={onEmail}     />
                    <FilterInput label='Phone'      placeholder='e.g. 9876543210' value={fieldUI.phone}     onChange={onPhone}     />
                </div>

                {/* Date range filter */}
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>From Date</label>
                        <input
                            type='date'
                            value={params.fromDate}
                            max={params.toDate || undefined}
                            onChange={e => setFromDate(e.target.value)}
                            className='w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                        />
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>To Date</label>
                        <input
                            type='date'
                            value={params.toDate}
                            min={params.fromDate || undefined}
                            onChange={e => setToDate(e.target.value)}
                            className='w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                        />
                    </div>
                </div>

                {/* ── Referral filters ── */}
                <div className='border-t border-slate-100 pt-4 space-y-3'>
                    <p className='text-[11px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5'>
                        <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'>
                            <path d='M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'/>
                        </svg>
                        Referral Filters
                    </p>

                    {/* Row 1: Has Referral + Referral Code + Referred By */}
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                        <div className='flex flex-col gap-1.5'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Has Referral</label>
                            <select value={params.hasReferral} onChange={e => setHasReferral(e.target.value)}
                                className={selectCls.replace('h-9','h-9')}>
                                {HAS_REFERRAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        <div className='flex flex-col gap-1.5'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Referral Code</label>
                            <div className='relative'>
                                <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>
                                </span>
                                <input type='text' placeholder='e.g. UTHDKNPC' value={referralUI.referralCode}
                                    onChange={e => onReferralCode(e.target.value)}
                                    className='w-full h-9 pl-8 pr-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 tracking-widest placeholder:tracking-normal placeholder:text-slate-300'
                                />
                            </div>
                        </div>

                        <div className='flex flex-col gap-1.5'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Referred By (Promoter)</label>
                            <div className='relative'>
                                <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>
                                </span>
                                <input type='text' placeholder='Promoter name' value={referralUI.referredBy}
                                    onChange={e => onReferredBy(e.target.value)}
                                    className='w-full h-9 pl-8 pr-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300'
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Referral Date range */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        <div className='flex flex-col gap-1.5'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Referral From Date</label>
                            <input type='date' value={params.referralFrom}
                                max={params.referralTo || undefined}
                                onChange={e => setReferralFrom(e.target.value)}
                                className='w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                            />
                        </div>
                        <div className='flex flex-col gap-1.5'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Referral To Date</label>
                            <input type='date' value={params.referralTo}
                                min={params.referralFrom || undefined}
                                onChange={e => setReferralTo(e.target.value)}
                                className='w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                            />
                        </div>
                    </div>
                </div>

                {/* Dropdowns + controls */}
                <div className='grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end'>
                    {[
                        { label: 'Role',       value: params.role,     opts: ROLE_OPTIONS,     fn: setRole     },
                        { label: 'Status',     value: params.status,   opts: STATUS_OPTIONS,   fn: setStatus   },
                        { label: 'Verified',   value: params.verified, opts: VERIFIED_OPTIONS, fn: setVerified },
                        { label: 'Active',     value: params.active,   opts: ACTIVE_OPTIONS,   fn: setActive   },
                        { label: 'Sort By',    value: params.sortBy,   opts: SORT_OPTIONS,     fn: toggleSort  },
                    ].map(({ label, value, opts, fn }) => (
                        <div key={label} className='flex flex-col gap-1.5'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</label>
                            <select value={value} onChange={e => fn(e.target.value)} className={selectCls}>
                                {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    ))}

                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Order</label>
                        <button onClick={toggleSortDir} className='h-9 w-full flex items-center justify-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:border-indigo-400 hover:text-indigo-500 transition-all px-3'>
                            {params.sortDir === 'desc' ? <SortDescIcon /> : <SortAscIcon />}
                            {params.sortDir === 'desc' ? 'Descending' : 'Ascending'}
                        </button>
                    </div>


                    <div className='col-span-2 sm:col-span-1 sm:ml-auto flex items-end gap-2'>
                        {hasFilters && (
                            <button onClick={clearAll} className='h-9 px-3 text-xs font-semibold text-red-600 border-[1.5px] border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap'>
                                Clear All
                            </button>
                        )}
                        <span className='h-9 flex items-center px-3 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full whitespace-nowrap'>
                            {loading ? '…' : `${total.toLocaleString()} ${params.role ? ROLE_OPTIONS.find(r => r.value === params.role)?.label || 'user' : 'user'}${total !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className='flex flex-col items-center justify-center py-14 gap-3 px-5'>
                    <div className='w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center'>
                        <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' stroke='#ef4444' className='w-6 h-6'><circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/></svg>
                    </div>
                    <p className='font-semibold text-slate-700 text-sm'>Failed to load users</p>
                    <p className='text-xs text-slate-400 text-center'>{error}</p>
                    <button onClick={refresh} className='h-9 px-6 bg-indigo-500 text-white text-xs font-semibold rounded-xl hover:bg-indigo-600 transition-colors'>Retry</button>
                </div>
            )}

            {/* ── Mobile cards ── */}
            {!error && (
                <div className='md:hidden'>
                    {loading ? <MobileCardSkeleton rows={5} />
                        : users.length === 0 ? EmptyState
                        : users.map((u, i) => (
                            <UserCard
                                key={u._id}
                                user={u}
                                index={(curPage - 1) * PAGE_LIMIT + i + 1}
                                onStatusUpdated={handleStatusUpdated}
                                onDeposit={() => openModal('deposit',    u)}
                                onWithdraw={() => openModal('withdrawal', u)}
                            />
                        ))
                    }
                </div>
            )}

            {/* ── Desktop table — columns from TABLE_COLUMNS config ── */}
            {!error && (
                <div className='hidden md:block w-full overflow-x-auto table-scroll'>
                    <table className='border-collapse' style={{ minWidth: tableMinW, width: '100%' }}>
                        {/* colgroup pins every column width from the config */}
                        <colgroup>
                            {TABLE_COLUMNS.map(col => (
                                <col key={col.key} style={{ width: col.width, minWidth: col.width }} />
                            ))}
                        </colgroup>

                        <TableHeader
                            columns={TABLE_COLUMNS}
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={toggleSort}
                        />

                        <tbody>
                            {loading ? (
                                <TableSkeleton columns={TABLE_COLUMNS} rows={PAGE_LIMIT} />
                            ) : users.length === 0 ? (
                                <tr><td colSpan={TABLE_COLUMNS.length}>{EmptyState}</td></tr>
                            ) : (
                                users.map((u, i) => (
                                    <UserRow
                                        key={u._id}
                                        columns={TABLE_COLUMNS}
                                        user={u}
                                        index={(curPage - 1) * PAGE_LIMIT + i + 1}
                                        isAdmin={!isPromoter}
                                        onStatusUpdated={handleStatusUpdated}
                                        openModal={openModal}
                                        onEditProfile={handleEditProfile}
                                        onDelete={handleDeleteUser}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Pagination ── */}
            {!loading && !error && pages > 1 && (
                <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-4 border-t border-slate-100'>
                    <p className='text-xs text-slate-500 text-center'>
                        <span className='font-semibold text-slate-700'>{start}–{end}</span> of{' '}
                        <span className='font-semibold text-slate-700'>{total.toLocaleString()}</span>
                        {' '}· Page <span className='font-semibold text-slate-700'>{curPage}</span>/<span className='font-semibold text-slate-700'>{pages}</span>
                    </p>
                    <div className='flex items-center gap-1.5 flex-wrap justify-center'>
                        <PageBtn onClick={() => goToPage(1)}           disabled={curPage === 1 || loading}>«</PageBtn>
                        <PageBtn onClick={() => goToPage(curPage - 1)} disabled={curPage === 1 || loading}><ChevLIcon /></PageBtn>
                        {pageNums.map((p, i) =>
                            p === '…'
                                ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                                : <PageBtn key={p} onClick={() => goToPage(p)} disabled={loading} active={p === curPage}>{p}</PageBtn>
                        )}
                        <PageBtn onClick={() => goToPage(curPage + 1)} disabled={curPage === pages || loading}><ChevRIcon /></PageBtn>
                        <PageBtn onClick={() => goToPage(pages)}       disabled={curPage === pages || loading}>»</PageBtn>
                    </div>
                </div>
            )}
        </div>

        <ActionModal modal={modal} onClose={closeModal} onConfirm={handleConfirm} />
        <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleUserCreated} />
        <EditUserModal user={editUser} open={!!editUser} onClose={handleEditClosed} onSaved={handleEditSaved} />
        </>
    );
}
