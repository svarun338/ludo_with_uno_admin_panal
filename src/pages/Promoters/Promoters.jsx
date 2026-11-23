import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    fetchPromoters, createPromoter, updatePromoter, updatePromoterStatus,
    deletePromoter, generateMyCode, getMyStats,
} from '../../api';
import { usePanelAuth } from '../../context/AuthContext';
import { cacheGet, cacheSet, cacheHas, cacheClear } from '../../cache';
import { toast } from '../../toast';
import PageBtn from '../../components/PageBtn';

/* ── Icons ── */
const SearchIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>;
const XIcon     = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>;
const PlusIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>;
const ChevL     = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevR     = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='9 18 15 12 9 6'/></svg>;
const CopyIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><rect x='9' y='9' width='13' height='13' rx='2'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/></svg>;
const EmptyIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-10 h-10'><path d='M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z'/></svg>;
const EditIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>;

const PAGE_LIMIT = 20;
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
const avatarBg = n => AVATAR_COLORS[(n?.charCodeAt(0)||0) % AVATAR_COLORS.length];
const capWord  = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
const capWords = s => s ? s.split(' ').map(capWord).join(' ') : '';
const getInits = u => {
    if (!u) return '?';
    if (u.displayName) {
        const p = u.displayName.trim().split(/\s+/);
        return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
    }
    return (`${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`).toUpperCase() || '?';
};
const fmtDate  = iso => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* Normalize backend status (ACTIVE / BLOCKED / SUSPENDED …) → 'active' | 'inactive' */
const normalizeStatus = s => ((s || '').toLowerCase() === 'active' ? 'active' : 'inactive');

