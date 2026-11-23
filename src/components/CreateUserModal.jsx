import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { createUser } from '../api';
import { toast }      from '../toast';
import { XIcon }      from '../utils/icons';

const COUNTRIES = [
    { code: 'IN', dial: '91',  flag: '🇮🇳', name: 'India',      len: 10 },
    { code: 'US', dial: '1',   flag: '🇺🇸', name: 'USA',         len: 10 },
    { code: 'GB', dial: '44',  flag: '🇬🇧', name: 'UK',           len: 10 },
    { code: 'AE', dial: '971', flag: '🇦🇪', name: 'UAE',          len: 9  },
    { code: 'AU', dial: '61',  flag: '🇦🇺', name: 'Australia',   len: 9  },
    { code: 'CA', dial: '1',   flag: '🇨🇦', name: 'Canada',       len: 10 },
    { code: 'SG', dial: '65',  flag: '🇸🇬', name: 'Singapore',   len: 8  },
    { code: 'DE', dial: '49',  flag: '🇩🇪', name: 'Germany',      len: 10 },
    { code: 'PK', dial: '92',  flag: '🇵🇰', name: 'Pakistan',    len: 10 },
    { code: 'BD', dial: '880', flag: '🇧🇩', name: 'Bangladesh',  len: 10 },
];

const ROLES = [
    { value: 'user',      label: 'User',      desc: 'Normal game player',               color: 'indigo'  },
    { value: 'promoter',  label: 'Promoter',  desc: 'Referral / business partner',      color: 'emerald' },
    { value: 'sub_admin', label: 'Sub Admin', desc: 'Limited admin operations',         color: 'amber'   },
    { value: 'admin',     label: 'Admin',     desc: 'Full admin access',                color: 'red'     },
    { value: 'bot',       label: 'Bot',       desc: 'AI player (no email/phone needed)',color: 'slate'   },
];

