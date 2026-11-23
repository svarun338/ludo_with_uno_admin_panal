import { useState, useEffect, useRef, memo } from 'react';
import { changeUserRole } from '../api';
import { toast } from '../toast';
import { fullName, fmtDate } from '../utils/helpers';

const XIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' stroke='currentColor' className='w-4 h-4'>
        <line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/>
    </svg>
);

const ROLES = [
    { value: 'user',      label: 'User',      desc: 'Normal game player',             color: 'indigo'  },
    { value: 'promoter',  label: 'Promoter',  desc: 'Referral / business partner',    color: 'emerald' },
    { value: 'sub_admin', label: 'Sub Admin', desc: 'Limited admin operations',       color: 'amber'   },
    { value: 'admin',     label: 'Admin',     desc: 'Full admin access',              color: 'red'     },
    { value: 'bot',       label: 'Bot',       desc: 'AI player',                      color: 'slate'   },
];

const ROLE_COLOR = {
    indigo:  'bg-indigo-50 border-indigo-300 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-300 text-emerald-700',
    amber:   'bg-amber-50 border-amber-300 text-amber-700',
    red:     'bg-red-50 border-red-300 text-red-700',
    slate:   'bg-slate-100 border-slate-300 text-slate-600',
};

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
const avatarBg = n => AVATAR_COLORS[(n?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
const getInits = u => {
    if (!u) return '?';
    if (u.displayName) {
        const p = u.displayName.trim().split(/\s+/);
        return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
    }
    return (`${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`).toUpperCase() || '?';
};

/* Derive current role from user.roles array or user.role string */
const deriveRole = user => {
    const r = user?.roles?.[0] || user?.role || 'user';
    return r.toLowerCase();
};

const EditUserModal = memo(function EditUserModal({ user, open, onClose, onSaved }) {
    const [selectedRole, setSelectedRole] = useState('user');
    const [loading,      setLoading]      = useState(false);
    const [apiError,     setApiError]     = useState('');

    useEffect(() => {
        if (open && user) {
            setSelectedRole(deriveRole(user));
            setApiError('');
        }
    }, [open, user]);

    if (!open || !user) return null;

    const currentRole = deriveRole(user);
    const changed     = selectedRole !== currentRole;
    const name        = fullName(user);

    const submit = async () => {
        if (!changed) { onClose(); return; }
        setLoading(true); setApiError('');
        try {
            await changeUserRole(user._id, selectedRole);
            const msg = `${name}'s role changed to ${ROLES.find(r => r.value === selectedRole)?.label || selectedRole}`;
            toast.success(msg);
            onSaved?.({ ...user, roles: [selectedRole], role: selectedRole });
            onClose();
        } catch (e) {
            const msg = e.response?.data?.message || 'Failed to change role.';
            setApiError(msg);
            toast.error(msg);
        } finally { setLoading(false); }
    };

    return (
        <div className='fixed inset-0 bg-black/50 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4'
             onKeyDown={e => e.key === 'Escape' && onClose()}>
            <div className='bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>

                {/* Header */}
                <div className='px-6 py-5 flex items-center justify-between bg-indigo-600'>
                    <div className='flex items-center gap-3'>
                        <div className='w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0'
                             style={{ background: avatarBg(user.displayName || user.firstName) }}>
                            {getInits(user)}
                        </div>
                        <div>
                            <h3 className='text-white font-bold text-base'>Edit User</h3>
                            <p className='text-indigo-200 text-xs mt-0.5'>{name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white'><XIcon /></button>
                </div>

                <div className='px-6 py-5 space-y-5'>

                    {/* User info (read-only) */}
                    <div className='grid grid-cols-2 gap-3 text-xs'>
                        {[
                            ['Email',   user.email   || '—'],
                            ['Mobile',  user.mobile || user.phone || '—'],
                            ['Joined',  fmtDate(user.createdAt)],
                            ['Status',  user.status  || '—'],
                        ].map(([label, value]) => (
                            <div key={label} className='bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100'>
                                <p className='text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5'>{label}</p>
                                <p className='text-slate-700 font-semibold truncate'>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Role selector */}
                    <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Change Role</label>
                            {changed && (
                                <span className='text-[10px] text-indigo-500 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100'>
                                    Changed
                                </span>
                            )}
                        </div>
                        <div className='grid grid-cols-2 gap-2'>
                            {ROLES.map(r => (
                                <button
                                    key={r.value}
                                    type='button'
                                    onClick={() => { setSelectedRole(r.value); setApiError(''); }}
                                    className={`flex flex-col items-start px-3 py-2 rounded-xl border-[1.5px] text-left transition-all ${
                                        selectedRole === r.value
                                            ? ROLE_COLOR[r.color] + ' ring-2 ring-offset-1 ring-current/30'
                                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-500'
                                    }`}
                                >
                                    <span className='text-xs font-bold'>{r.label}</span>
                                    <span className='text-[10px] opacity-70 mt-0.5 leading-tight'>{r.desc}</span>
                                </button>
                            ))}
                        </div>

                        {/* Warning for sensitive roles */}
                        {(selectedRole === 'admin' || selectedRole === 'sub_admin') && changed && (
                            <div className='flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700'>
                                <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4 shrink-0 mt-0.5'><path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/><line x1='12' y1='9' x2='12' y2='13'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>
                                <p className='text-xs font-medium'>
                                    Granting <strong>{selectedRole === 'admin' ? 'Admin' : 'Sub Admin'}</strong> access gives elevated permissions. Make sure this is intentional.
                                </p>
                            </div>
                        )}
                    </div>

                    {apiError && (
                        <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiError}</p>
                    )}
                </div>

                {/* Footer */}
                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose}
                        className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>
                        Cancel
                    </button>
                    <button onClick={submit} disabled={loading || !changed}
                        className='flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
                        {loading
                            ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                            : changed ? 'Save Role Change' : 'No Changes'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
});

export default EditUserModal;