/* ── Status toggle ── */
const StatusToggle = memo(function StatusToggle({ id, initial, name, onUpdated }) {
    const [cur, setCur] = useState(() => normalizeStatus(initial));
    const [busy, setBusy] = useState(false);

    const toggle = useCallback(async () => {
        const next = cur === 'active' ? 'inactive' : 'active';
        setBusy(true);
        try {
            await updatePromoterStatus(id, next);
            setCur(next);
            onUpdated?.(id, next);
            next === 'active' ? toast.success(`${name} is now Active`) : toast.warning(`${name} is now Inactive`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update status');
        } finally { setBusy(false); }
    }, [cur, id, name, onUpdated]);

    return (
        <button onClick={toggle} disabled={busy} title={cur === 'active' ? 'Click to deactivate' : 'Click to activate'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:opacity-80 disabled:opacity-60 ${
                cur === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}>
            {busy ? <span className='w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin' />
                   : <span className={`w-1.5 h-1.5 rounded-full ${cur === 'active' ? 'bg-emerald-500' : 'bg-red-400'}`} />}
            {cur === 'active' ? 'Active' : 'Inactive'}
        </button>
    );
});

/* ── Delete confirm ── */
const DeleteBtn = memo(function DeleteBtn({ id, name, onDeleted }) {
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);

    const del = useCallback(async () => {
        setBusy(true);
        try {
            await deletePromoter(id);
            onDeleted?.(id);
            toast.success(`${name} deleted`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to delete');
        } finally { setBusy(false); setConfirm(false); }
    }, [id, name, onDeleted]);

    if (!confirm) return (
        <button onClick={() => setConfirm(true)} className='inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all'>
            Delete
        </button>
    );
    return (
        <div className='flex items-center gap-1'>
            <button onClick={del} disabled={busy} className='px-2 py-1 rounded-lg text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60'>
                {busy ? '…' : 'Confirm'}
            </button>
            <button onClick={() => setConfirm(false)} className='px-2 py-1 rounded-lg text-[11px] text-slate-500 hover:text-slate-700'>
                Cancel
            </button>
        </div>
    );
});

/* ── Edit Promoter Modal ── */
const EditModal = memo(function EditModal({ promoter, open, onClose, onSaved }) {
    const [form,    setForm]    = useState({ firstName: '', lastName: '', email: '' });
    const [errors,  setErrors]  = useState({});
    const [apiError,setApiError]= useState('');
    const [loading, setLoading] = useState(false);
    const firstRef = useRef(null);

    useEffect(() => {
        if (open && promoter) {
            let firstName = promoter.firstName || '';
            let lastName  = promoter.lastName  || '';
            if (!firstName && promoter.displayName) {
                const parts = promoter.displayName.trim().split(/\s+/);
                firstName = parts[0] || '';
                lastName  = parts.slice(1).join(' ') || '';
            }
            setForm({ firstName, lastName, email: promoter.email || '' });
            setErrors({}); setApiError('');
            setTimeout(() => firstRef.current?.focus(), 50);
        }
    }, [open, promoter]);

    if (!open || !promoter) return null;

    const validate = f => {
        const v = form[f] || '';
        if (f === 'firstName' || f === 'lastName') {
            const s = v.trim(); if (!s) return 'Required'; if (s.length < 2) return 'Min 2 chars'; if (!/^[a-zA-Z\s'\-]+$/.test(s)) return 'Letters only';
        }
        if (f === 'email') { const s = v.trim(); if (!s) return 'Required'; if (!/^[^@]+@[^@]+\.[a-zA-Z]{2,}$/.test(s)) return 'Invalid email'; }
        return '';
    };

    const submit = async () => {
        const errs = {};
        ['firstName','lastName','email'].forEach(f => { const e = validate(f); if (e) errs[f] = e; });
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setLoading(true); setApiError('');
        try {
            const res = await updatePromoter(promoter._id, { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() });
            toast.success(`${form.firstName.trim()} ${form.lastName.trim()} updated`);
            onSaved?.(res.data.data.promoter);
            onClose();
        } catch (e) {
            const data = e.response?.data;
            if (data?.data?.field) setErrors(p => ({ ...p, [data.data.field]: data.message }));
            else setApiError(data?.message || 'Update failed.');
        } finally { setLoading(false); }
    };

    const inputCls = hasErr => `w-full h-10 px-3.5 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${hasErr ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10'}`;

    return (
        <div className='fixed inset-0 bg-black/50 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4'>
            <div className='bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>
                <div className='px-6 py-5 flex items-center justify-between bg-emerald-600'>
                    <div>
                        <h3 className='text-white font-bold text-base'>Edit Promoter</h3>
                        <p className='text-emerald-200 text-xs mt-0.5'>{promoter.displayName || `${promoter.firstName || ''} ${promoter.lastName || ''}`.trim()}</p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white'><XIcon /></button>
                </div>
                <div className='px-6 py-5 space-y-4'>
                    <div className='grid grid-cols-2 gap-3'>
                        {['firstName','lastName'].map(f => (
                            <div key={f} className='space-y-1.5'>
                                <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{f === 'firstName' ? 'First Name' : 'Last Name'}</label>
                                <input ref={f==='firstName'?firstRef:undefined} type='text' value={form[f]}
                                    onChange={e => { setForm(p=>({...p,[f]:e.target.value})); setErrors(p=>({...p,[f]:''})); setApiError(''); }}
                                    className={inputCls(errors[f])} />
                                {errors[f] && <p className='text-[10px] text-red-500'>{errors[f]}</p>}
                            </div>
                        ))}
                    </div>
                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Email</label>
                        <input type='email' value={form.email}
                            onChange={e => { setForm(p=>({...p,email:e.target.value})); setErrors(p=>({...p,email:''})); setApiError(''); }}
                            className={inputCls(errors.email)} />
                        {errors.email && <p className='text-[10px] text-red-500'>{errors.email}</p>}
                    </div>
                    {apiError && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiError}</p>}
                </div>
                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>Cancel</button>
                    <button onClick={submit} disabled={loading}
                        className='flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60'>
                        {loading ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
});

const COUNTRIES = [
    { code:'IN', dial:'91',  flag:'🇮🇳', name:'India',     len:10 },
    { code:'US', dial:'1',   flag:'🇺🇸', name:'USA',        len:10 },
    { code:'GB', dial:'44',  flag:'🇬🇧', name:'UK',          len:10 },
    { code:'AE', dial:'971', flag:'🇦🇪', name:'UAE',         len:9  },
    { code:'AU', dial:'61',  flag:'🇦🇺', name:'Australia',  len:9  },
    { code:'CA', dial:'1',   flag:'🇨🇦', name:'Canada',      len:10 },
    { code:'SG', dial:'65',  flag:'🇸🇬', name:'Singapore',  len:8  },
    { code:'DE', dial:'49',  flag:'🇩🇪', name:'Germany',     len:10 },
    { code:'PK', dial:'92',  flag:'🇵🇰', name:'Pakistan',   len:10 },
    { code:'BD', dial:'880', flag:'🇧🇩', name:'Bangladesh', len:10 },
];

const EyeOpen   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>;
const EyeClosed = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94'/><path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19'/><line x1='1' y1='1' x2='23' y2='23'/></svg>;

/* ── Create Promoter Modal ── */
const CreateModal = memo(function CreateModal({ open, onClose, onCreated }) {
    const [form,       setForm]       = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [country,    setCountry]    = useState(COUNTRIES[0]);
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);
    const [errors,     setErrors]     = useState({});
    const [apiError,   setApiError]   = useState('');
    const [loading,    setLoading]    = useState(false);
    const [password,   setPassword]   = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdError,   setPwdError]   = useState('');
    const [showPwd,    setShowPwd]    = useState(false);
    const [showCPwd,   setShowCPwd]   = useState(false);
    const firstRef = useRef(null);

    useEffect(() => {
        if (open) {
            setForm({ firstName: '', lastName: '', email: '', phone: '' });
            setCountry(COUNTRIES[0]); setErrors({}); setApiError('');
            setPassword(''); setConfirmPwd(''); setPwdError('');
            setShowPwd(false); setShowCPwd(false);
            setTimeout(() => firstRef.current?.focus(), 50);
        }
    }, [open]);

    // Close country picker on outside click
    useEffect(() => {
        if (!showPicker) return;
        const close = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [showPicker]);

    if (!open) return null;

    const validatePhone = () => {
        const n = form.phone.replace(/\D/g,'');
        if (!n) return 'Required';
        if (country.len && n.length !== country.len) return `${country.name} numbers must be ${country.len} digits`;
        if (n.length < 4) return 'Too short';
        return '';
    };

    const validate = f => {
        const v = form[f] || '';
        if (f === 'firstName' || f === 'lastName') {
            const s = v.trim();
            if (!s) return 'Required';
            if (s.length < 2) return 'Min 2 chars';
            if (!/^[a-zA-Z\s'\-]+$/.test(s)) return 'Letters only';
        }
        if (f === 'email') { const s = v.trim(); if (!s) return 'Required'; if (!/^[^@]+@[^@]+\.[a-zA-Z]{2,}$/.test(s)) return 'Invalid email'; }
        if (f === 'phone') return validatePhone();
        return '';
    };

    const submit = async () => {
        const errs = {};
        ['firstName','lastName','email','phone'].forEach(f => { const e = validate(f); if (e) errs[f] = e; });
        setErrors(errs);
        if (Object.keys(errs).length) return;

        if (!password || password.length < 6) { setPwdError('Password must be at least 6 characters'); return; }
        if (password !== confirmPwd)           { setPwdError('Passwords do not match'); return; }
        setPwdError('');

        setLoading(true); setApiError('');
        try {
            const res = await createPromoter({
                firstName:        form.firstName.trim(),
                lastName:         form.lastName.trim(),
                email:            form.email.trim(),
                phone:            form.phone.replace(/\D/g,''),
                country_code:     country.dial,
                password,
                confirm_password: confirmPwd,
            });
            toast.success(`${form.firstName.trim()} ${form.lastName.trim()} created as Promoter`);
            onCreated?.(res.data.data.promoter);
            onClose();
        } catch (e) {
            const data = e.response?.data;
            if (data?.data?.errors) setErrors(data.data.errors);
            else if (data?.data?.field) setErrors({ [data.data.field]: data.message });
            else setApiError(data?.message || 'Failed to create promoter.');
        } finally { setLoading(false); }
    };

    const inputCls = hasErr => `w-full h-10 px-3.5 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${hasErr ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10'}`;

    return (
        <div className='fixed inset-0 bg-black/50 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4'>
            <div className='bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>
                <div className='px-6 py-5 flex items-center justify-between bg-emerald-600'>
                    <div>
                        <h3 className='text-white font-bold text-base'>Create Promoter</h3>
                        <p className='text-emerald-200 text-xs mt-0.5'>New promoter will be active immediately</p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white'><XIcon /></button>
                </div>

                <div className='px-6 py-5 space-y-4'>
                    <div className='grid grid-cols-2 gap-3'>
                        {['firstName','lastName'].map(f => (
                            <div key={f} className='space-y-1.5'>
                                <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{f === 'firstName' ? 'First Name' : 'Last Name'}</label>
                                <input ref={f === 'firstName' ? firstRef : undefined} type='text' value={form[f]}
                                    onChange={e => { setForm(p => ({...p,[f]:e.target.value})); setErrors(p=>({...p,[f]:''})); setApiError(''); }}
                                    placeholder={f === 'firstName' ? 'Raj' : 'Verma'} className={inputCls(errors[f])} />
                                {errors[f] && <p className='text-[10px] text-red-500'>{errors[f]}</p>}
                            </div>
                        ))}
                    </div>
                    <div className='space-y-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Email</label>
                        <input type='email' value={form.email} onChange={e => { setForm(p=>({...p,email:e.target.value})); setErrors(p=>({...p,email:''})); setApiError(''); }}
                            placeholder='raj@example.com' className={inputCls(errors.email)} />
                        {errors.email && <p className='text-[10px] text-red-500'>{errors.email}</p>}
                    </div>
                    <div className='space-y-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Phone Number</label>
                        <div className='flex gap-2'>
                            {/* Country picker */}
                            <div className='relative' ref={pickerRef}>
                                <button type='button' onClick={() => setShowPicker(p => !p)}
                                    className='h-10 px-3 flex items-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl bg-slate-50 hover:border-emerald-400 transition-all text-sm whitespace-nowrap'>
                                    <span>{country.flag}</span>
                                    <span className='font-medium text-slate-700'>+{country.dial}</span>
                                    <svg viewBox='0 0 16 16' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3 h-3 text-slate-400'><path d='M4 6l4 4 4-4'/></svg>
                                </button>
                                {showPicker && (
                                    <ul className='absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-y-auto max-h-52 py-1'>
                                        {COUNTRIES.map(c => (
                                            <li key={c.code} onClick={() => { setCountry(c); setShowPicker(false); setErrors(p=>({...p,phone:''})); }}
                                                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${c.code===country.code?'bg-emerald-50 text-emerald-700 font-semibold':'text-slate-700'}`}>
                                                <span>{c.flag}</span><span className='flex-1 truncate'>{c.name}</span>
                                                <span className='text-xs text-slate-400'>+{c.dial}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <input type='tel' value={form.phone}
                                onChange={e => { setForm(p=>({...p,phone:e.target.value.replace(/\D/g,'').slice(0,15)})); setErrors(p=>({...p,phone:''})); setApiError(''); }}
                                placeholder={`${country.len || 10} digits`}
                                className={`flex-1 ${inputCls(errors.phone)}`} />
                        </div>
                        {errors.phone && <p className='text-[10px] text-red-500'>{errors.phone}</p>}
                    </div>

                    {/* Password */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                        <div className='space-y-1.5'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Password</label>
                            <div className={`flex items-center border-[1.5px] rounded-xl bg-slate-50 transition-all focus-within:bg-white focus-within:ring-4 ${pwdError && !confirmPwd ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-emerald-500 focus-within:ring-emerald-500/10'}`}>
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    placeholder='Min 6 characters'
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setPwdError(''); setApiError(''); }}
                                    autoComplete='new-password'
                                    className='min-w-0 flex-1 h-10 px-3.5 bg-transparent outline-none text-sm text-slate-900'
                                />
                                <button type='button' onClick={() => setShowPwd(v => !v)} className='shrink-0 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600'>
                                    {showPwd ? <EyeOpen /> : <EyeClosed />}
                                </button>
                            </div>
                            {pwdError && !confirmPwd && <p className='text-[10px] text-red-500'>{pwdError}</p>}
                        </div>
                        <div className='space-y-1.5'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Confirm Password</label>
                            <div className={`flex items-center border-[1.5px] rounded-xl bg-slate-50 transition-all focus-within:bg-white focus-within:ring-4 ${pwdError ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-emerald-500 focus-within:ring-emerald-500/10'}`}>
                                <input
                                    type={showCPwd ? 'text' : 'password'}
                                    placeholder='Repeat password'
                                    value={confirmPwd}
                                    onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); setApiError(''); }}
                                    autoComplete='new-password'
                                    className='min-w-0 flex-1 h-10 px-3.5 bg-transparent outline-none text-sm text-slate-900'
                                />
                                <button type='button' onClick={() => setShowCPwd(v => !v)} className='shrink-0 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600'>
                                    {showCPwd ? <EyeOpen /> : <EyeClosed />}
                                </button>
                            </div>
                            {pwdError && <p className='text-[10px] text-red-500'>{pwdError}</p>}
                        </div>
                    </div>

                    {apiError && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiError}</p>}
                </div>

                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>Cancel</button>
                    <button onClick={submit} disabled={loading}
                        className='flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60'>
                        {loading ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : '+ Create Promoter'}
                    </button>
                </div>
            </div>
        </div>
    );
});

/* ════════════════════ MAIN PAGE ════════════════════ */
export default function Promoters() {
    const { role } = usePanelAuth();
    const isAdmin  = role === 'a';

    const [promoters, setPromoters] = useState([]);
    const [total,     setTotal]     = useState(0);
    const [pages,     setPages]     = useState(1);
    const [params,    setParams]    = useState({ page: 1, limit: PAGE_LIMIT, firstName: '', lastName: '', email: '', status: '', verified: '', active: '', fromDate: '', toDate: '', sortBy: 'createdAt', sortDir: 'desc' });
    const [rawSearch, setRawSearch] = useState({ firstName: '', lastName: '', email: '' });
    const fieldRef = useRef({ firstName: '', lastName: '', email: '' });
    const timerRef = useRef(null);
    const [loading, setLoading]     = useState(true);
    const [error,   setError]       = useState('');
    const [createOpen,  setCreateOpen]  = useState(false);
    const [editPromoter,setEditPromoter]= useState(null);

    /* Promoter-only: my code + stats */
    const [myCode,  setMyCode]  = useState('');
    const [stats,   setStats]   = useState({ referredUsers: 0, referredPromoters: 0 });
    const [genLoading, setGenLoading] = useState(false);

    useEffect(() => {
        if (!isAdmin) {
            getMyStats().then(r => {
                setStats(r.data.data);
                if (r.data.data.referralCode) setMyCode(r.data.data.referralCode);
            }).catch(() => {});
        }
    }, [isAdmin]);

    /* Debounce text fields */
    const setField = useCallback((f, v) => {
        fieldRef.current = { ...fieldRef.current, [f]: v };
        setRawSearch({ ...fieldRef.current });
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() =>
            setParams(p => ({ ...p, page: 1, ...fieldRef.current })), 380);
    }, []);

    const setStatus    = useCallback(v => setParams(p => ({ ...p, page: 1, status:   v })), []);
    const setVerified  = useCallback(v => setParams(p => ({ ...p, page: 1, verified: v })), []);
    const setActive    = useCallback(v => setParams(p => ({ ...p, page: 1, active:   v })), []);
    const setStartDate = useCallback(v => setParams(p => ({ ...p, page: 1, fromDate: v })), []);
    const setEndDate   = useCallback(v => setParams(p => ({ ...p, page: 1, toDate:   v })), []);
    const goToPage     = useCallback(pg => setParams(p => ({ ...p, page: pg })), []);
    const clearAll     = useCallback(() => {
        clearTimeout(timerRef.current);
        fieldRef.current = { firstName: '', lastName: '', email: '' };
        setRawSearch(fieldRef.current);
        setParams({ page: 1, limit: PAGE_LIMIT, firstName: '', lastName: '', email: '', status: '', verified: '', active: '', fromDate: '', toDate: '', sortBy: 'createdAt', sortDir: 'desc' });
    }, []);

    /* Fetch */
    const doFetch = useCallback((p) => {
        const key = `promoters-${JSON.stringify(p)}`;
        if (cacheHas(key)) {
            const c = cacheGet(key);
            setPromoters(c.promoters ?? []); setTotal(c.total ?? 0); setPages(c.pages ?? 1);
            setLoading(false); return;
        }
        setError('');
        let cancelled = false;
        fetchPromoters(p)
            .then(r => {
                if (cancelled) return;
                const d          = r.data.data;
                const pagination = r.data.pagination;
                const promoters  = Array.isArray(d) ? d : (d.promoters ?? []);
                const total      = pagination?.total     ?? d.total  ?? 0;
                const pages      = pagination?.totalPages ?? d.pages ?? 1;
                setPromoters(promoters); setTotal(total); setPages(pages);
                cacheSet(key, { promoters, total, pages });
            })
            .catch(e => { if (!cancelled) setError(e.response?.data?.message || 'Network error.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { setLoading(true); return doFetch(params); }, [params, doFetch]);

    const handleStatusUpdated = useCallback((id, s) => {
        setPromoters(prev => prev.map(p => p._id === id ? { ...p, status: s } : p));
        cacheClear();
    }, []);

    const handleDeleted = useCallback(id => {
        setPromoters(prev => prev.filter(p => p._id !== id));
        setTotal(t => t - 1);
        cacheClear();
    }, []);

    const handleCreated = useCallback(() => {
        cacheClear(); setLoading(true); doFetch({ ...params, page: 1 });
    }, [params, doFetch]);

    const handleEditSaved = useCallback(updated => {
        setPromoters(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p));
        cacheClear();
        setEditPromoter(null);
    }, []);

    const copyCode = async code => {
        try { await navigator.clipboard.writeText(code); toast.success('Referral code copied!'); }
        catch { toast.error('Failed to copy'); }
    };

    const generateCode = async () => {
        setGenLoading(true);
        try {
            const r = await generateMyCode();
            setMyCode(r.data.data.referralCode);
            setStats(p => ({ ...p, referralCode: r.data.data.referralCode }));
            toast.success('Referral code generated!');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to generate code');
        } finally { setGenLoading(false); }
    };

    const { page: curPage } = params;
    const start = (curPage - 1) * PAGE_LIMIT + 1;
    const end   = Math.min(curPage * PAGE_LIMIT, total);
    const pageNums = useMemo(() =>
        Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || Math.abs(p - curPage) <= 1)
            .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push('…'); acc.push(p); return acc; }, []),
        [pages, curPage]);

    const hasFilters = Object.values(rawSearch).some(Boolean) || params.status || params.verified || params.active || params.fromDate || params.toDate;
    const selectCls  = 'h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';

    return (
        <>
        <div className='space-y-5'>

            {/* Promoter: my code + stats cards */}
            {!isAdmin && (
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                    <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100 sm:col-span-1'>
                        <p className='text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2'>My Referral Code</p>
                        {myCode ? (
                            <div className='flex items-center gap-2'>
                                <code className='text-xl font-bold text-emerald-700 tracking-widest'>{myCode}</code>
                                <button onClick={() => copyCode(myCode)} className='text-slate-400 hover:text-emerald-600 transition-colors'><CopyIcon /></button>
                            </div>
                        ) : (
                            <button onClick={generateCode} disabled={genLoading}
                                className='h-9 px-4 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center gap-2'>
                                {genLoading ? <span className='w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : <PlusIcon />}
                                Generate Code
                            </button>
                        )}
                    </div>
                    <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100'>
                        <p className='text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1'>Referred Users</p>
                        <p className='text-3xl font-bold text-slate-900'>{stats.referredUsers.toLocaleString()}</p>
                    </div>
                    <div className='bg-white rounded-2xl p-5 shadow-sm border border-slate-100'>
                        <p className='text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1'>Sub-Promoters</p>
                        <p className='text-3xl font-bold text-slate-900'>{stats.referredPromoters.toLocaleString()}</p>
                    </div>
                </div>
            )}

            {/* Table card */}
            <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>

                {/* Toolbar */}
                <div className='p-4 sm:p-5 border-b border-slate-100 space-y-3'>
                    <div className='flex items-center justify-between'>
                        <p className='text-sm font-bold text-slate-700'>
                            {isAdmin ? 'All Promoters' : 'My Sub-Promoters'}
                        </p>
                        {isAdmin && (
                            <button onClick={() => setCreateOpen(true)}
                                className='h-9 px-4 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm'>
                                <PlusIcon />Create Promoter
                            </button>
                        )}
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                        {[['firstName','First Name'],['lastName','Last Name'],['email','Email']].map(([f, lbl]) => (
                            <div key={f} className='relative'>
                                <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'><SearchIcon /></span>
                                <input type='text' placeholder={lbl} value={rawSearch[f]}
                                    onChange={e => setField(f, e.target.value)}
                                    className='w-full h-9 pl-8 pr-7 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 placeholder:text-slate-300'
                                />
                                {rawSearch[f] && <button onClick={() => setField(f,'')} className='absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400'><XIcon /></button>}
                            </div>
                        ))}
                    </div>

                    <div className='flex items-center gap-2 flex-wrap'>
                        <select value={params.status} onChange={e => setStatus(e.target.value)} className={selectCls}>
                            <option value=''>All Status</option>
                            <option value='active'>Active</option>
                            <option value='inactive'>Inactive</option>
                            <option value='pending'>Pending</option>
                            <option value='blocked'>Blocked</option>
                        </select>
                        <select value={params.verified} onChange={e => setVerified(e.target.value)} className={selectCls}>
                            <option value=''>Any Verification</option>
                            <option value='verified'>Verified</option>
                            <option value='unverified'>Unverified</option>
                        </select>
                        <select value={params.active} onChange={e => setActive(e.target.value)} className={selectCls}>
                            <option value=''>Any Active State</option>
                            <option value='active'>Active</option>
                            <option value='inactive'>Inactive</option>
                        </select>
                        <div className='flex items-center gap-1.5'>
                            <input type='date' value={params.fromDate} onChange={e => setStartDate(e.target.value)}
                                className={selectCls + ' w-36'} title='From date' />
                            <span className='text-slate-400 text-xs'>–</span>
                            <input type='date' value={params.toDate} onChange={e => setEndDate(e.target.value)}
                                className={selectCls + ' w-36'} title='To date' />
                        </div>
                        {hasFilters && <button onClick={clearAll} className='h-9 px-3 text-xs font-semibold text-red-600 border-[1.5px] border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors'>Clear All</button>}
                        <span className='ml-auto text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-2 rounded-full'>
                            {loading ? '…' : `${total.toLocaleString()} promoter${total !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className='flex flex-col items-center justify-center py-12 gap-3'>
                        <p className='font-semibold text-slate-700 text-sm'>Failed to load</p>
                        <p className='text-xs text-slate-400'>{error}</p>
                        <button onClick={() => { setLoading(true); doFetch(params); }} className='h-9 px-5 bg-emerald-600 text-white text-xs font-semibold rounded-xl'>Retry</button>
                    </div>
                )}

                {/* Table */}
                {!error && (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm min-w-max'>
                            <thead className='sticky top-0 z-10'>
                                <tr className='bg-slate-50 border-b-[1.5px] border-slate-200'>
                                    {['#','Promoter','Email','Phone','Referral Code','Balance','Verified','Active','Joined','Updated',...(isAdmin?['Status','Action']:[])].map(h => (
                                        <th key={h} className='px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({length:6}).map((_,i)=>(
                                        <tr key={i} className='border-b border-slate-50'>
                                            {Array.from({length: isAdmin ? 12 : 10}).map((__,j)=>(
                                                <td key={j} className='px-5 py-4'>
                                                    {j===1 ? <div className='flex items-center gap-3'><div className='w-9 h-9 bg-slate-100 rounded-xl animate-pulse'/><div className='space-y-1.5'><div className='h-3 w-24 bg-slate-100 rounded animate-pulse'/><div className='h-2 w-14 bg-slate-100 rounded animate-pulse'/></div></div>
                                                           : <div className='h-3 w-20 bg-slate-100 rounded animate-pulse'/>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : promoters.length === 0 ? (
                                    <tr><td colSpan={isAdmin ? 12 : 10}>
                                        <div className='flex flex-col items-center justify-center py-16 gap-3'>
                                            <div className='text-slate-200'><EmptyIcon /></div>
                                            <p className='font-semibold text-slate-500 text-sm'>No promoters found</p>
                                            {hasFilters && <button onClick={clearAll} className='text-xs text-emerald-600 hover:underline'>Clear filters</button>}
                                        </div>
                                    </td></tr>
                                ) : promoters.map((p, i) => {
                                    const name = p.displayName || `${capWords(p.firstName)} ${capWords(p.lastName)}`.trim();
                                    const initials = getInits(p);
                                    return (
                                        <tr key={p._id} className='border-b border-slate-50 last:border-0 hover:bg-emerald-50/30 transition-colors'>
                                            <td className='px-5 py-3.5 text-xs text-slate-400 font-mono'>{(curPage-1)*PAGE_LIMIT+i+1}</td>
                                            <td className='px-5 py-3.5'>
                                                <div className='flex items-center gap-3'>
                                                    <div className='w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0' style={{ background: avatarBg(p.displayName || p.firstName) }}>
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <p className='font-semibold text-slate-800 text-sm'>{name}</p>
                                                        <p className='text-[10px] text-slate-400 font-mono'>…{(p._id||'').slice(-8)}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className='px-5 py-3.5 text-slate-500 text-sm lowercase'>{p.email}</td>
                                            <td className='px-5 py-3.5 text-slate-500 font-mono text-xs whitespace-nowrap'>{p.mobile || p.phone || '—'}</td>
                                            <td className='px-5 py-3.5'>
                                                {(p.promoterProfile?.referralCode || p.referralCode) ? (
                                                    <div className='flex items-center gap-1.5'>
                                                        <code className='text-xs font-bold text-emerald-700 tracking-wider bg-emerald-50 px-2 py-0.5 rounded'>{p.promoterProfile?.referralCode || p.referralCode}</code>
                                                        <button onClick={() => copyCode(p.promoterProfile?.referralCode || p.referralCode)} className='text-slate-400 hover:text-emerald-600 transition-colors'><CopyIcon /></button>
                                                    </div>
                                                ) : <span className='text-xs text-slate-300 italic'>Not generated</span>}
                                            </td>
                                            <td className='px-5 py-3.5 text-sm font-bold text-slate-700 whitespace-nowrap text-right'>
                                                {p.balance?.total != null
                                                    ? `₹${Number(p.balance.total).toLocaleString('en-IN')}`
                                                    : <span className='text-slate-300 text-xs font-normal'>—</span>
                                                }
                                            </td>
                                            {/* Verified badge */}
                                            <td className='px-5 py-3.5'>
                                                {(() => {
                                                    const isVerified = p.isVerified !== undefined ? p.isVerified : p.status !== 'PENDING_VERIFICATION';
                                                    return (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-400'}`}/>
                                                            {isVerified ? 'Verified' : 'Pending'}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            {/* Active badge */}
                                            <td className='px-5 py-3.5'>
                                                {(() => {
                                                    const isActive = p.isActive !== undefined ? p.isActive : (p.status || '').toLowerCase() === 'active';
                                                    return (
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isActive ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-sky-500' : 'bg-slate-400'}`}/>
                                                            {isActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className='px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap'>{fmtDate(p.createdAt)}</td>
                                            <td className='px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap'>{p.updatedAt ? fmtDate(p.updatedAt) : '—'}</td>
                                            {isAdmin && (
                                            <td className='px-5 py-3.5'>
                                                <StatusToggle id={p._id} initial={p.status} name={name} onUpdated={handleStatusUpdated} />
                                            </td>
                                            )}
                                            {isAdmin && (
                                                <td className='px-5 py-3.5'>
                                                    <div className='flex items-center gap-1.5 flex-wrap'>
                                                        <Link to={`/dashboard/promoters/${p._id}`}
                                                            className='inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all'>
                                                            View
                                                        </Link>
                                                        <button onClick={() => setEditPromoter(p)}
                                                            className='inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all'>
                                                            <EditIcon />Edit
                                                        </button>
                                                        <DeleteBtn id={p._id} name={name} onDeleted={handleDeleted} />
                                                    </div>
                                                </td>
                                            )}
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
                        <p className='text-xs text-slate-500 text-center'>
                            <span className='font-semibold text-slate-700'>{start}–{end}</span> of{' '}
                            <span className='font-semibold text-slate-700'>{total.toLocaleString()}</span>
                            {' '}· Page <span className='font-semibold text-slate-700'>{curPage}</span>/<span className='font-semibold text-slate-700'>{pages}</span>
                        </p>
                        <div className='flex items-center gap-1.5 flex-wrap justify-center'>
                            <PageBtn onClick={() => goToPage(1)}           disabled={curPage===1||loading}>«</PageBtn>
                            <PageBtn onClick={() => goToPage(curPage-1)}   disabled={curPage===1||loading}><ChevL /></PageBtn>
                            {pageNums.map((p,i) => p==='…'
                                ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                                : <PageBtn key={p} onClick={()=>goToPage(p)} disabled={loading} active={p===curPage}>{p}</PageBtn>
                            )}
                            <PageBtn onClick={() => goToPage(curPage+1)}   disabled={curPage===pages||loading}><ChevR /></PageBtn>
                            <PageBtn onClick={() => goToPage(pages)}       disabled={curPage===pages||loading}>»</PageBtn>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
        <EditModal promoter={editPromoter} open={!!editPromoter} onClose={() => setEditPromoter(null)} onSaved={handleEditSaved} />
        </>
    );
}
