import { NavLink, useNavigate } from 'react-router-dom';
import { usePanelAuth } from '../../context/AuthContext';
import { logoutApi } from '../../api';

/* ── Icons ── */
const ShieldIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.6' stroke='currentColor' className='w-5 h-5'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'/>
    </svg>
);
const MegaphoneIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'>
        <path d='M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z'/>
    </svg>
);
const UsersIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/>
        <path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/>
    </svg>
);
const PromoterIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z'/>
    </svg>
);
const LogoutIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'>
        <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'/>
        <polyline points='16 17 21 12 16 7'/><line x1='21' y1='12' x2='9' y2='12'/>
    </svg>
);
const XIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' stroke='currentColor' className='w-5 h-5'>
        <line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/>
    </svg>
);

/* Nav items per role */
const BoatIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M2 21c.6.5 1.2 1 2.5 1C7 22 7 20 9.5 20c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'/>
        <path d='M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76'/>
        <path d='M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6'/>
        <path d='M12 10v4'/>
        <path d='M12 7v.01'/>
    </svg>
);

const SubAdminIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/>
    </svg>
);

const HomeIcon   = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z'/><polyline points='9 22 9 12 15 12 15 22'/>
    </svg>
);
const WalletNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <rect x='2' y='5' width='20' height='14' rx='2'/><line x1='2' y1='10' x2='22' y2='10'/>
    </svg>
);

const TxNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <line x1='12' y1='1' x2='12' y2='23'/>
        <path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'/>
    </svg>
);

const PoolNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <rect x='2' y='3' width='20' height='14' rx='2'/>
        <line x1='8' y1='21' x2='16' y2='21'/>
        <line x1='12' y1='17' x2='12' y2='21'/>
    </svg>
);

const RecoveryNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M3 12a9 9 0 1 0 3-6.7'/><polyline points='3 4 3 9 8 9'/>
    </svg>
);

const BotAnalyticsNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <line x1='4' y1='20' x2='20' y2='20'/><rect x='6' y='11' width='3' height='9'/><rect x='11' y='6' width='3' height='14'/><rect x='16' y='14' width='3' height='6'/>
    </svg>
);

const MatchesNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <rect x='3' y='3' width='18' height='18' rx='3'/><circle cx='8.5' cy='8.5' r='1.2'/><circle cx='15.5' cy='15.5' r='1.2'/><circle cx='15.5' cy='8.5' r='1.2'/><circle cx='8.5' cy='15.5' r='1.2'/>
    </svg>
);

const OverviewNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <polyline points='3 17 9 11 13 15 21 7'/><polyline points='14 7 21 7 21 14'/>
    </svg>
);

const ReportsNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z'/><polyline points='14 3 14 8 19 8'/><line x1='12' y1='12' x2='12' y2='18'/><polyline points='9 15 12 18 15 15'/>
    </svg>
);

const TestModeNavIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4.5 h-4.5'>
        <path d='M9 3h6'/><path d='M10 3v6L5 18a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3'/><line x1='7.5' y1='14' x2='16.5' y2='14'/>
    </svg>
);

const ADMIN_NAV    = [
    { to: '/dashboard/overview',     icon: <OverviewNavIcon />, label: 'Profit & Loss' },
    { to: '/dashboard/reports',      icon: <ReportsNavIcon />,  label: 'Reports'       },
    { to: '/dashboard/users',        icon: <UsersIcon />,    label: 'Users'        },
    { to: '/dashboard/sub-admins',   icon: <SubAdminIcon />, label: 'Sub Admins'   },
    { to: '/dashboard/promoters',    icon: <PromoterIcon />, label: 'Promoters'    },
    { to: '/dashboard/boats',        icon: <BoatIcon />,     label: 'Bots'         },
    { to: '/dashboard/pools',        icon: <PoolNavIcon />,  label: 'Pools'        },
    { to: '/dashboard/matches',      icon: <MatchesNavIcon />, label: 'Matches'    },
    { to: '/dashboard/transactions', icon: <TxNavIcon />,    label: 'Transactions' },
    { to: '/dashboard/match-recovery', icon: <RecoveryNavIcon />, label: 'Match Recovery' },
    { to: '/dashboard/bot-analytics', icon: <BotAnalyticsNavIcon />, label: 'Bot Analytics' },
    { to: '/dashboard/test-mode',     icon: <TestModeNavIcon />,     label: 'Testing Mode' },
];
const PROMOTER_NAV = [
    { to: '/dashboard/home',   icon: <HomeIcon />,      label: 'Dashboard' },
    { to: '/dashboard/users',  icon: <UsersIcon />,     label: 'My Users'  },
    { to: '/dashboard/wallet', icon: <WalletNavIcon />, label: 'My Wallet' },
];

