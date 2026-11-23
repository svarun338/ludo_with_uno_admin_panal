import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { promoterResetPassword } from '../../api';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [password,    setPassword]    = useState('');
    const [confirmPwd,  setConfirmPwd]  = useState('');
    const [showPwd,     setShowPwd]     = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState('');
    const [done,        setDone]        = useState(false);

    const inputCls = err => `w-full h-11 px-4 pr-12 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${err ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/10'}`;

    const submit = async e => {
        e.preventDefault();
        setError('');
        if (!password || password.length < 6) return setError('Password must be at least 6 characters');
        if (password !== confirmPwd) return setError('Passwords do not match');
        if (!token) return setError('Invalid reset link — please request a new one');

        setLoading(true);
        try {
            await promoterResetPassword(token, password, confirmPwd);
            setDone(true);
            setTimeout(() => navigate('/promoter-login', { replace: true }), 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password');
        } finally { setLoading(false); }
    };

    return (
        <div className='min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10'>
            <div className='w-full max-w-sm bg-white rounded-2xl px-8 py-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_rgba(0,0,0,0.09)]'>
                {done ? (
                    <div className='text-center space-y-4'>
                        <div className='w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600'>
                            <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-7 h-7'><polyline points='20 6 9 17 4 12'/></svg>
                        </div>
                        <h2 className='text-xl font-bold text-slate-900'>Password Reset!</h2>
                        <p className='text-sm text-slate-500'>Your password has been updated. Redirecting to login…</p>
                    </div>
                ) : (
                    <>
                        <div className='text-center mb-6'>
                            <h2 className='text-xl font-bold text-slate-900'>Reset Password</h2>
                            <p className='text-slate-500 text-sm mt-1'>Enter your new password below</p>
                        </div>

                        {!token && (
                            <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4 text-center'>
                                Invalid reset link.{' '}
                                <Link to='/promoter-login/forgot' className='underline font-medium'>Request a new one</Link>
                            </div>
                        )}

                        <form onSubmit={submit} className='space-y-4'>
                            {['New Password', 'Confirm Password'].map((label, idx) => (
                                <div key={label} className='space-y-1.5'>
                                    <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</label>
                                    <div className='relative'>
                                        <input
                                            type={showPwd ? 'text' : 'password'}
                                            value={idx === 0 ? password : confirmPwd}
                                            onChange={e => { (idx === 0 ? setPassword : setConfirmPwd)(e.target.value); setError(''); }}
                                            placeholder={idx === 0 ? 'Min 6 characters' : 'Repeat password'}
                                            className={inputCls(error && idx === 1)}
                                        />
                                        {idx === 0 && (
                                            <button type='button' onClick={() => setShowPwd(v => !v)}
                                                className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500 transition-colors text-sm'>
                                                {showPwd ? '🙈' : '👁'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {error && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5'>{error}</div>}

                            <button type='submit' disabled={loading || !token}
                                className='w-full h-11 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center'>
                                {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Reset Password'}
                            </button>
                            <div className='text-center'>
                                <Link to='/promoter-login' className='text-xs text-slate-400 hover:text-slate-600'>← Back to Login</Link>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
