import { useState, useEffect, useCallback, useMemo } from 'react';

import { fetchUsers, depositUser, withdrawUser, deleteUser } from '../../api';
import { cacheGet, cacheSet, cacheHas, cacheClear } from '../../cache';
import { toast }          from '../../toast';
import CreateUserModal    from '../../components/CreateUserModal';
import EditUserModal      from '../../components/EditUserModal';
import { TABLE_COLUMNS }  from '../../constants/tableColumns';
import { DEFAULT_PARAMS, PAGE_LIMIT } from '../../constants/filterOptions';
import { fmtMoney, fullName } from '../../utils/helpers';

import FilterInput        from '../../components/FilterInput';
import TableHeader        from '../../components/TableHeader';
import TableSkeleton      from '../../components/TableSkeleton';
import MobileCardSkeleton from '../../components/MobileCardSkeleton';
import UserRow            from '../../components/UserRow';
import UserCard           from '../../components/UserCard';
import ActionModal        from '../../components/ActionModal';
import PageBtn            from '../../components/PageBtn';

import { ChevLIcon, ChevRIcon } from '../../utils/icons';

const FIXED_ROLE = 'sub_admin';

const BASE_PARAMS = { ...DEFAULT_PARAMS, role: FIXED_ROLE };

const ShieldIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.6' stroke='currentColor' className='w-12 h-12'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'/>
    </svg>
);