/* Password must match backend: min 10, uppercase, lowercase, digit, symbol */
const validatePassword = pwd => {
    if (!pwd)               return 'Password is required';
    if (pwd.length < 10)    return 'Minimum 10 characters';
    if (!/[a-z]/.test(pwd)) return 'Must include a lowercase letter';
    if (!/[A-Z]/.test(pwd)) return 'Must include an uppercase letter';
    if (!/[0-9]/.test(pwd)) return 'Must include a number';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Must include a symbol (e.g. @, #, !)';
    return '';
};

const RULES = {
    firstName: v => { const s = (v||'').trim(); if (!s) return 'Required'; if (s.length < 2) return 'Min 2 chars'; if (s.length > 50) return 'Max 50 chars'; if (!/^[a-zA-Z\s'\-]+$/.test(s)) return 'Letters only'; return ''; },
    lastName:  v => { const s = (v||'').trim(); if (!s) return 'Required'; if (s.length < 2) return 'Min 2 chars'; if (s.length > 50) return 'Max 50 chars'; if (!/^[a-zA-Z\s'\-]+$/.test(s)) return 'Letters only'; return ''; },
    email:     v => { const s = (v||'').trim(); if (!s) return 'Email is required'; if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s)) return 'Enter a valid email'; return ''; },
};

const validatePhone = (local, country) => {
    const n = local.replace(/\D/g, '');
    if (!n)            return 'Phone number is required';
    if (n.length < 7)  return 'Too short';
    if (n.length > 15) return 'Too long';
    if (country.len && n.length !== country.len) return `${country.name} numbers must be ${country.len} digits`;
    return '';
};

const EMPTY = { firstName: '', lastName: '', email: '', phone: '' };

const EyeOpen  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>;
const EyeClosed= () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94'/><path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19'/><line x1='1' y1='1' x2='23' y2='23'/></svg>;

const InputRow = ({ label, error, children }) => (
    <div className='flex flex-col gap-1.5'>
        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</label>
        {children}
        {error && <p className='text-[11px] text-red-500'>{error}</p>}
    </div>
);

const inputCls = hasErr =>
    `w-full h-10 px-3.5 border-[1.5px] rounded-xl text-sm text-slate-800 bg-slate-50 outline-none transition-all focus:bg-white focus:ring-4 ${
        hasErr ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'
    }`;

const ROLE_COLOR = { indigo: 'bg-indigo-50 border-indigo-300 text-indigo-700', emerald: 'bg-emerald-50 border-emerald-300 text-emerald-700', amber: 'bg-amber-50 border-amber-300 text-amber-700', red: 'bg-red-50 border-red-300 text-red-700', slate: 'bg-slate-50 border-slate-300 text-slate-700' };

const CreateUserModal = memo(function CreateUserModal({ open, onClose, onCreated, fixedRole }) {
    const [form,       setForm]       = useState(EMPTY);
    const [role,       setRole]       = useState(fixedRole || 'user');
    const [country,    setCountry]    = useState(COUNTRIES[0]);
    const [errors,     setErrors]     = useState({});
    const [touched,    setTouched]    = useState({});
    const [loading,    setLoading]    = useState(false);
    const [apiError,   setApiError]   = useState('');
    const [password,   setPassword]   = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');
    const [pwdError,   setPwdError]   = useState('');
    const [showPwd,    setShowPwd]    = useState(false);
    const [showCPwd,   setShowCPwd]   = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);
    const firstRef  = useRef(null);

    const isBot = role === 'bot';

    useEffect(() => {
        if (open) {
            setForm(EMPTY); setErrors({}); setTouched({});
            setApiError(''); setCountry(COUNTRIES[0]); setRole(fixedRole || 'user');
            setPassword(''); setConfirmPwd(''); setPwdError('');
            setShowPwd(false); setShowCPwd(false);
            setTimeout(() => firstRef.current?.focus(), 60);
        }
    }, [open, fixedRole]);

    useEffect(() => {
        if (!showPicker) return;
        const h = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
        document.addEventListener('pointerdown', h);
        return () => document.removeEventListener('pointerdown', h);
    }, [showPicker]);

    const validate = useCallback((field, value) => {
        if (field === 'phone') return validatePhone(value, country);
        return RULES[field]?.(value) || '';
    }, [country]);

    const handleChange = useCallback((field, value) => {
        const v = field === 'phone' ? value.replace(/\D/g, '').slice(0, 15) : value;
        setForm(p => ({ ...p, [field]: v }));
        if (touched[field]) setErrors(p => ({ ...p, [field]: validate(field, v) }));
        if (apiError) setApiError('');
    }, [touched, validate, apiError]);

    const handleBlur = useCallback(field => {
        setTouched(p => ({ ...p, [field]: true }));
        setErrors(p => ({ ...p, [field]: validate(field, form[field]) }));
    }, [validate, form]);

    const handleSubmit = useCallback(async () => {
        /* For bots, only name is required */
        const requiredFields = isBot ? ['firstName', 'lastName'] : ['firstName', 'lastName', 'email', 'phone'];
        setTouched(Object.fromEntries(requiredFields.map(f => [f, true])));
        const newErrors = {};
        for (const field of requiredFields) {
            const e = validate(field, form[field]);
            if (e) newErrors[field] = e;
        }
        setErrors(newErrors);
        if (Object.keys(newErrors).length) return;

        /* Password validation — required for non-bot */
        if (!isBot) {
            const pwdErr = validatePassword(password);
            if (pwdErr) { setPwdError(pwdErr); return; }
            if (password !== confirmPwd) { setPwdError('Passwords do not match'); return; }
        }
        setPwdError('');

        setLoading(true); setApiError('');
        try {
            const res = await createUser({
                firstName:    form.firstName.trim(),
                lastName:     form.lastName.trim(),
                email:        isBot ? '' : form.email.trim(),
                phone:        isBot ? '' : form.phone.replace(/\D/g, ''),
                country_code: country.dial,
                password:     isBot ? '' : password,
                role,
            });
            const msg = res.data?.message || `${form.firstName.trim()} created successfully`;
            toast.success(msg);
            onCreated?.(res.data.data);
            onClose();
        } catch (err) {
            const data = err.response?.data;
            const msg  = data?.message || 'Failed to create user. Please try again.';
            if (data?.data?.field) {
                setErrors(p => ({ ...p, [data.data.field]: msg }));
            } else if (data?.data?.errors) {
                setErrors(data.data.errors);
            } else {
                setApiError(msg);
            }
        } finally { setLoading(false); }
    }, [form, role, country, validate, isBot, onCreated, onClose, password, confirmPwd]);

    if (!open) return null;

    return (
        <div className='fixed inset-0 bg-black/50 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4' onKeyDown={e => e.key === 'Escape' && onClose()}>
            <div className='bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>

                {/* Header */}
                <div className='px-6 py-5 flex items-center justify-between bg-indigo-600'>
                    <div>
                        <h3 className='text-white font-bold text-base'>Create New User</h3>
                        <p className='text-indigo-200 text-xs mt-0.5'>User is active and verified immediately</p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white'><XIcon /></button>
                </div>

                <div className='px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto'>

                    {/* Role selector — hidden when role is fixed by parent */}
                    {!fixedRole && (
                    <div className='space-y-2'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Role</label>
                        <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
                            {ROLES.map(r => (
                                <button
                                    key={r.value}
                                    type='button'
                                    onClick={() => { setRole(r.value); setErrors({}); setApiError(''); }}
                                    className={`flex flex-col items-start px-3 py-2 rounded-xl border-[1.5px] text-left transition-all ${role === r.value ? ROLE_COLOR[r.color] + ' ring-2 ring-offset-1 ring-current/30' : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'}`}
                                >
                                    <span className='text-xs font-bold'>{r.label}</span>
                                    <span className='text-[10px] opacity-70 mt-0.5 leading-tight'>{r.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Name */}
                    <div className='grid grid-cols-2 gap-3'>
                        <InputRow label='First Name' error={touched.firstName && errors.firstName}>
                            <input ref={firstRef} type='text' placeholder='Rahul' value={form.firstName}
                                onChange={e => handleChange('firstName', e.target.value)}
                                onBlur={() => handleBlur('firstName')}
                                className={inputCls(touched.firstName && errors.firstName)} />
                        </InputRow>
                        <InputRow label='Last Name' error={touched.lastName && errors.lastName}>
                            <input type='text' placeholder='Sharma' value={form.lastName}
                                onChange={e => handleChange('lastName', e.target.value)}
                                onBlur={() => handleBlur('lastName')}
                                className={inputCls(touched.lastName && errors.lastName)} />
                        </InputRow>
                    </div>

                    {/* Email + Phone — hidden for bot */}
                    {!isBot && (
                        <>
                        <InputRow label='Email Address' error={touched.email && errors.email}>
                            <input type='email' data-field='email' placeholder='rahul@example.com' value={form.email}
                                onChange={e => handleChange('email', e.target.value)}
                                onBlur={() => handleBlur('email')}
                                className={inputCls(touched.email && errors.email)} autoComplete='off' />
                        </InputRow>

                        <InputRow label='Phone Number' error={touched.phone && errors.phone}>
                            <div className='flex gap-2'>
                                <div className='relative' ref={pickerRef}>
                                    <button type='button' onClick={() => setShowPicker(p => !p)}
                                        className='h-10 px-3 flex items-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl bg-slate-50 hover:border-indigo-400 transition-all text-sm font-medium text-slate-700 whitespace-nowrap'>
                                        <span>{country.flag}</span>
                                        <span>+{country.dial}</span>
                                        <svg viewBox='0 0 16 16' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3 h-3 text-slate-400'><path d='M4 6l4 4 4-4'/></svg>
                                    </button>
                                    {showPicker && (
                                        <ul className='absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-y-auto max-h-56 py-1'>
                                            {COUNTRIES.map(c => (
                                                <li key={c.code} onClick={() => { setCountry(c); setShowPicker(false); if (touched.phone) setErrors(p => ({...p, phone: validatePhone(form.phone, c)})); }}
                                                    className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 ${c.code === country.code ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'}`}>
                                                    <span>{c.flag}</span><span className='flex-1 truncate'>{c.name}</span>
                                                    <span className='text-slate-400 text-xs'>+{c.dial}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <input type='tel' data-field='phone' placeholder={`${country.len} digits`} value={form.phone}
                                    onChange={e => handleChange('phone', e.target.value)}
                                    onBlur={() => handleBlur('phone')}
                                    className={`flex-1 ${inputCls(touched.phone && errors.phone)}`} />
                            </div>
                        </InputRow>

                        {/* Password */}
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                            <InputRow label='Password' error={pwdError && !confirmPwd ? pwdError : ''}>
                                <div className={`flex items-center border-[1.5px] rounded-xl bg-slate-50 transition-all focus-within:bg-white focus-within:ring-4 ${pwdError && !confirmPwd ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-indigo-500 focus-within:ring-indigo-500/10'}`}>
                                    <input type={showPwd ? 'text' : 'password'} placeholder='Min 10 characters' value={password}
                                        onChange={e => { setPassword(e.target.value); setPwdError(''); setApiError(''); }}
                                        autoComplete='new-password'
                                        className='min-w-0 flex-1 h-10 px-3.5 bg-transparent outline-none text-sm text-slate-800' />
                                    <button type='button' onClick={() => setShowPwd(v => !v)} className='shrink-0 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600'>
                                        {showPwd ? <EyeOpen /> : <EyeClosed />}
                                    </button>
                                </div>
                            </InputRow>
                            <InputRow label='Confirm Password' error={pwdError}>
                                <div className={`flex items-center border-[1.5px] rounded-xl bg-slate-50 transition-all focus-within:bg-white focus-within:ring-4 ${pwdError ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100' : 'border-slate-200 focus-within:border-indigo-500 focus-within:ring-indigo-500/10'}`}>
                                    <input type={showCPwd ? 'text' : 'password'} placeholder='Repeat password' value={confirmPwd}
                                        onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); setApiError(''); }}
                                        autoComplete='new-password'
                                        className='min-w-0 flex-1 h-10 px-3.5 bg-transparent outline-none text-sm text-slate-800' />
                                    <button type='button' onClick={() => setShowCPwd(v => !v)} className='shrink-0 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600'>
                                        {showCPwd ? <EyeOpen /> : <EyeClosed />}
                                    </button>
                                </div>
                            </InputRow>
                        </div>
                        {/* Password hint */}
                        <p className='text-[10px] text-slate-400'>
                            Password must be 10+ chars and include uppercase, lowercase, number, and symbol.
                        </p>
                        </>
                    )}

                    {/* Bot info */}
                    {isBot && (
                        <div className='flex items-start gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100'>
                            <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4 text-slate-400 mt-0.5 shrink-0'><circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/></svg>
                            <p className='text-xs text-slate-500'>Bots don't require email, phone, or password. Only a display name is needed.</p>
                        </div>
                    )}

                    {apiError && (
                        <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiError}</p>
                    )}
                </div>

                {/* Footer */}
                <div className='px-6 pb-6 pt-2 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>Cancel</button>
                    <button onClick={handleSubmit} disabled={loading}
                        className='flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60'>
                        {loading ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : `+ Create ${ROLES.find(r => r.value === role)?.label || 'User'}`}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default CreateUserModal;
