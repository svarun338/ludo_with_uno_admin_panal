import { useState } from 'react';
import { Link } from 'react-router-dom';
import { promoterForgotPassword } from '../../api';

const inputCls = 'w-full h-11 px-4 border-[1.5px] border-slate-200 rounded-xl text-sm outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 bg-slate-50 text-slate-900';
const errBox   = 'bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5';

/* steps: 'input' → 'sent' */
export default function ForgotPassword() {
    const [step,       setStep]       = useState('input');
    const [identifier, setIdentifier] = useState('');
    const [devToken,   setDevToken]   = useState('');
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState('');

    const submit = async () => {
        if (!identifier.trim()) return setError('Enter your email or phone number');
        setLoading(true); setError('');
        try {
            const res = await promoterForgotPassword(identifier.trim());
            setDevToken(res.data?.data?.resetTokenPreview || '');
            setStep('sent');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send reset link');
        } finally { setLoading(false); }
    };

    const card = children => (
        <div className='min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10'>
            <div className='w-full max-w-sm bg-white rounded-2xl px-8 py-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_rgba(0,0,0,0.09)]'>
                {children}
            </div>
        </div>
    );

    /* ── Step 1: enter identifier ── */
    if (step === 'input') return card(
        <>
            <div className='text-center mb-6'>
                <h2 className='text-xl font-bold text-slate-900'>Forgot Password?</h2>
                <p className='text-slate-500 text-sm mt-1'>Enter your email or phone number and we'll send you a reset link</p>
            </div>
            <div className='space-y-4'>
                <div className='space-y-1.5'>
                    <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Email or Phone</label>
                    <input
                        type='text' value={identifier} autoFocus
                        onChange={e => { setIdentifier(e.target.value); setError(''); }}
                        placeholder='you@email.com or +919876543210'
                        className={inputCls}
                    />
                </div>
                {error && <div className={errBox}>{error}</div>}
                <button onClick={submit} disabled={loading}
                    className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center'>
                    {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Send Reset Link'}
                </button>
                <div className='text-center'>
                    <Link to='/promoter-login' className='text-xs text-slate-400 hover:text-slate-600 transition-colors'>← Back to Login</Link>
                </div>
            </div>
        </>
    );

    /* ── Sent confirmation ── */
    return card(
        <div className='text-center space-y-4'>
            <div className='w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600'>
                <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-7 h-7'><path d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'/><polyline points='22,6 12,13 2,6'/></svg>
            </div>
            <h2 className='text-xl font-bold text-slate-900'>Reset Link Sent!</h2>
            <p className='text-sm text-slate-500'>Check your email or SMS for the password reset link.</p>
            {devToken && (
                <div className='flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl px-3 py-2 text-left'>
                    <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' className='w-4 h-4 shrink-0 mt-0.5'><circle cx='8' cy='8' r='6'/><path d='M8 5v3.5M8 11v.5'/></svg>
                    <div><span className='font-semibold'>Dev token: </span><span className='break-all font-mono'>{devToken}</span></div>
                </div>
            )}
            <Link to='/promoter-login' className='block text-emerald-600 text-sm font-medium hover:underline'>← Back to Login</Link>
        </div>
    );
}
