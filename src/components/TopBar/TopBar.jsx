import { memo, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { usePanelAuth } from '../../context/AuthContext';

const PAGE_TITLES = {
    '/dashboard/users':     { title: 'User Management',     sub: 'View and manage registered players'   },
    '/dashboard/promoters': { title: 'Promoter Management', sub: 'Manage promoters and referral codes'  },
    '/dashboard/boats':     { title: 'Bot Management',      sub: 'View and manage all bots'              },
    '/dashboard/reports':   { title: 'Reports',             sub: 'Download day-wise reports as CSV' },
    '/dashboard/overview':  { title: 'Profit & Loss',       sub: 'How much the platform earned, users and bots won or lost' },
    '/dashboard/matches':   { title: 'Matches',             sub: 'All matches, players, bots and money'  },
    // [Game-only transactions, 2026-10-27] Transactions page subtitle.
    '/dashboard/transactions':   { title: 'Transactions',   sub: 'Ludo game money of users and bots' },
    '/dashboard/sub-admins':     { title: 'Sub Admins',     sub: 'Manage sub-admin accounts'                  },
    '/dashboard/pools':          { title: 'Pools',          sub: 'Entry fees and Quick Match settings'        },
    '/dashboard/match-recovery': { title: 'Match Recovery', sub: 'Fix matches hit by a crash or failed payment' },
    '/dashboard/bot-analytics':  { title: 'Bot Analytics',  sub: 'Bot money, targets and difficulty'          },
    '/dashboard/test-mode':      { title: 'Testing Mode',   sub: 'Let only chosen DABBA users play'            },
};

const PROMOTER_PAGE_TITLES = {
    '/dashboard/users':     { title: 'My Referred Users',     sub: 'Players who signed up with your code'    },
    '/dashboard/promoters': { title: 'My Sub-Promoters',      sub: 'Promoters referred by you'               },
};

const MenuIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'>
        <line x1='3' y1='6' x2='21' y2='6'/><line x1='3' y1='12' x2='21' y2='12'/><line x1='3' y1='18' x2='21' y2='18'/>
    </svg>
);

const TopBar = memo(function TopBar({ onMenuClick }) {
    const { user, role } = usePanelAuth();
    const { pathname } = useLocation();

    const isAdmin = role === 'a';

    const page = useMemo(() => {
        const titles = isAdmin ? PAGE_TITLES : PROMOTER_PAGE_TITLES;
        return titles[pathname] || { title: 'Dashboard', sub: isAdmin ? 'Admin overview' : 'Promoter overview' };
    }, [pathname, isAdmin]);

    const now = useMemo(() =>
        new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
        []
    );

    return (
        <header className='flex items-center justify-between px-4 sm:px-7 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-40 gap-3'>

            <div className='flex items-center gap-3 min-w-0'>
                <button onClick={onMenuClick} aria-label='Open menu'
                    className='lg:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shrink-0'>
                    <MenuIcon />
                </button>
                <div className='min-w-0'>
                    <h1 className='text-base sm:text-lg font-bold text-slate-900 truncate'>{page.title}</h1>
                    <p className='text-xs text-slate-500 mt-0.5 hidden sm:block'>{page.sub}</p>
                </div>
            </div>

            <div className='flex items-center gap-2 sm:gap-3 shrink-0'>
                <span className='text-xs text-slate-400 hidden md:block whitespace-nowrap'>{now}</span>

                {/* Role badge */}
                <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                    isAdmin
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                    {isAdmin ? 'Admin' : 'Promoter'}
                </span>

                {/* User name pill */}
                <div className='flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5'>
                    <span className='w-2 h-2 rounded-full bg-emerald-500 shrink-0' />
                    <span className='text-xs font-semibold text-slate-600 max-w-24 sm:max-w-none truncate'>
                        {user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
                    </span>
                </div>
            </div>
        </header>
    );
});

export default TopBar;
