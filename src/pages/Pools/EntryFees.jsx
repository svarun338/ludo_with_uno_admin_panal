import { useState, useEffect, useCallback } from 'react';
import { fetchPools, createPool, updatePool, togglePool } from '../../api';
import { toast } from '../../toast';
import { fmtDate } from '../../utils/helpers';
import {
    PlusIcon, EditIcon, ViewIcon, EmptyIcon, PowerIcon,
    inputCls, labelCls, money, StatusPill, EnabledPicker, ModalShell, ModalFooter,
} from './poolUi';

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

/* The master list of approved entry fees. Private Room and Quick Match both offer
   exactly these amounts (an enabled fee here is what a player can pick). */

function FeeModal({ fee, onClose, onSaved }) {
    const isEdit = !!fee;
    // A name equal to the auto-generated one ("₹50") is shown blank so it keeps following
    // the amount if that changes.
    const autoName = fee && fee.name === money(fee.entryFee);
    const [form, setForm] = useState({
        entryFee: fee ? String(Number(fee.entryFee)) : '',
        name:     fee && !autoName ? fee.name : '',
        isActive: fee ? fee.isActive : true,
    });
    const [error,  setError]  = useState('');
    const [apiErr, setApiErr] = useState('');
    const [saving, setSaving] = useState(false);

    const change = (k, v) => { setForm(p => ({ ...p, [k]: v })); setError(''); setApiErr(''); };

    const submit = async () => {
        if (!AMOUNT_RE.test(form.entryFee) || Number(form.entryFee) <= 0) {
            setError('Enter a positive amount (up to 2 decimals)'); return;
        }
        setSaving(true);
        try {
            const name = form.name.trim() || money(form.entryFee);
            const res = isEdit
                ? await updatePool(fee.id, { entryFee: form.entryFee, name, isActive: form.isActive })
                // quickMatchEnabled:false — a new fee is only an approved amount until an
                // admin configures it under the Quick Match section.
                : await createPool({ entryFee: form.entryFee, name, isActive: form.isActive, quickMatchEnabled: false, maxPlayers: 4 });
            toast.success(isEdit ? 'Entry fee updated' : 'Entry fee created');
            onSaved?.(res.data?.data);
            onClose();
        } catch (e) {
            setApiErr(e.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    return (
        <ModalShell title={isEdit ? 'Edit Entry Fee' : 'Create Entry Fee'}
            subtitle='Approved amounts players can choose for Private Room and Quick Match'
            onClose={onClose}
            footer={<ModalFooter onClose={onClose} onSubmit={submit} saving={saving} submitLabel={isEdit ? 'Save Changes' : '+ Create Entry Fee'} />}>
            <div className='space-y-1.5'>
                <label className={labelCls}>Entry Fee Amount (₹)</label>
                <input type='text' inputMode='decimal' autoFocus value={form.entryFee}
                    onChange={e => change('entryFee', e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder='e.g. 50' className={inputCls(error)} />
                {error && <p className='text-[10px] text-red-500'>{error}</p>}
            </div>
            <div className='space-y-1.5'>
                <label className={labelCls}>Label <span className='normal-case font-normal text-slate-400'>(optional)</span></label>
                <input type='text' value={form.name} onChange={e => change('name', e.target.value)}
                    placeholder={form.entryFee ? money(form.entryFee) : 'Defaults to the amount'} className={inputCls(false)} />
            </div>
            <div className='space-y-1.5'>
                <label className={labelCls}>Status</label>
                <EnabledPicker value={form.isActive} onChange={v => change('isActive', v)} />
                <p className='text-[10px] text-slate-400'>
                    Only enabled fees can be picked for a new Private Room or Quick Match. Disabling never removes matches that already exist.
                </p>
            </div>
            {apiErr && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiErr}</p>}
        </ModalShell>
    );
}

function FeeViewModal({ fee, onClose }) {
    const rows = [
        ['Entry Fee',    money(fee.entryFee)],
        ['Label',        fee.name],
        ['Status',       fee.isActive ? 'Enabled' : 'Disabled'],
        ['Quick Match',  fee.quickMatchEnabled ? `Enabled — ${fee.targetOpenMatches} initial match(es), ${fee.maxPlayers} players` : 'Not offered'],
        ['Matches now',  `${fee.roomCount} total, ${fee.openMatches} open`],
        ['Created',      fmtDate(fee.createdAt)],
        ['Last updated', fmtDate(fee.updatedAt)],
    ];
    return (
        <ModalShell title={`Entry Fee ${money(fee.entryFee)}`} subtitle={`ID: ${fee.id}`} onClose={onClose}
            footer={<button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>Close</button>}>
            <dl className='divide-y divide-slate-100'>
                {rows.map(([k, v]) => (
                    <div key={k} className='flex items-center justify-between py-2.5 text-sm'>
                        <dt className='text-slate-500'>{k}</dt>
                        <dd className='font-semibold text-slate-800 text-right'>{v}</dd>
                    </div>
                ))}
            </dl>
        </ModalShell>
    );
}

function DeactivateModal({ fee, onClose, onConfirm }) {
    const [busy, setBusy] = useState(false);
    const confirm = async () => { setBusy(true); await onConfirm(fee); setBusy(false); onClose(); };
    return (
        <ModalShell title='Deactivate Entry Fee' subtitle={money(fee.entryFee)} onClose={onClose}
            footer={<ModalFooter onClose={onClose} onSubmit={confirm} saving={busy} submitLabel='Deactivate' danger />}>
            <p className='text-sm text-slate-600'>
                Deactivate <b>{money(fee.entryFee)}</b>? Players will no longer see it in Quick Match or the Private Room fee list,
                and its matches can’t be joined. Matches that already have players keep running.
            </p>
            <p className='text-sm text-slate-600'>Activate it again and the same matches are available straight away.</p>
        </ModalShell>
    );
}

export default function EntryFees() {
    const [fees,    setFees]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [busyId,  setBusyId]  = useState(null);
    const [modal,   setModal]   = useState(null); // { type: 'create' | 'edit' | 'view' | 'deactivate', fee? }

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetchPools({ limit: 50, sortBy: 'entryFee', sortDir: 'asc' });
            setFees(res.data?.data?.pools || []);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load entry fees');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const flip = async fee => {
        setBusyId(fee.id);
        try {
            const res = await togglePool(fee.id);
            const next = res.data?.data;
            setFees(prev => prev.map(f => f.id === fee.id ? { ...f, ...next } : f));
            const n = next?.matchSummary?.total ?? 0;
            const label = `${n} match${n === 1 ? '' : 'es'}`;
            next?.isActive
                ? toast.success(`${money(fee.entryFee)} activated — ${label} available again`)
                : toast.warning(`${money(fee.entryFee)} deactivated — ${label} paused`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Toggle failed');
        } finally { setBusyId(null); }
    };

    // Turning a fee off takes its matches away from players, so confirm first; turning it on
    // is harmless and happens straight away.
    const requestToggle = fee => (fee.isActive ? setModal({ type: 'deactivate', fee }) : flip(fee));

    return (
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
            <div className='p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3'>
                <div>
                    <p className='text-sm font-bold text-slate-700'>Entry Fee Management</p>
                    <p className='text-xs text-slate-400 mt-0.5'>The approved amounts players can choose — used by both Private Room and Quick Match</p>
                </div>
                <button onClick={() => setModal({ type: 'create' })}
                    className='h-9 px-4 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shrink-0'>
                    <PlusIcon />Create Entry Fee
                </button>
            </div>

            {error ? (
                <div className='p-8 text-center'>
                    <p className='text-sm text-red-500'>{error}</p>
                    <button onClick={load} className='mt-2 text-xs text-indigo-500 hover:underline'>Retry</button>
                </div>
            ) : (
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm min-w-max'>
                        <thead>
                            <tr className='bg-slate-50 border-b-[1.5px] border-slate-200'>
                                {['Entry Fee', 'Status', 'Quick Match', 'Created', 'Actions'].map(h => (
                                    <th key={h} className='px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className='px-5 py-10 text-center text-xs text-slate-400'>Loading…</td></tr>
                            ) : fees.length === 0 ? (
                                <tr><td colSpan={5}>
                                    <div className='flex flex-col items-center justify-center py-16 gap-3'>
                                        <div className='text-slate-200'><EmptyIcon /></div>
                                        <p className='font-semibold text-slate-500 text-sm'>No entry fees yet</p>
                                        <p className='text-xs text-slate-400'>Create ₹5, ₹10, ₹25… — players can only pick amounts listed here.</p>
                                    </div>
                                </td></tr>
                            ) : fees.map(fee => (
                                <tr key={fee.id} className='border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors'>
                                    <td className='px-5 py-3.5'>
                                        <p className='font-bold text-slate-800 text-base'>{money(fee.entryFee)}</p>
                                        {fee.name !== money(fee.entryFee) && <p className='text-[10px] text-slate-400 mt-0.5'>{fee.name}</p>}
                                    </td>
                                    <td className='px-5 py-3.5'>
                                        <StatusPill active={fee.isActive} busy={busyId === fee.id} onClick={() => requestToggle(fee)} />
                                    </td>
                                    <td className='px-5 py-3.5 text-xs whitespace-nowrap'>
                                        {fee.quickMatchEnabled
                                            ? (fee.isActive
                                                ? <span className='text-emerald-700 font-semibold'>{fee.targetOpenMatches} match{fee.targetOpenMatches === 1 ? '' : 'es'} · {fee.maxPlayers} players</span>
                                                : <span className='text-amber-600 font-semibold'>{fee.targetOpenMatches} match{fee.targetOpenMatches === 1 ? '' : 'es'} · paused</span>)
                                            : <span className='text-slate-300'>Not offered</span>}
                                    </td>
                                    <td className='px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap'>{fmtDate(fee.createdAt)}</td>
                                    <td className='px-5 py-3.5'>
                                        <div className='flex items-center gap-1.5 flex-wrap'>
                                            <button onClick={() => requestToggle(fee)} disabled={busyId === fee.id}
                                                title={fee.isActive ? 'Hide this fee and pause its matches' : 'Show this fee and bring its matches back'}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border active:scale-95 transition-all disabled:opacity-60 ${
                                                    fee.isActive
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                                                <PowerIcon />{fee.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button onClick={() => setModal({ type: 'view', fee })}
                                                className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:scale-95 transition-all'>
                                                <ViewIcon />View
                                            </button>
                                            <button onClick={() => setModal({ type: 'edit', fee })}
                                                className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all'>
                                                <EditIcon />Edit
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal?.type === 'create' && <FeeModal onClose={() => setModal(null)} onSaved={load} />}
            {modal?.type === 'edit'   && <FeeModal fee={modal.fee} onClose={() => setModal(null)} onSaved={load} />}
            {modal?.type === 'view'   && <FeeViewModal fee={modal.fee} onClose={() => setModal(null)} />}
            {modal?.type === 'deactivate' && <DeactivateModal fee={modal.fee} onClose={() => setModal(null)} onConfirm={flip} />}
        </div>
    );
}
