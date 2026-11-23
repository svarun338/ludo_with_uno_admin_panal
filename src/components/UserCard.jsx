import { memo } from 'react';
import { Link } from 'react-router-dom';
import { MailIcon, PhoneIcon, CalIcon, WalletIcon } from '../utils/icons';
import { avatarBg, getInits, fullName, fmtDate, fmtMoney } from '../utils/helpers';
import StatusToggle  from './StatusToggle';
import VerifiedBadge from './VerifiedBadge';
import ActionButtons from './ActionButtons';

const UserCard = memo(function UserCard({ user, index, onStatusUpdated, onDeposit, onWithdraw }) {
    const name = fullName(user);
    /* balance.total (new backend) or flat balance (old) */
    const balance = user.balance?.total ?? user.balance ?? 0;
    return (
        <div className='flex gap-3 px-4 py-4 border-b border-slate-50 last:border-0'>
            <div className='flex flex-col items-center gap-1.5 shrink-0 pt-0.5'>
                <span className='text-[10px] text-slate-400 font-mono'>{index}</span>
                <div
                    className='w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold'
                    style={{ background: avatarBg(user.displayName || user.firstName) }}
                >
                    {getInits(user)}
                </div>
            </div>

            <div className='flex-1 min-w-0'>
                <div className='flex items-start justify-between gap-2 mb-1.5'>
                    <p className='font-semibold text-slate-800 text-sm leading-tight'>
                        {name}
                        {(user.roles || []).includes('bot') && (
                            <span className='ml-1.5 align-middle inline-flex items-center px-1.5 py-px rounded text-[9px] font-extrabold tracking-wide bg-violet-600 text-white'>
                                BOT
                            </span>
                        )}
                    </p>
                    <VerifiedBadge verified={user.isVerified} />
                </div>

                <div className='space-y-1.5 mb-2.5'>
                    <p className='flex items-center gap-1.5 text-xs text-slate-500'><MailIcon /><span className='truncate'>{user.email}</span></p>
                    <p className='flex items-center gap-1.5 text-xs text-slate-500'><PhoneIcon /><span className='font-mono'>{user.mobile || user.phone || '—'}</span></p>
                    <p className='flex items-center gap-1.5 text-xs text-slate-400'><CalIcon /><span>Joined {fmtDate(user.createdAt)}</span></p>
                    <p className='flex items-center gap-1.5 text-xs font-bold text-slate-700'><WalletIcon /><span>{fmtMoney(balance)}</span></p>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                    <StatusToggle userId={user._id} initialStatus={user.status} userName={name} onUpdated={onStatusUpdated} />
                    <ActionButtons onDeposit={onDeposit} onWithdraw={onWithdraw} />
                    <Link to={`/dashboard/users/${user._id}`}
                        className='inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all'>
                        View Details
                    </Link>
                </div>
            </div>
        </div>
    );
});

export default UserCard;