export default function SubAdmins() {
    const [params,    setParams]    = useState(BASE_PARAMS);
    const [nameUI,    setNameUI]    = useState('');
    const [emailUI,   setEmailUI]   = useState('');

    const [users,     setUsers]     = useState([]);
    const [total,     setTotal]     = useState(0);
    const [pages,     setPages]     = useState(1);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');
    const [modal,     setModal]     = useState({ open: false, type: '', user: null });
    const [createOpen, setCreateOpen] = useState(false);
    const [editUser,  setEditUser]  = useState(null);

    /* ── Debounced text search ── */
    const [nameTimer,  setNameTimer]  = useState(null);
    const [emailTimer, setEmailTimer] = useState(null);

    const onName = useCallback(v => {
        setNameUI(v);
        clearTimeout(nameTimer);
        setNameTimer(setTimeout(() => setParams(p => ({ ...p, page: 1, firstName: v })), 380));
    }, [nameTimer]);

    const onEmail = useCallback(v => {
        setEmailUI(v);
        clearTimeout(emailTimer);
        setEmailTimer(setTimeout(() => setParams(p => ({ ...p, page: 1, email: v })), 380));
    }, [emailTimer]);

    const clearAll = useCallback(() => {
        setNameUI(''); setEmailUI('');
        setParams(BASE_PARAMS);
    }, []);

    const goToPage = useCallback(pg => setParams(p => ({ ...p, page: pg })), []);

    /* ── Fetch ── */
    const doFetch = useCallback((p, force = false) => {
        const key = JSON.stringify(p);
        if (!force && cacheHas(key)) {
            const c = cacheGet(key);
            setUsers(c.users ?? []); setTotal(c.total ?? 0); setPages(c.pages ?? 1);
            setLoading(false);
            return;
        }
        setError('');
        let cancelled = false;
        fetchUsers(p)
            .then(r => {
                if (cancelled) return;
                const d          = r.data.data;
                const pagination = r.data.pagination;
                const list  = Array.isArray(d) ? d : (d.users ?? []);
                const tot   = pagination?.total     ?? d.total  ?? 0;
                const pgs   = pagination?.totalPages ?? d.pages  ?? 1;
                setUsers(list); setTotal(tot); setPages(pgs);
                cacheSet(key, { users: list, total: tot, pages: pgs });
            })
            .catch(e => { if (!cancelled) setError(e.response?.data?.message || 'Network error.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { setLoading(true); return doFetch(params); }, [params, doFetch]);

    const refresh = useCallback(() => { cacheClear(); setLoading(true); doFetch(params, true); }, [params, doFetch]);

    /* ── Handlers ── */
    const handleStatusUpdated = useCallback((id, s) => {
        setUsers(prev => prev.map(u => u._id === id ? { ...u, status: s } : u));
        cacheClear();
    }, []);

    const handleBalanceUpdated = useCallback((id, b) => {
        setUsers(prev => prev.map(u => u._id === id ? { ...u, balance: b } : u));
        cacheClear();
    }, []);

    const openModal  = useCallback((type, user) => setModal({ open: true, type, user }), []);
    const closeModal = useCallback(() => setModal({ open: false, type: '', user: null }), []);

    const handleCreated = useCallback(() => {
        cacheClear(); setLoading(true); doFetch({ ...BASE_PARAMS }, true);
    }, [doFetch]);

    const handleEditProfile = useCallback(user => setEditUser(user), []);
    const handleEditClosed  = useCallback(() => setEditUser(null), []);
    const handleEditSaved   = useCallback(updated => {
        setUsers(prev => prev.map(u => u._id === updated._id ? { ...u, ...updated } : u));
        cacheClear(); setEditUser(null);
    }, []);

    const handleDelete = useCallback(async user => {
        const name = fullName(user);
        if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
        try {
            await deleteUser(user._id);
            setUsers(prev => prev.filter(u => u._id !== user._id));
            setTotal(t => t - 1);
            cacheClear();
            toast.success(`${name} deleted`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Delete is not supported by the current backend.');
        }
    }, []);

    const handleConfirm = useCallback(async amount => {
        const { type, user } = modal;
        const res    = await (type === 'deposit' ? depositUser : withdrawUser)(user._id, amount);
        const d      = res.data?.data ?? {};
        const newBal = Number(d.afterBalance ?? d.balance ?? 0);
        const msg    = res.data?.message || '';
        handleBalanceUpdated(user._id, newBal);
        const name = fullName(user);
        type === 'deposit'
            ? toast.success(msg || `₹${amount.toLocaleString('en-IN')} deposited to ${name}. Balance: ${fmtMoney(newBal)}`)
            : toast.warning(msg || `₹${amount.toLocaleString('en-IN')} withdrawn from ${name}. Balance: ${fmtMoney(newBal)}`);
    }, [modal, handleBalanceUpdated]);

    /* ── Derived ── */
    const { page: curPage } = params;
    const start    = useMemo(() => (curPage - 1) * PAGE_LIMIT + 1, [curPage]);
    const end      = useMemo(() => Math.min(curPage * PAGE_LIMIT, total), [curPage, total]);
    const pageNums = useMemo(() =>
        Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || Math.abs(p - curPage) <= 1)
            .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                acc.push(p); return acc;
            }, []),
        [pages, curPage]);

    const hasFilters = nameUI || emailUI;
    const tableMinW  = TABLE_COLUMNS.reduce((s, c) => s + c.width, 0);
    const selectCls  = 'w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer transition-all focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10';

    const EmptyState = (
        <div className='flex flex-col items-center justify-center py-16 gap-3'>
            <div className='text-slate-200'><ShieldIcon /></div>
            <p className='font-semibold text-slate-500 text-sm'>No sub-admins found</p>
            {hasFilters && <button onClick={clearAll} className='text-xs text-amber-500 hover:underline'>Clear filters</button>}
        </div>
    );

    return (
        <>
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>

            {/* ── Toolbar ── */}
            <div className='p-4 sm:p-5 border-b border-slate-100 space-y-4'>
                <div className='flex items-center justify-between'>
                    <div>
                        <p className='text-sm font-bold text-slate-700'>Sub Admin Management</p>
                        <p className='text-xs text-slate-400 mt-0.5'>Users with limited admin operations</p>
                    </div>
                    <button
                        onClick={() => setCreateOpen(true)}
                        className='h-9 px-4 flex items-center gap-1.5 text-white text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm'
                    >
                        <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'>
                            <line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/>
                        </svg>
                        Add Sub Admin
                    </button>
                </div>

                {/* Search */}
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <FilterInput label='Name'  placeholder='e.g. Rahul Sharma' value={nameUI}  onChange={onName}  />
                    <FilterInput label='Email' placeholder='e.g. rahul@...'    value={emailUI} onChange={onEmail} />
                </div>

                <div className='flex items-center justify-between'>
                    {hasFilters && (
                        <button onClick={clearAll} className='h-9 px-3 text-xs font-semibold text-red-600 border-[1.5px] border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors'>
                            Clear Filters
                        </button>
                    )}
                    <span className='ml-auto h-9 flex items-center px-3 text-xs font-semibold text-slate-500 bg-amber-50 border border-amber-200 rounded-full'>
                        {loading ? '…' : `${total.toLocaleString()} Sub Admin${total !== 1 ? 's' : ''}`}
                    </span>
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className='flex flex-col items-center justify-center py-14 gap-3 px-5'>
                    <div className='w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center'>
                        <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' stroke='#ef4444' className='w-6 h-6'><circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/></svg>
                    </div>
                    <p className='font-semibold text-slate-700 text-sm'>Failed to load sub-admins</p>
                    <p className='text-xs text-slate-400 text-center'>{error}</p>
                    <button onClick={refresh} className='h-9 px-6 bg-amber-500 text-white text-xs font-semibold rounded-xl hover:bg-amber-600 transition-colors'>Retry</button>
                </div>
            )}

            {/* ── Mobile cards ── */}
            {!error && (
                <div className='md:hidden'>
                    {loading ? <MobileCardSkeleton rows={5} />
                        : users.length === 0 ? EmptyState
                        : users.map((u, i) => (
                            <UserCard
                                key={u._id}
                                user={u}
                                index={(curPage - 1) * PAGE_LIMIT + i + 1}
                                onStatusUpdated={handleStatusUpdated}
                                onDeposit={() => openModal('deposit',    u)}
                                onWithdraw={() => openModal('withdrawal', u)}
                            />
                        ))
                    }
                </div>
            )}

            {/* ── Desktop table ── */}
            {!error && (
                <div className='hidden md:block w-full overflow-x-auto table-scroll'>
                    <table className='border-collapse' style={{ minWidth: tableMinW, width: '100%' }}>
                        <colgroup>
                            {TABLE_COLUMNS.map(col => (
                                <col key={col.key} style={{ width: col.width, minWidth: col.width }} />
                            ))}
                        </colgroup>
                        <TableHeader columns={TABLE_COLUMNS} sortBy='' sortDir='desc' onSort={() => {}} />
                        <tbody>
                            {loading ? (
                                <TableSkeleton columns={TABLE_COLUMNS} rows={PAGE_LIMIT} />
                            ) : users.length === 0 ? (
                                <tr><td colSpan={TABLE_COLUMNS.length}>{EmptyState}</td></tr>
                            ) : (
                                users.map((u, i) => (
                                    <UserRow
                                        key={u._id}
                                        columns={TABLE_COLUMNS}
                                        user={u}
                                        index={(curPage - 1) * PAGE_LIMIT + i + 1}
                                        isAdmin={true}
                                        onStatusUpdated={handleStatusUpdated}
                                        openModal={openModal}
                                        onEditProfile={handleEditProfile}
                                        onDelete={handleDelete}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Pagination ── */}
            {!loading && !error && pages > 1 && (
                <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-4 border-t border-slate-100'>
                    <p className='text-xs text-slate-500 text-center'>
                        <span className='font-semibold text-slate-700'>{start}–{end}</span> of{' '}
                        <span className='font-semibold text-slate-700'>{total.toLocaleString()}</span>
                        {' '}· Page <span className='font-semibold text-slate-700'>{curPage}</span>/<span className='font-semibold text-slate-700'>{pages}</span>
                    </p>
                    <div className='flex items-center gap-1.5 flex-wrap justify-center'>
                        <PageBtn onClick={() => goToPage(1)}           disabled={curPage === 1 || loading}>«</PageBtn>
                        <PageBtn onClick={() => goToPage(curPage - 1)} disabled={curPage === 1 || loading}><ChevLIcon /></PageBtn>
                        {pageNums.map((p, i) =>
                            p === '…'
                                ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                                : <PageBtn key={p} onClick={() => goToPage(p)} disabled={loading} active={p === curPage}>{p}</PageBtn>
                        )}
                        <PageBtn onClick={() => goToPage(curPage + 1)} disabled={curPage === pages || loading}><ChevRIcon /></PageBtn>
                        <PageBtn onClick={() => goToPage(pages)}       disabled={curPage === pages || loading}>»</PageBtn>
                    </div>
                </div>
            )}
        </div>

        <ActionModal modal={modal} onClose={closeModal} onConfirm={handleConfirm} />
        <CreateUserModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={handleCreated}
            fixedRole={FIXED_ROLE}
        />
        <EditUserModal user={editUser} open={!!editUser} onClose={handleEditClosed} onSaved={handleEditSaved} />
        </>
    );
}
