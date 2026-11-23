import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { promoterSendOtp, promoterResendOtp, promoterVerifyOtp, promoterLoginEmail, promoterLoginPhone, promoterForgotPassword, verifySignupOtp, resendVerificationOtp } from '../../api';
import { usePanelAuth } from '../../context/AuthContext';

const COUNTRIES = [
    { code: 'IN', dial: '91',  flag: '🇮🇳', name: 'India',     len: 10 },
    { code: 'US', dial: '1',   flag: '🇺🇸', name: 'USA',        len: 10 },
    { code: 'GB', dial: '44',  flag: '🇬🇧', name: 'UK',          len: 10 },
    { code: 'AE', dial: '971', flag: '🇦🇪', name: 'UAE',         len: 9  },
    { code: 'AU', dial: '61',  flag: '🇦🇺', name: 'Australia',  len: 9  },
    { code: 'CA', dial: '1',   flag: '🇨🇦', name: 'Canada',      len: 10 },
    { code: 'SG', dial: '65',  flag: '🇸🇬', name: 'Singapore',  len: 8  },
];

const MegaphoneIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-7 h-7'>
        <path d='M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z'/>
    </svg>
);

/* ── OTP boxes ── */
const OtpBoxes = ({ value, onChange, resetKey }) => {
    const refs  = useRef([]);
    const count = 6;

    const handleInput = (i, e) => {
        const v   = e.target.value.replace(/\D/g, '').slice(-1);
        const arr = Array.from({ length: count }, (_, idx) => (value || '')[idx] || '');
        arr[i] = v;
        onChange(arr.join(''));
        if (v && i < count - 1) refs.current[i + 1]?.focus();
    };

    const handleKeyDown = (i, e) => {
        const arr = Array.from({ length: count }, (_, idx) => (value || '')[idx] || '');
        if (e.key === 'Backspace') {
            if (!arr[i] && i > 0) { refs.current[i - 1]?.focus(); return; }
            arr[i] = ''; onChange(arr.join(''));
        }
        if (e.key === 'ArrowLeft'  && i > 0)          refs.current[i - 1]?.focus();
        if (e.key === 'ArrowRight' && i < count - 1)  refs.current[i + 1]?.focus();
    };

    const handlePaste = e => {
        const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, count);
        onChange(p);
        refs.current[Math.min(p.length, count - 1)]?.focus();
        e.preventDefault();
    };

    return (
        <div className='flex gap-2 justify-center'>
            {Array.from({ length: count }, (_, i) => (
                <input key={`${resetKey}-${i}`}
                    ref={el => refs.current[i] = el}
                    type='text' inputMode='numeric' maxLength={1}
                    value={(value || '')[i] || ''}
                    onChange={e => handleInput(i, e)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    autoFocus={i === 0}
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    className={`w-11 h-12 text-center text-lg font-bold border-[1.5px] rounded-xl outline-none transition-all
                        ${(value || '')[i] ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-800'}
                        focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10`}
                />
            ))}
        </div>
    );
};

