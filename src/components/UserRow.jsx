import { memo, useMemo } from 'react';

/**
 * Desktop table row.
 * handlers: { isAdmin, onStatusUpdated, onDeposit, onWithdraw, onEdit, onDelete }
 */
const UserRow = memo(function UserRow({ columns, user, index, isAdmin, onStatusUpdated, openModal, onEditProfile, onDelete }) {
    const handlers = useMemo(() => ({
        isAdmin,
        onStatusUpdated,
        onDeposit:     () => openModal('deposit',    user),
        onWithdraw:    () => openModal('withdrawal', user),
        onEditProfile: () => onEditProfile(user),
        onDelete:      () => onDelete(user),
    }), [isAdmin, onStatusUpdated, openModal, onEditProfile, onDelete, user]);

    return (
        <tr className='border-b border-slate-50 last:border-0 even:bg-slate-50/40 hover:bg-indigo-50/40 transition-colors'>
            {columns.map((col, i) => (
                <td
                    key={col.key}
                    className={`${col.tdCls || 'px-4 py-3.5'} ${i !== columns.length - 1 ? 'border-r border-slate-100' : ''}`}
                >
                    {col.renderCell({ user, index, handlers })}
                </td>
            ))}
        </tr>
    );
});

export default UserRow;
