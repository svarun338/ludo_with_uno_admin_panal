import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { promoterSignupInit, verifySignupOtp, resendVerificationOtp } from '../../api';
import { usePanelAuth } from '../../context/AuthContext';

const COUNTRIES = [
    { code: 'IN', dial: '91',  flag: '🇮🇳', name: 'India',    len: 10 },
    { code: 'US', dial: '1',   flag: '🇺🇸', name: 'USA',       len: 10 },
    { code: 'GB', dial: '44',  flag: '🇬🇧', name: 'UK',         len: 10 },
    { code: 'AE', dial: '971', flag: '🇦🇪', name: 'UAE',        len: 9  },
    { code: 'AU', dial: '61',  flag: '🇦🇺', name: 'Australia', len: 9  },
    { code: 'CA', dial: '1',   flag: '🇨🇦', name: 'Canada',     len: 10 },
    { code: 'SG', dial: '65',  flag: '🇸🇬', name: 'Singapore', len: 8  },
];

const RULES = {
    firstName: v => { const s = v?.trim(); if (!s) return 'Required'; if (s.length < 2) return 'Min 2 chars'; if (!/^[a-zA-Z\s'\-]+$/.test(s)) return 'Letters only'; return ''; },
    lastName:  v => { const s = v?.trim(); if (!s) return 'Required'; if (s.length < 2) return 'Min 2 chars'; if (!/^[a-zA-Z\s'\-]+$/.test(s)) return 'Letters only'; return ''; },
    email:     v => { const s = v?.trim(); if (!s) return 'Required'; if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s)) return 'Invalid email'; return ''; },
};

const RESEND_COOLDOWN = 60;

function OtpStep({ mobile, email, otpPreview, onVerified }) {
    const [otp,      setOtp]      = useState('');
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);
    const [resending,setResending]= useState(false);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
    const [hint,     setHint]     = useState(otpPreview || '');
    const timerRef = useRef(null);

    useEffect(() => {
        timerRef.current = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
        return () => clearInterval(timerRef.current);
    }, []);

    const handleVerify = async () => {
        if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
        setLoading(true); setError('');
        try {
            const res = await verifySignupOtp({ mobile, email, otp });
            onVerified(res.data.data);
        } catch (e) {
            setError(e.response?.data?.message || 'Invalid or expired OTP. Please try again.');
        } finally { setLoading(false); }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        setResending(true); setError('');
        try {
            const res = await resendVerificationOtp({ mobile, email });
            const preview = res.data.data?.otpPreview;
            if (preview) setHint(preview);
            setCooldown(RESEND_COOLDOWN);
            clearInterval(timerRef.current);
            timerRef.current = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
        } catch (e) {
            setError(e.response?.data?.message || 'Could not resend OTP. Please wait and try again.');
        } finally { setResending(false); }
    };

    const display = mobile
        ? `+${mobile.slice(0, 2)}****${mobile.slice(-4)}`
        : email
        ? email.replace(/(.{2}).*(@.*)/, '$1***$2')
        : 'your contact';

    return (
        <div className='space-y-5'>
            <div className='text-center space-y-1'>
                <p className='text-sm text-slate-600'>We sent a 6-digit code to</p>
                <p className='font-semibold text-slate-800 text-sm'>{display}</p>
                {hint && (
                    <p className='text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 font-mono tracking-widest'>
                        Dev preview: {hint}
                    </p>
                )}
            </div>

            <div className='space-y-1.5'>
                <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>OTP Code</label>
                <input
                    type='text'
                    inputMode='numeric'
                    maxLength={6}
                    value={otp}
                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    placeholder='• • • • • •'
                    className={`w-full h-12 px-4 border-[1.5px] rounded-xl text-center text-xl font-bold tracking-[0.5em] outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10'}`}
                />
                {error && <p className='text-[10px] text-red-500'>{error}</p>}
            </div>

            <button
                onClick={handleVerify}
                disabled={loading || otp.length !== 6}
                className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-60 flex items-center justify-center'
            >
                {loading
                    ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                    : 'Verify & Create Account'
                }
            </button>

            <p className='text-center text-xs text-slate-500'>
                Didn&apos;t receive it?{' '}
                {cooldown > 0 ? (
                    <span className='text-slate-400'>Resend in {cooldown}s</span>
                ) : (
                    <button
                        type='button'
                        onClick={handleResend}
                        disabled={resending}
                        className='text-emerald-600 font-medium hover:underline disabled:opacity-50'
                    >
                        {resending ? 'Sending…' : 'Resend OTP'}
                    </button>
                )}
            </p>
        </div>
    );
}

export default function PromoterSignup() {
    const { login } = usePanelAuth();
    const navigate  = useNavigate();

    const [form,     setForm]     = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [password, setPassword] = useState('');
    const [confirmPwd,setConfirmPwd]= useState('');
    const [showPwd,  setShowPwd]  = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [country,setCountry]= useState(COUNTRIES[0]);
    const [errors, setErrors] = useState({});
    const [touched,setTouched]= useState({});
    const [apiError,setApiErr]= useState('');
    const [loading,setLoading]= useState(false);
    const [success,setSuccess]= useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);

    /* OTP step state */
    const [otpStep,   setOtpStep]  = useState(false);
    const [otpMobile, setOtpMobile]= useState('');
    const [otpEmail,  setOtpEmail] = useState('');
    const [otpHint,   setOtpHint]  = useState('');

    const fullPhone = `${country.dial}${form.phone.replace(/\D/g, '')}`;

    useEffect(() => {
        if (!showPicker) return;
        const close = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [showPicker]);

    const validatePhone = (v, c = country) => {
        const n = v?.replace(/\D/g, '') || '';
        if (!n)              return 'Phone number is required';
        if (n.length < 7)    return 'Too short — enter number without country code';
        if (n.length > 15)   return 'Too long';
        if (c.len && n.length !== c.len) return `${c.name} numbers must be ${c.len} digits`;
        return '';
    };

    const validate = (f, v, c) => f === 'phone' ? validatePhone(v, c) : (RULES[f]?.(v) || '');

    const change = (f, v) => {
        const val = f === 'phone' ? v.replace(/\D/g,'').slice(0,15) : v;
        setForm(p => ({ ...p, [f]: val }));
        if (touched[f]) setErrors(p => ({ ...p, [f]: validate(f, val) }));
        setApiErr('');
    };

    const blur = f => { setTouched(p => ({ ...p, [f]: true })); setErrors(p => ({ ...p, [f]: validate(f, form[f]) })); };

    const handleSubmit = async () => {
        setTouched({ firstName: true, lastName: true, email: true, phone: true });
        const errs = {};
        ['firstName','lastName','email','phone'].forEach(f => { const e = validate(f, form[f], country); if (e) errs[f] = e; });
        setErrors(errs);
        if (Object.keys(errs).length) return;

        if (!password || password.length < 10)     { setPwdError('Password must be at least 10 characters'); return; }
        if (!/[a-z]/.test(password))               { setPwdError('Password must include a lowercase letter'); return; }
        if (!/[A-Z]/.test(password))               { setPwdError('Password must include an uppercase letter'); return; }
        if (!/[^a-zA-Z0-9]/.test(password))        { setPwdError('Password must include a symbol'); return; }
        if (password !== confirmPwd)               { setPwdError('Passwords do not match'); return; }
        setPwdError('');

        setLoading(true); setApiErr('');
        try {
            const res = await promoterSignupInit({
                firstName: form.firstName.trim(),
                lastName:  form.lastName.trim(),
                email:     form.email.trim(),
                phone:     fullPhone,
                password,
            });
            const payload = res.data.data;

            if (payload.pendingVerification) {
                setOtpMobile(payload.mobile || fullPhone);
                setOtpEmail(payload.email || form.email.trim());
                setOtpHint(payload.otpPreview || '');
                setOtpStep(true);
                return;
            }

            /* Admin-created path (immediate ACTIVE, no OTP) */
            const { user, accessToken, refreshToken } = payload;
            const role = user.roles?.includes('admin') || user.roles?.includes('super_admin') ? 'a' : 'p';
            localStorage.setItem('panel_refresh_token', refreshToken || '');
            login({ ...user, role }, accessToken);
            setSuccess(true);
            setTimeout(() => navigate('/dashboard/users', { replace: true }), 1000);
        } catch (e) {
            const data = e.response?.data;
            if (data?.data?.errors) setErrors(data.data.errors);
            else setApiErr(data?.message || 'Registration failed.');
        } finally { setLoading(false); }
    };

    const handleOtpVerified = ({ user, accessToken, refreshToken }) => {
        const role = user.roles?.includes('admin') || user.roles?.includes('super_admin') ? 'a' : 'p';
        localStorage.setItem('panel_refresh_token', refreshToken || '');
        login({ ...user, role }, accessToken);
        setSuccess(true);
        setTimeout(() => navigate('/dashboard/users', { replace: true }), 1000);
    };

    const inputCls = hasErr => `w-full h-11 px-4 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${hasErr ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10'}`;

    return (
        <div className='min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10'>
            <div className='w-full max-w-md bg-white rounded-2xl px-8 py-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_rgba(0,0,0,0.09)]'>

                {/* Header */}
                <div className='text-center mb-6'>
                    <div className='w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white shadow-md'>
                        {otpStep ? (
                            <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-7 h-7'>
                                <rect x='5' y='11' width='14' height='10' rx='2'/><path d='M8 11V7a4 4 0 0 1 8 0v4'/>
                            </svg>
                        ) : (
                            <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-7 h-7'>
                                <path d='M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z'/>
                            </svg>
                        )}
                    </div>
                    <h2 className='text-xl font-bold text-slate-900'>
                        {otpStep ? 'Verify Your Account' : 'Become a Promoter'}
                    </h2>
                    <p className='text-slate-500 text-xs mt-1'>
                        {otpStep ? 'Enter the OTP sent to confirm your identity' : 'Create your promoter account'}
                    </p>
                </div>

                {success && (
                    <div className='text-center py-6 space-y-2'>
                        <div className='w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2'>
                            <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-6 h-6 text-emerald-600'>
                                <polyline points='20 6 9 17 4 12'/>
                            </svg>
                        </div>
                        <p className='text-emerald-600 font-bold text-lg'>Account created!</p>
                        <p className='text-xs text-slate-500'>Taking you to the dashboard…</p>
                    </div>
                )}

                {/* OTP verification step */}
                {!success && otpStep && (
                    <OtpStep
                        mobile={otpMobile}
                        email={otpEmail}
                        otpPreview={otpHint}
                        onVerified={handleOtpVerified}
                    />
                )}

                {/* Registration form */}
                {!success && !otpStep && (
                    <div className='space-y-4'>
                        <div className='grid grid-cols-2 gap-3'>
                            {['firstName','lastName'].map(f => (
                                <div key={f} className='space-y-1.5'>
                                    <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{f === 'firstName' ? 'First Name' : 'Last Name'}</label>
                                    <input type='text' value={form[f]} onChange={e => change(f, e.target.value)} onBlur={() => blur(f)}
                                        placeholder={f === 'firstName' ? 'Raj' : 'Verma'}
                                        className={inputCls(touched[f] && errors[f])} />
                                    {touched[f] && errors[f] && <p className='text-[10px] text-red-500'>{errors[f]}</p>}
                                </div>
                            ))}
                        </div>

                        <div className='space-y-1.5'>
                            <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Email</label>
                            <input type='email' value={form.email} onChange={e => change('email', e.target.value)} onBlur={() => blur('email')}
                                placeholder='raj@example.com' className={inputCls(touched.email && errors.email)} />
                            {touched.email && errors.email && <p className='text-[10px] text-red-500'>{errors.email}</p>}
                        </div>

                        <div className='space-y-1.5'>
                            <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Phone</label>
                            <div className='flex gap-2'>
                                <div className='relative' ref={pickerRef}>
                                    <button type='button' onClick={() => setShowPicker(p => !p)}
                                        className='h-11 px-3 flex items-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl bg-slate-50 hover:border-emerald-400 transition-all text-sm whitespace-nowrap'>
                                        <span>{country.flag}</span>
                                        <span className='font-medium text-slate-700'>+{country.dial}</span>
                                        <svg viewBox='0 0 16 16' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3 h-3 text-slate-400'><path d='M4 6l4 4 4-4'/></svg>
                                    </button>
                                    {showPicker && (
                                        <ul className='absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-y-auto max-h-52 py-1'>
                                            {COUNTRIES.map(c => (
                                                <li key={c.code} onClick={() => { setCountry(c); setShowPicker(false); if (touched.phone) setErrors(p => ({ ...p, phone: validate('phone', form.phone, c) })); }}
                                                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${c.code === country.code ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700'}`}>
                                                    <span>{c.flag}</span><span className='flex-1 truncate'>{c.name}</span>
                                                    <span className='text-xs text-slate-400'>+{c.dial}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <input type='tel' value={form.phone} onChange={e => change('phone', e.target.value)} onBlur={() => blur('phone')}
                                    placeholder={`${country.len} digits`} className={`flex-1 ${inputCls(touched.phone && errors.phone)}`} />
                            </div>
                            {touched.phone && errors.phone && <p className='text-[10px] text-red-500'>{errors.phone}</p>}
                        </div>

                        {/* Password fields */}
                        {[['New Password', password, setPassword], ['Confirm Password', confirmPwd, setConfirmPwd]].map(([label, val, setter], idx) => (
                            <div key={label} className='space-y-1.5'>
                                <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</label>
                                <div className='relative'>
                                    <input type={showPwd?'text':'password'} value={val} placeholder={idx===0?'Min 10 chars, A-Z, a-z, symbol':'Repeat password'}
                                        onChange={e => { setter(e.target.value); setPwdError(''); }}
                                        className={`w-full h-10 px-3.5 pr-11 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${pwdError&&idx===1?'border-red-300 focus:ring-red-100':'border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10'}`} />
                                    {idx===0 && <button type='button' onClick={()=>setShowPwd(v=>!v)} className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500 text-sm'>{showPwd?'🙈':'👁'}</button>}
                                </div>
                            </div>
                        ))}
                        {pwdError && <p className='text-[10px] text-red-500'>{pwdError}</p>}

                        {apiError && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5'>{apiError}</div>}

                        <button onClick={handleSubmit} disabled={loading}
                            className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-60 flex items-center justify-center mt-1'>
                            {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Create Account'}
                        </button>
                    </div>
                )}

                {!otpStep && !success && (
                    <div className='mt-5 pt-4 border-t border-slate-100 text-center'>
                        <p className='text-xs text-slate-400'>
                            Already have an account?{' '}
                            <Link to='/promoter-login' className='text-emerald-600 font-medium hover:underline'>Login here</Link>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
