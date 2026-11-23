import { Link } from 'react-router-dom';
import StatusToggle  from '../components/StatusToggle';
import ActionButtons from '../components/ActionButtons';
import { getInits, avatarBg, fullName, fmtDate, fmtMoney } from '../utils/helpers';
import { EditIcon } from '../utils/icons';

const ViewIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'>
        <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/>
    </svg>
);

const TD = 'px-4 py-4';

/* Role badge color map */
const ROLE_STYLE = {
    admin:     'bg-red-50 text-red-700 border-red-200',
    sub_admin: 'bg-amber-50 text-amber-700 border-amber-200',
    promoter:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    // Bots now carry player-style usernames, so the role badge is what marks them —
    // keep it loud enough to spot at a glance.
    bot:       'bg-violet-100 text-violet-700 border-violet-300',
    user:      'bg-indigo-50 text-indigo-700 border-indigo-200',
};
const RoleBadge = ({ role }) => {
    const r = (role || 'user').toLowerCase();
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${ROLE_STYLE[r] || ROLE_STYLE.user}`}>
            {r === 'sub_admin' ? 'Sub Admin' : r.charAt(0).toUpperCase() + r.slice(1)}
        </span>
    );
};

export const TABLE_COLUMNS = [
    /* ── # ── */
    {
        key:       'index',
        headerName:'#',
        align:     'left',
        width:     50,
        sortField: null,
        tdCls:     `pl-6 pr-4 py-4 text-xs text-slate-400 font-mono`,
        renderCell: ({ index }) => index,
    },

    /* ── Player (avatar + name + id) ── */
    {
        key:       'player',
        headerName:'Player',
        align:     'left',
        width:     200,
        sortField: 'displayName',
        tdCls:     TD,
        renderCell: ({ user }) => (
            <div className='flex items-center gap-2.5'>
                <div className='w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0'
                     style={{ background: avatarBg(user.displayName || user.firstName) }}>
                    {getInits(user)}
                </div>
                <div>
                    <p className='font-semibold text-slate-800 text-sm whitespace-nowrap'>
                        {fullName(user)}
                        {(user.roles || []).includes('bot') && (
                            <span className='ml-1.5 align-middle inline-flex items-center px-1.5 py-px rounded text-[9px] font-extrabold tracking-wide bg-violet-600 text-white'>
                                BOT
                            </span>
                        )}
                    </p>
                    <p className='text-[10px] text-slate-400 font-mono'>…{(user._id || '').slice(-8)}</p>
                </div>
            </div>
        ),
    },

    /* ── Role ── */
    {
        key:       'role',
        headerName:'Role',
        align:     'left',
        width:     100,
        sortField: null,
        tdCls:     TD,
        renderCell: ({ user }) => {
            const roles = user.roles || (user.role ? [user.role] : ['user']);
            return (
                <div className='flex flex-col gap-1'>
                    {roles.map(r => <RoleBadge key={r} role={r} />)}
                </div>
            );
        },
    },

    /* ── Email ── */
    {
        key:       'email',
        headerName:'Email',
        align:     'left',
        width:     210,
        sortField: 'email',
        tdCls:     `${TD} text-slate-500 text-sm whitespace-nowrap lowercase`,
        renderCell: ({ user }) => user.email || <span className='text-slate-300 italic text-xs'>—</span>,
    },

    /* ── Phone / Mobile ── */
    {
        key:       'phone',
        headerName:'Phone',
        align:     'left',
        width:     140,
        sortField: 'mobile',
        tdCls:     `${TD} text-slate-500 font-mono text-xs whitespace-nowrap`,
        renderCell: ({ user }) => user.mobile || user.phone || <span className='text-slate-300'>—</span>,
    },

    /* ── Verification Status ── */
    {
        key:       'verified',
        headerName:'Verified',
        align:     'left',
        width:     100,
        sortField: null,
        tdCls:     TD,
        renderCell: ({ user }) => {
            const isVerified = user.isVerified !== undefined
                ? user.isVerified
                : user.status !== 'PENDING_VERIFICATION';
            return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isVerified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-400'}`}/>
                    {isVerified ? 'Verified' : 'Unverified'}
                </span>
            );
        },
    },

    /* ── Joined date ── */
    {
        key:       'joined',
        headerName:'Joined',
        align:     'left',
        width:     112,
        sortField: 'createdAt',
        tdCls:     `${TD} text-slate-400 text-xs whitespace-nowrap`,
        renderCell: ({ user }) => fmtDate(user.createdAt),
    },

    /* ── Updated date ── */
    {
        key:       'updatedAt',
        headerName:'Updated',
        align:     'left',
        width:     112,
        sortField: null,
        tdCls:     `${TD} text-slate-400 text-xs whitespace-nowrap`,
        renderCell: ({ user }) => user.updatedAt ? fmtDate(user.updatedAt) : <span className='text-slate-300'>—</span>,
    },

    /* ── Wallet balance ── */
    {
        key:       'balance',
        headerName:'Balance',
        align:     'right',
        width:     110,
        sortField: null,
        tdCls:     `${TD} text-sm font-bold text-slate-700 whitespace-nowrap text-right`,
        renderCell: ({ user }) => {
            /* New backend returns nested balance.total; old returned flat balance */
            const bal = user.balance?.total ?? user.balance ?? user.wallet?.balance ?? null;
            return bal !== null
                ? fmtMoney(bal)
                : <span className='text-slate-300 text-xs font-normal'>—</span>;
        },
    },

    /* ── Status toggle ── */
    {
        key:       'status',
        headerName:'Status',
        align:     'left',
        width:     108,
        sortField: 'status',
        tdCls:     TD,
        renderCell: ({ user, handlers }) => (
            <StatusToggle
                userId={user._id}
                initialStatus={user.status}
                userName={fullName(user)}
                onUpdated={handlers.onStatusUpdated}
            />
        ),
    },

    /* ── Referral info ── */
    {
        key:       'referral',
        headerName:'Referred By',
        align:     'left',
        width:     170,
        sortField: null,
        tdCls:     TD,
        renderCell: ({ user }) => {
            /* New backend: referredBy is the referral code string */
            const code = user.referredBy || user.referral?.code;
            const name = user.referral?.promoterName;
            if (!code && !name) return <span className='text-xs text-slate-300 italic'>Not referred</span>;
            return (
                <div className='space-y-0.5'>
                    {name && <p className='text-xs font-semibold text-slate-700 whitespace-nowrap'>{name}</p>}
                    <span className='inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold tracking-widest font-mono'>
                        {code}
                    </span>
                </div>
            );
        },
    },

    /* ── Actions: deposit / withdraw / delete ── */
    {
        key:       'action',
        headerName:'Action',
        align:     'left',
        width:     220,
        sortField: null,
        tdCls:     TD,
        renderCell: ({ user, handlers }) => (
            <div className='flex flex-wrap items-center gap-1.5'>
                {handlers.isAdmin && (
                    <ActionButtons onDeposit={handlers.onDeposit} onWithdraw={handlers.onWithdraw} />
                )}
                <Link
                    to={`/dashboard/users/${user._id}`}
                    className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:scale-95 transition-all'
                >
                    <ViewIcon />View
                </Link>
                <button
                    onClick={handlers.onDelete}
                    className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-95 transition-all'
                >
                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3 h-3'>
                        <polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/><path d='M10 11v6'/><path d='M14 11v6'/><path d='M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/>
                    </svg>
                    Delete
                </button>
            </div>
        ),
    },

    /* ── Edit (opens Change Role modal) ── */
    {
        key:       'edit',
        headerName:'Edit',
        align:     'center',
        width:     70,
        sortField: null,
        tdCls:     `pl-4 pr-6 py-4 text-center`,
        renderCell: ({ handlers }) => (
            <button
                type='button'
                onClick={handlers.onEditProfile}
                title='Change role'
                className='inline-flex items-center justify-center w-8 h-8 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:border-indigo-300 transition-all'
            >
                <EditIcon />
            </button>
        ),
    },
];