export default function Sidebar({ open, onClose }) {
    const { user, role, logout } = usePanelAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logoutApi(); logout(); navigate('/login', { replace: true }); };

    const isAdmin  = role === 'a';
    const nav      = isAdmin ? ADMIN_NAV : PROMOTER_NAV;
    const initials = (() => {
        if (!user) return '?';
        if (user.displayName) {
            const p = user.displayName.trim().split(/\s+/);
            return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
        }
        return (`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`).toUpperCase() || '?';
    })();

    /* Theme by role */
    const accent     = isAdmin ? 'indigo' : 'emerald';
    const sidebarBg  = isAdmin ? 'bg-slate-900' : 'bg-emerald-950';
    const iconBg     = isAdmin ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
    const activeLink = isAdmin ? 'bg-indigo-500/20 text-indigo-300'                        : 'bg-emerald-500/20 text-emerald-300';
    const roleColor  = isAdmin ? 'bg-indigo-500/15 text-indigo-400'                        : 'bg-emerald-500/15 text-emerald-400';
    const roleDot    = isAdmin ? 'bg-indigo-400'                                            : 'bg-emerald-400';
    const avatarBg   = isAdmin ? 'bg-linear-to-br from-indigo-500 to-indigo-700'            : 'bg-linear-to-br from-emerald-500 to-emerald-700';
    const roleLabel  = isAdmin ? 'Administrator'                                            : 'Promoter';
    const panelLabel = isAdmin ? 'Admin Panel'                                              : 'Promoter Panel';

    return (
        <aside className={`fixed top-0 left-0 h-screen w-64 ${sidebarBg} flex flex-col z-50
            transition-transform duration-300 ease-in-out
            ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

            {/* Brand */}
            <div className='flex items-center justify-between px-5 py-5 border-b border-white/[0.07]'>
                <div className='flex items-center gap-3'>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${iconBg}`}>
                        {isAdmin ? <ShieldIcon /> : <MegaphoneIcon />}
                    </div>
                    <div>
                        <p className='text-sm font-bold text-slate-100 leading-tight'>Ludo Arena</p>
                        <p className={`text-[11px] font-semibold tracking-widest uppercase mt-0.5 text-${accent}-400`}>
                            {panelLabel}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className='lg:hidden text-slate-500 hover:text-slate-300 p-1'>
                    <XIcon />
                </button>
            </div>

            {/* Nav */}
            <nav className='flex-1 px-3 py-5 overflow-y-auto'>
                <p className='text-[10px] font-bold text-slate-500 tracking-[0.12em] uppercase px-3 mb-2'>Menu</p>
                {nav.map(item => (
                    <NavLink key={item.to} to={item.to} onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-1 ` +
                            (isActive ? activeLink : 'text-slate-400 hover:bg-white/6 hover:text-slate-200')
                        }
                    >
                        {item.icon}{item.label}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom: user info + logout */}
            <div className='px-3 pb-4 border-t border-white/[0.07] pt-3 space-y-2'>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${roleColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${roleDot}`} />{roleLabel}
                </div>

                <div className='flex items-center gap-2.5 px-3 py-2.5 bg-white/4 rounded-xl'>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarBg}`}>
                        {initials}
                    </div>
                    <div className='min-w-0'>
                        <p className='text-sm font-semibold text-slate-200 truncate'>{user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}</p>
                        <p className={`text-[11px] font-medium text-${accent}-400 truncate`}>{user?.email}</p>
                    </div>
                </div>

                <button onClick={handleLogout}
                    className='flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-slate-500 text-sm font-medium transition-colors hover:bg-red-500/10 hover:text-red-400'>
                    <LogoutIcon />Logout
                </button>
            </div>
        </aside>
    );
}