export default function PromoterLogin() {
    const { login } = usePanelAuth();
    const navigate  = useNavigate();

    /* Login method: 'otp' | 'email-pass' | 'phone-pass' */
    const [method,   setMethod]   = useState('otp');

    const [step,     setStep]     = useState('phone');
    const [country,  setCountry]  = useState(COUNTRIES[0]);
    const [phone,    setPhone]    = useState('');
    const [otp,      setOtp]      = useState('');
    const [otpKey,   setOtpKey]   = useState(0);
    const [devOtp,   setDevOtp]   = useState('');
    const [phoneErr, setPhoneErr] = useState('');
    const [apiError, setApiError] = useState('');
    const [loading,  setLoading]  = useState(false);
    const [timer,    setTimer]    = useState(0);
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);

    /* Password login state */
    const [pwdEmail,   setPwdEmail]   = useState('');
    const [pwdPhone,   setPwdPhone]   = useState('');
    const [password,   setPassword]   = useState('');
    const [showPwd,    setShowPwd]    = useState(false);
    /* Forgot password — link-based: 'off' | 'input' | 'sent' */
    const [forgotStep,        setForgotStep]        = useState('off');
    const [forgotIdentifier,  setForgotIdentifier]  = useState('');
    const [forgotDevToken,    setForgotDevToken]    = useState('');

    /* Pending-verification OTP step (triggered when login returns pendingVerification) */
    const [verifyStep,   setVerifyStep]   = useState(false);
    const [verifyMobile, setVerifyMobile] = useState('');
    const [verifyEmail,  setVerifyEmail]  = useState('');
    const [verifyHint,   setVerifyHint]   = useState('');
    const [verifyOtp,    setVerifyOtp]    = useState('');
    const [verifyErr,    setVerifyErr]    = useState('');
    const [verifyLoading,setVerifyLoading]= useState(false);
    const [resendCooldown,setResendCooldown] = useState(0);
    const resendTimerRef = useRef(null);

    const localPhone = phone.replace(/\D/g, '');   // e.g. "7676756767"
    const dialCode   = country.dial;               // e.g. "91"
    const fullPhone  = `${dialCode}${localPhone}`; // used only for display

    useEffect(() => {
        if (timer <= 0) return;
        const t = setTimeout(() => setTimer(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [timer]);

    useEffect(() => {
        if (!showPicker) return;
        const close = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [showPicker]);

    const validatePhone = () => {
        const n = phone.replace(/\D/g, '');
        if (!n) return 'Phone number is required';
        if (country.len && n.length !== country.len) return `${country.name} numbers must be ${country.len} digits`;
        return '';
    };

    const sendOtp = async () => {
        const err = validatePhone();
        if (err) return setPhoneErr(err);
        setLoading(true); setApiError('');
        try {
            const res = await promoterSendOtp(localPhone, dialCode);
            /* New backend returns otpPreview in dev mode */
            setDevOtp(res.data.data?.otpPreview || res.data.data?.otp || '');
            setStep('otp'); setOtp(''); setTimer(60);
        } catch (e) {
            setApiError(e.response?.data?.message || 'Failed to send OTP.');
        } finally { setLoading(false); }
    };

    const resend = async () => {
        setLoading(true); setApiError('');
        try {
            const res = await promoterResendOtp(localPhone, dialCode);
            setDevOtp(res.data.data?.otpPreview || res.data.data?.otp || '');
            setOtp(''); setOtpKey(k => k + 1); setTimer(60);
        } catch (e) {
            setApiError(e.response?.data?.message || 'Failed to resend OTP.');
        } finally { setLoading(false); }
    };

    const verify = async () => {
        if (otp.length < 6) return setApiError('Enter the 6-digit OTP.');
        setLoading(true); setApiError('');
        try {
            const res  = await promoterVerifyOtp(localPhone, otp, dialCode);
            const { user, accessToken, refreshToken } = res.data.data;
            const role = user.roles?.includes('admin') || user.roles?.includes('super_admin') ? 'a' : 'p';
            localStorage.setItem('panel_refresh_token', refreshToken || '');
            login({ ...user, role }, accessToken);
            navigate('/dashboard/users', { replace: true });
        } catch (e) {
            setApiError(e.response?.data?.message || 'Verification failed.');
            setOtp(''); setOtpKey(k => k + 1);
        } finally { setLoading(false); }
    };

    /* Password login */
    const handlePasswordLogin = async () => {
        if (!password) return setApiError('Password is required');
        setLoading(true); setApiError('');
        try {
            let res;
            if (method === 'email-pass') {
                if (!pwdEmail.trim()) return setApiError('Email is required');
                res = await promoterLoginEmail(pwdEmail.trim(), password);
            } else {
                if (!pwdPhone.trim()) return setApiError('Phone is required');
                res = await promoterLoginPhone(pwdPhone.replace(/\D/g,''), dialCode, password);
            }
            const { user, accessToken, refreshToken } = res.data.data;
            const role = user.roles?.includes('admin') || user.roles?.includes('super_admin') ? 'a' : 'p';
            localStorage.setItem('panel_refresh_token', refreshToken || '');
            login({ ...user, role }, accessToken);
            navigate('/dashboard/users', { replace: true });
        } catch (e) {
            const errData = e.response?.data;
            if (errData?.data?.pendingVerification) {
                setVerifyMobile(errData.data.mobile || '');
                setVerifyEmail(errData.data.email || pwdEmail.trim() || '');
                setVerifyHint(errData.data.otpPreview || '');
                setVerifyOtp('');
                setVerifyErr('');
                setResendCooldown(60);
                clearInterval(resendTimerRef.current);
                resendTimerRef.current = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
                setVerifyStep(true);
            } else {
                setApiError(errData?.message || 'Login failed.');
            }
        } finally { setLoading(false); }
    };

    const handleVerifySignupOtp = async () => {
        if (verifyOtp.length !== 6) { setVerifyErr('Enter the 6-digit OTP'); return; }
        setVerifyLoading(true); setVerifyErr('');
        try {
            const res = await verifySignupOtp({ mobile: verifyMobile, email: verifyEmail, otp: verifyOtp });
            const { user, accessToken, refreshToken } = res.data.data;
            const role = user.roles?.includes('admin') || user.roles?.includes('super_admin') ? 'a' : 'p';
            localStorage.setItem('panel_refresh_token', refreshToken || '');
            login({ ...user, role }, accessToken);
            navigate('/dashboard/users', { replace: true });
        } catch (e) {
            setVerifyErr(e.response?.data?.message || 'Invalid or expired OTP. Please try again.');
        } finally { setVerifyLoading(false); }
    };

    const handleResendVerifyOtp = async () => {
        if (resendCooldown > 0) return;
        setVerifyLoading(true); setVerifyErr('');
        try {
            const res = await resendVerificationOtp({ mobile: verifyMobile, email: verifyEmail });
            const preview = res.data.data?.otpPreview;
            if (preview) setVerifyHint(preview);
            setResendCooldown(60);
            clearInterval(resendTimerRef.current);
            resendTimerRef.current = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
        } catch (e) {
            setVerifyErr(e.response?.data?.message || 'Could not resend OTP.');
        } finally { setVerifyLoading(false); }
    };

    /* Forgot password — link-based reset */
    const handleForgotSubmit = async () => {
        if (!forgotIdentifier.trim()) return setApiError('Enter your email or phone number');
        setLoading(true); setApiError('');
        try {
            const res = await promoterForgotPassword(forgotIdentifier.trim());
            setForgotDevToken(res.data?.data?.resetTokenPreview || '');
            setForgotStep('sent');
        } catch (e) {
            setApiError(e.response?.data?.message || 'Failed to send reset link');
        } finally { setLoading(false); }
    };

    const resetForgotFlow = () => {
        setForgotStep('off'); setForgotIdentifier(''); setForgotDevToken(''); setApiError('');
    };

    const inputCls = 'w-full h-11 px-4 border-[1.5px] border-slate-200 rounded-xl text-sm outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 bg-slate-50 text-slate-900';

    return (
        <div className='min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10'>
            <div className='w-full max-w-sm'>
                <div className='bg-white rounded-2xl px-8 py-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_rgba(0,0,0,0.09)]'>

                    {/* Header */}
                    <div className='text-center mb-6'>
                        <div className='w-14 h-14 bg-linear-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white shadow-md'>
                            <MegaphoneIcon />
                        </div>
                        <h2 className='text-xl font-bold text-slate-900'>
                            {verifyStep ? 'Verify Account' : step === 'phone' ? 'Promoter Login' : 'Verify OTP'}
                        </h2>
                        <p className='text-slate-500 text-xs mt-1'>
                            {verifyStep
                                ? 'Complete verification to access your account'
                                : step === 'phone'
                                ? 'Enter your registered phone number'
                                : `Code sent to +${country.dial} ${phone}`}
                        </p>
                    </div>

                    {/* ── Method Tabs ── */}
                    {forgotStep === 'off' && !verifyStep && (
                        <div className='flex gap-1 mb-5 bg-slate-100 rounded-xl p-1'>
                            {[
                                { key:'otp',        label:'OTP'         },
                                { key:'email-pass', label:'Email'       },
                                { key:'phone-pass', label:'Phone+Pass'  },
                            ].map(m => (
                                <button key={m.key} type='button'
                                    onClick={() => { setMethod(m.key); setApiError(''); setStep('phone'); setOtp(''); }}
                                    className={`flex-1 h-8 rounded-lg text-[11px] font-bold transition-all ${method===m.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Forgot Password (link-based) ── */}
                    {forgotStep !== 'off' && !verifyStep && (
                        <div className='space-y-4'>

                            {/* Step 1: enter email or phone */}
                            {forgotStep === 'input' && (<>
                                <p className='text-xs text-slate-500'>Enter your email or phone number and we'll send you a reset link.</p>
                                <input type='text' placeholder='Email or phone number' value={forgotIdentifier} autoFocus
                                    onChange={e => { setForgotIdentifier(e.target.value); setApiError(''); }}
                                    className={inputCls} />
                                {apiError && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5'>{apiError}</div>}
                                <button onClick={handleForgotSubmit} disabled={loading}
                                    className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center'>
                                    {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Send Reset Link'}
                                </button>
                                <button onClick={resetForgotFlow} className='w-full text-xs text-slate-400 hover:text-slate-600'>← Back to Login</button>
                            </>)}

                            {/* Confirmation */}
                            {forgotStep === 'sent' && (
                                <div className='text-center py-4 space-y-2'>
                                    <p className='text-emerald-600 font-semibold text-sm'>Reset link sent!</p>
                                    <p className='text-xs text-slate-500'>Check your email or SMS for the password reset link.</p>
                                    {forgotDevToken && (
                                        <div className='flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl px-3 py-2 text-left'>
                                            <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' className='w-4 h-4 shrink-0'><circle cx='8' cy='8' r='6'/><path d='M8 5v3.5M8 11v.5'/></svg>
                                            Dev token: <strong className='break-all'>{forgotDevToken}</strong>
                                        </div>
                                    )}
                                    <button onClick={resetForgotFlow} className='mt-2 text-xs text-emerald-600 hover:underline'>← Back to Login</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Email + Password ── */}
                    {forgotStep === 'off' && !verifyStep && method === 'email-pass' && (
                        <div className='space-y-4'>
                            <input type='email' placeholder='Email Address' value={pwdEmail} autoFocus
                                onChange={e => { setPwdEmail(e.target.value); setApiError(''); }}
                                className={inputCls} />
                            <div className='relative'>
                                <input type={showPwd?'text':'password'} placeholder='Password' value={password}
                                    onChange={e => { setPassword(e.target.value); setApiError(''); }}
                                    className={`${inputCls} pr-12`} />
                                <button type='button' onClick={() => setShowPwd(v=>!v)}
                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500 transition-colors text-sm'>
                                    {showPwd ? '🙈' : '👁'}
                                </button>
                            </div>
                            {apiError && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5'>{apiError}</div>}
                            <button onClick={handlePasswordLogin} disabled={loading}
                                className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center'>
                                {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Login'}
                            </button>
                            <p className='text-center text-xs text-slate-400'>
                                <button onClick={() => { setForgotStep('input'); setForgotIdentifier(pwdEmail); setApiError(''); }}
                                    className='text-emerald-600 hover:underline'>Forgot Password?</button>
                            </p>
                        </div>
                    )}

                    {/* ── Phone + Password ── */}
                    {forgotStep === 'off' && !verifyStep && method === 'phone-pass' && (
                        <div className='space-y-4'>
                            <div className='flex gap-2'>
                                <div className='relative' ref={pickerRef}>
                                    <button type='button' onClick={() => setShowPicker(p=>!p)}
                                        className='h-11 px-3 flex items-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl bg-slate-50 hover:border-emerald-400 transition-all text-sm whitespace-nowrap'>
                                        <span>{country.flag}</span>
                                        <span className='font-medium text-slate-700'>+{country.dial}</span>
                                        <svg viewBox='0 0 16 16' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3 h-3 text-slate-400'><path d='M4 6l4 4 4-4'/></svg>
                                    </button>
                                    {showPicker && (
                                        <ul className='absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-y-auto max-h-56 py-1'>
                                            {COUNTRIES.map(c => (
                                                <li key={c.code} onClick={() => { setCountry(c); setShowPicker(false); }}
                                                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 ${c.code===country.code?'bg-emerald-50 text-emerald-700 font-semibold':'text-slate-700'}`}>
                                                    <span>{c.flag}</span><span className='flex-1 truncate'>{c.name}</span>
                                                    <span className='text-xs text-slate-400'>+{c.dial}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <input type='tel' placeholder={`${country.len||10} digits`} value={pwdPhone} autoFocus
                                    onChange={e => { setPwdPhone(e.target.value.replace(/\D/g,'').slice(0,15)); setApiError(''); }}
                                    className={`flex-1 ${inputCls}`} />
                            </div>
                            <div className='relative'>
                                <input type={showPwd?'text':'password'} placeholder='Password' value={password}
                                    onChange={e => { setPassword(e.target.value); setApiError(''); }}
                                    className={`${inputCls} pr-12`} />
                                <button type='button' onClick={() => setShowPwd(v=>!v)}
                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500 transition-colors text-sm'>
                                    {showPwd ? '🙈' : '👁'}
                                </button>
                            </div>
                            {apiError && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5'>{apiError}</div>}
                            <button onClick={handlePasswordLogin} disabled={loading}
                                className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center'>
                                {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Login'}
                            </button>
                        </div>
                    )}

                    {/* OTP Phone step */}
                    {forgotStep === 'off' && !verifyStep && method === 'otp' && step === 'phone' && (
                        <div className='space-y-4'>
                            <div className='space-y-1.5'>
                                <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Phone Number</label>
                                <div className='flex gap-2'>
                                    {/* Country picker */}
                                    <div className='relative' ref={pickerRef}>
                                        <button type='button' onClick={() => setShowPicker(p => !p)}
                                            className='h-11 px-3 flex items-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl bg-slate-50 hover:border-emerald-400 transition-all text-sm whitespace-nowrap'>
                                            <span>{country.flag}</span>
                                            <span className='font-medium text-slate-700'>+{country.dial}</span>
                                            <svg viewBox='0 0 16 16' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3 h-3 text-slate-400'><path d='M4 6l4 4 4-4'/></svg>
                                        </button>
                                        {showPicker && (
                                            <ul className='absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-y-auto max-h-56 py-1'>
                                                {COUNTRIES.map(c => (
                                                    <li key={c.code} onClick={() => { setCountry(c); setShowPicker(false); }}
                                                        className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 transition-colors ${c.code === country.code ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-700'}`}>
                                                        <span>{c.flag}</span><span className='flex-1 truncate'>{c.name}</span>
                                                        <span className='text-slate-400 text-xs'>+{c.dial}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <input type='tel' placeholder={`${country.len} digits`} value={phone}
                                        onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 15)); setPhoneErr(''); setApiError(''); }}
                                        className={`flex-1 ${inputCls} ${phoneErr ? 'border-red-300' : ''}`}
                                    />
                                </div>
                                {phoneErr && <p className='text-[11px] text-red-500'>{phoneErr}</p>}
                            </div>

                            {apiError && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5'>{apiError}</div>}

                            <button onClick={sendOtp} disabled={loading}
                                className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-60 flex items-center justify-center'>
                                {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Send OTP'}
                            </button>
                        </div>
                    )}

                    {/* OTP verify step */}
                    {forgotStep === 'off' && !verifyStep && method === 'otp' && step === 'otp' && (
                        <div className='space-y-5'>
                            <OtpBoxes key={otpKey} value={otp} onChange={v => { setOtp(v); if (apiError) setApiError(''); }} resetKey={otpKey} />

                            {devOtp && (
                                <div className='flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg justify-center'>
                                    <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' className='w-3.5 h-3.5 shrink-0'><circle cx='8' cy='8' r='6'/><path d='M8 5v3.5M8 11v.5'/></svg>
                                    Dev OTP: <strong>{devOtp}</strong>
                                </div>
                            )}

                            {apiError && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 text-center'>{apiError}</div>}

                            <button onClick={verify} disabled={loading || otp.length < 6}
                                className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-60 flex items-center justify-center'>
                                {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Verify & Login'}
                            </button>

                            <p className='text-center text-xs text-slate-500'>
                                Didn't receive it?{' '}
                                <button onClick={resend} disabled={timer > 0 || loading}
                                    className={`font-semibold ${timer > 0 ? 'text-slate-400' : 'text-emerald-600 hover:underline'}`}>
                                    {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                                </button>
                            </p>

                            <button onClick={() => { setStep('phone'); setOtp(''); setApiError(''); }} className='w-full text-xs text-slate-400 hover:text-slate-600 transition-colors'>
                                ← Change phone number
                            </button>
                        </div>
                    )}

                    {/* ── Pending-verification OTP step ── */}
                    {verifyStep && (
                        <div className='space-y-5'>
                            <div className='text-center space-y-1'>
                                <p className='text-sm text-slate-600 font-medium'>Account not yet verified</p>
                                <p className='text-xs text-slate-500'>We sent a 6-digit OTP to confirm your identity</p>
                                {verifyHint && (
                                    <p className='text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 font-mono tracking-widest'>
                                        Dev preview: {verifyHint}
                                    </p>
                                )}
                            </div>
                            <OtpBoxes key='verify' value={verifyOtp} onChange={v => { setVerifyOtp(v); setVerifyErr(''); }} resetKey='verify' />
                            {verifyErr && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 text-center'>{verifyErr}</div>}
                            <button onClick={handleVerifySignupOtp} disabled={verifyLoading || verifyOtp.length < 6}
                                className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-60 flex items-center justify-center'>
                                {verifyLoading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Verify & Login'}
                            </button>
                            <p className='text-center text-xs text-slate-500'>
                                Didn&apos;t receive it?{' '}
                                {resendCooldown > 0 ? (
                                    <span className='text-slate-400'>Resend in {resendCooldown}s</span>
                                ) : (
                                    <button type='button' onClick={handleResendVerifyOtp} disabled={verifyLoading}
                                        className='text-emerald-600 font-medium hover:underline disabled:opacity-50'>
                                        Resend OTP
                                    </button>
                                )}
                            </p>
                            <button onClick={() => { setVerifyStep(false); setVerifyOtp(''); setVerifyErr(''); clearInterval(resendTimerRef.current); }}
                                className='w-full text-xs text-slate-400 hover:text-slate-600 transition-colors'>
                                ← Back to Login
                            </button>
                        </div>
                    )}

                    {!verifyStep && (
                    <div className='mt-5 pt-4 border-t border-slate-100 text-center space-y-2'>
                        <p className='text-xs text-slate-400'>
                            New promoter?{' '}
                            <Link to='/promoter-signup' className='text-emerald-600 font-medium hover:underline'>Sign up here</Link>
                        </p>
                        <p className='text-xs text-slate-400'>
                            <Link to='/login' className='text-slate-500 hover:text-slate-700'>← Back to login options</Link>
                        </p>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
}
