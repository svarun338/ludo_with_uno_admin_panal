import { useState, useCallback, memo } from 'react';
import { updateUserStatus } from '../api';
import { toast } from '../toast';

/* Normalize backend status (ACTIVE / BLOCKED / SUSPENDED / active / inactive) → 'active' | 'inactive' */
const normalize = s => {
    const l = (s || '').toLowerCase();
    return (l === 'active') ? 'active' : 'inactive';
};

const StatusToggle = memo(function StatusToggle({ userId, initialStatus, userName, onUpdated }) {
    const [current,  setCurrent]  = useState(() => normalize(initialStatus));
    const [toggling, setToggling] = useState(false);

    const toggle = useCallback(async () => {
        const next = current === 'active' ? 'inactive' : 'active';
        setToggling(true);
        try {
            await updateUserStatus(userId, next);
            setCurrent(next);
            onUpdated?.(userId, next);
            next === 'active'
                ? toast.success(`${userName} is now Active`)
                : toast.warning(`${userName} is now Inactive`);
        } catch (e) {
            toast.error(e.response?.data?.message || `Failed to update ${userName}'s status`);
        } finally {
            setToggling(false);
        }
    }, [current, userId, userName, onUpdated]);

    const active = current === 'active';

    return (
        <button
            onClick={toggle}
            disabled={toggling}
            title={active ? 'Click to deactivate' : 'Click to activate'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all disabled:opacity-60 hover:opacity-80 ${
                active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
            }`}
        >
            {toggling
                ? <span className='w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin' />
                : <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-400'}`} />
            }
            {active ? 'Active' : 'Inactive'}
        </button>
    );
});

export default StatusToggle;
