import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminLogin }        from '../../api';
import { usePanelAuth }      from '../../context/AuthContext';

/* ── Icons ── */
const ShieldIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' stroke='currentColor' className='w-7 h-7'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'/>
    </svg>
);
const MegaphoneIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-7 h-7'>
        <path d='M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z'/>
    </svg>
);
const EyeOpen = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/>
    </svg>
);
const EyeOff = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/>
        <line x1='1' y1='1' x2='23' y2='23'/>
    </svg>
);

/* ── Admin login form ── */
function AdminLoginForm() {
    const { login } = usePanelAuth();
    const navigate  = useNavigate();

    const [email,    setEmail]    = useState('admin@gmail.com');
    const [password, setPassword] = useState('');
    const [showPwd,  setShowPwd]  = useState(false);
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);

    const submit = async e => {
        e.preventDefault();
        setError('');
        if (!email.trim() || !password) return setError('Email and password are required.');
        setLoading(true);
        try {
            const res  = await adminLogin(email.trim().toLowerCase(), password);
            const { user, accessToken, refreshToken } = res.data.data;
            /* Derive role string from the roles array returned by the new backend */
            const role = user.roles?.includes('admin') || user.roles?.includes('super_admin') ? 'a' : 'p';
            localStorage.setItem('panel_refresh_token', refreshToken || '');
            login({ ...user, role }, accessToken);
            navigate('/dashboard/users', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={submit} className='space-y-4' noValidate>
            <div className='space-y-1.5'>
                <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Email</label>
                <input type='email' value={email} onChange={e => setEmail(e.target.value)} autoComplete='email' autoFocus
                    className='w-full h-11 px-4 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-900 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10'
                />
            </div>
            <div className='space-y-1.5'>
                <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Password</label>
                <div className='relative'>
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete='current-password'
                        className='w-full h-11 px-4 pr-11 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-900 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10'
                    />
                    <button type='button' tabIndex={-1} onClick={() => setShowPwd(v => !v)}
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors'>
                        {showPwd ? <EyeOpen /> : <EyeOff />}
                    </button>
                </div>
            </div>
            {error && <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5'>{error}</div>}
            <button type='submit' disabled={loading}
                className='w-full h-11 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center mt-1'>
                {loading ? <span className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' /> : 'Sign In as Admin'}
            </button>
        </form>
    );
}

/* ── Main login page ── */
export default function Login() {
    const [mode, setMode] = useState('select'); // 'select' | 'admin'

    return (
        <div className='min-h-screen flex bg-slate-50'>

            {/* ── Left decorative ── */}
            <div className='hidden md:flex flex-col justify-center relative overflow-hidden p-14 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900' style={{ width: '44%' }}>
                <div className='absolute -top-20 -right-20 w-80 h-80 rounded-full border border-indigo-500/20 pointer-events-none' />
                <div className='absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-indigo-500/5 pointer-events-none' />
                <div className='relative z-10'>
                    <div className='w-16 h-16 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl flex items-center justify-center mb-6 text-indigo-300'>
                        <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' stroke='currentColor' className='w-9 h-9'>
                            <path strokeLinecap='round' strokeLinejoin='round' d='M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'/>
                        </svg>
                    </div>
                    <h1 className='text-4xl font-bold text-white mb-2'>Ludo Arena</h1>
                    <p className='text-slate-400 mb-10'>Management Panel</p>
                    <div className='space-y-4'>
                        {['Full player management', 'Promoter & referral system', 'Role-based access control', 'Real-time statistics'].map(f => (
                            <div key={f} className='flex items-center gap-3 text-slate-300 text-sm'>
                                <span className='w-2 h-2 rounded-full bg-indigo-500 shrink-0' />{f}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right ── */}
            <div className='flex-1 flex items-center justify-center px-6 py-10'>
                <div className='w-full max-w-sm'>

                    {/* ── ROLE SELECTION ── */}
                    {mode === 'select' && (
                        <div className='space-y-6'>
                            <div className='text-center'>
                                <h2 className='text-2xl font-bold text-slate-900'>Welcome Back</h2>
                                <p className='text-slate-500 text-sm mt-1'>Choose your login type</p>
                            </div>

                            <div className='space-y-3'>
                                {/* Admin card */}
                                <button onClick={() => setMode('admin')}
                                    className='w-full flex items-center gap-4 p-5 bg-white border-2 border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all group text-left'>
                                    <div className='w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors shrink-0'>
                                        <ShieldIcon />
                                    </div>
                                    <div>
                                        <p className='font-bold text-slate-800'>Admin Login</p>
                                        <p className='text-xs text-slate-500 mt-0.5'>Email & password access</p>
                                    </div>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5 text-slate-300 group-hover:text-indigo-500 ml-auto transition-colors'>
                                        <polyline points='9 18 15 12 9 6'/>
                                    </svg>
                                </button>

                                {/* Promoter card */}
                                <Link to='/promoter-login'
                                    className='w-full flex items-center gap-4 p-5 bg-white border-2 border-slate-200 rounded-2xl hover:border-emerald-400 hover:shadow-md transition-all group text-left'>
                                    <div className='w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors shrink-0'>
                                        <MegaphoneIcon />
                                    </div>
                                    <div>
                                        <p className='font-bold text-slate-800'>Promoter Login</p>
                                        <p className='text-xs text-slate-500 mt-0.5'>Phone & OTP access</p>
                                    </div>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5 text-slate-300 group-hover:text-emerald-500 ml-auto transition-colors'>
                                        <polyline points='9 18 15 12 9 6'/>
                                    </svg>
                                </Link>
                            </div>

                            <p className='text-center text-xs text-slate-400'>
                                New promoter?{' '}
                                <Link to='/promoter-signup' className='text-indigo-500 font-medium hover:underline'>Sign up here</Link>
                            </p>
                        </div>
                    )}

                    {/* ── ADMIN LOGIN FORM ── */}
                    {mode === 'admin' && (
                        <div className='bg-white rounded-2xl px-8 py-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_40px_rgba(0,0,0,0.09)]'>
                            <div className='text-center mb-6'>
                                <div className='w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white shadow-md'>
                                    <ShieldIcon />
                                </div>
                                <h2 className='text-xl font-bold text-slate-900'>Admin Login</h2>
                                <p className='text-slate-500 text-xs mt-1'>Sign in with your admin credentials</p>
                            </div>
                            <AdminLoginForm />
                            <button onClick={() => setMode('select')} className='w-full mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors'>
                                ← Back to login options
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
