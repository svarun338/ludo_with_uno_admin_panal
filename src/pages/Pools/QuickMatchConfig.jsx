import { useState, useEffect, useCallback } from 'react';
import { fetchPools, fetchPoolDetail, updatePool } from '../../api';
import { toast } from '../../toast';
import {
    PlusIcon, EditIcon, ViewIcon, EmptyIcon,
    selectCls, labelCls, money, stateBadge, StatusPill, EnabledPicker, ModalShell, ModalFooter,
} from './poolUi';

/* Quick Match is configured PER approved entry fee (Entry Fees section): how many matches
   are set up for that amount, and how many players each holds. Every fee has its own
   matches — a ₹5 match is never shared with a ₹50 one. */

const isConfigured = f => f.quickMatchEnabled || f.targetOpenMatches > 0;

// Every entry fee starts with exactly one open match; when it fills, the next one opens
// (the existing replenishment keeps this many open). It is not an admin setting.
const FIXED_INITIAL_MATCHES = 1;

function ConfigModal({ fees, fee, onClose, onSaved }) {
    const isEdit = !!fee;
    const choices = isEdit ? [fee] : fees.filter(f => !isConfigured(f));
    const [feeId,      setFeeId]      = useState(fee ? fee.id : (choices[0]?.id || ''));
    const [maxPlayers, setMaxPlayers] = useState(fee ? fee.maxPlayers : 4);
    const [enabled,    setEnabled]    = useState(fee ? fee.quickMatchEnabled : true);
    const [errors,     setErrors]     = useState({});
    const [apiErr,     setApiErr]     = useState('');
    const [saving,     setSaving]     = useState(false);

    const selected = fees.find(f => f.id === feeId);

    const submit = async () => {
        const e = {};
        if (!feeId) e.fee = 'Choose an entry fee';
        if (Object.keys(e).length) { setErrors(e); return; }
        setSaving(true);
        try {
            const res = await updatePool(feeId, { maxPlayers: Number(maxPlayers), targetOpenMatches: FIXED_INITIAL_MATCHES, quickMatchEnabled: enabled });
            toast.success(`Quick Match ${isEdit ? 'updated' : 'configured'} for ${money(selected.entryFee)}`);
            onSaved?.(res.data?.data);
            onClose();
        } catch (err) {
            setApiErr(err.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    return (
        <ModalShell title={isEdit ? 'Edit Quick Match' : 'Configure Quick Match'}
            subtitle='Matches players can find for one approved entry fee'
            onClose={onClose}
            footer={choices.length === 0 ? null : <ModalFooter onClose={onClose} onSubmit={submit} saving={saving} submitLabel={isEdit ? 'Save Changes' : 'Save Configuration'} />}>
            {choices.length === 0 ? (
                <p className='text-sm text-slate-600'>
                    Every approved entry fee already has a Quick Match configuration. Add a new amount under <b>Entry Fees</b> first.
                </p>
            ) : (
                <>
                    <div className='space-y-1.5'>
                        <label className={labelCls}>Entry Fee</label>
                        <select value={feeId} disabled={isEdit} onChange={e => { setFeeId(e.target.value); setErrors({}); }} className={selectCls}>
                            {choices.map(f => <option key={f.id} value={f.id}>{money(f.entryFee)}{f.isActive ? '' : ' (fee disabled)'}</option>)}
                        </select>
                        {errors.fee && <p className='text-[10px] text-red-500'>{errors.fee}</p>}
                        {selected && !selected.isActive && (
                            <p className='text-[10px] text-amber-600'>This fee is disabled under Entry Fees — players won’t see it until it is enabled.</p>
                        )}
                    </div>

                    <div className='space-y-1.5'>
                        <label className={labelCls}>Initial Matches</label>
                        <div className='h-10 px-3.5 flex items-center justify-between rounded-xl border-[1.5px] border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 select-none'>
                            <span>{FIXED_INITIAL_MATCHES}</span>
                            <span className='text-[10px] font-semibold uppercase tracking-wider text-slate-400'>Fixed</span>
                        </div>
                        <p className='text-[10px] text-slate-400'>
                            Every entry fee starts with 1 open match (0/{maxPlayers}). When it fills up, the next one opens automatically.
                        </p>
                    </div>

                    <div className='space-y-1.5'>
                        <label className={labelCls}>Players Per Match</label>
                        <div className='flex gap-2'>
                            {[2, 4].map(n => (
                                <button key={n} type='button' onClick={() => { setMaxPlayers(n); setApiErr(''); }}
                                    className={`flex-1 h-10 rounded-xl border-[1.5px] text-sm font-semibold transition-all ${
                                        Number(maxPlayers) === n ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    {n} Players
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='space-y-1.5'>
                        <label className={labelCls}>Quick Match Status</label>
                        <EnabledPicker value={enabled} onChange={setEnabled} />
                        <p className='text-[10px] text-slate-400'>Disabling hides this fee from Quick Match and rejects new joins. Matches that already have players are left alone.</p>
                    </div>

                    {apiErr && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiErr}</p>}
                </>
            )}
        </ModalShell>
    );
}

/* Match #1..#N for the selected entry fee, with live occupancy. */
function FeeMatches({ feeId, refreshKey }) {
    const [detail, setDetail]   = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetchPoolDetail(feeId);
            setDetail(res.data?.data || null);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load matches');
        } finally { setLoading(false); }
    }, [feeId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    return (
        <div className='border-t border-slate-100 p-4 sm:p-5'>
            <div className='flex items-center justify-between mb-3'>
                <div>
                    <p className='text-sm font-bold text-slate-700'>{detail ? `${money(detail.entryFee)} Quick Match` : 'Quick Match'}</p>
                    {detail && (
                        <p className='text-xs text-slate-400 mt-0.5'>
                            Configured matches: <b className='text-slate-600'>{detail.targetOpenMatches}</b> · {detail.maxPlayers} players ·{' '}
                            {detail.quickMatchEnabled ? 'Enabled' : 'Disabled'}
                        </p>
                    )}
                </div>
                <button onClick={load} disabled={loading}
                    className='px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-60'>
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>
            {detail?.paused && (
                <p className='mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg'>
                    Paused — this fee (or its Quick Match option) is switched off, so these matches are hidden from players and can’t be joined.
                    Matches with players keep running, and everything is back as soon as it is switched on.
                </p>
            )}
            {error && <p className='text-xs text-red-500'>{error}</p>}
            {!error && detail && detail.matches.length === 0 && (
                <p className='text-sm text-slate-400 py-6 text-center'>
                    No open matches for {money(detail.entryFee)}.{' '}
                    {detail.quickMatchEnabled && detail.targetOpenMatches > 0 ? '' : 'Enable Quick Match and set Initial Matches to create them.'}
                </p>
            )}
            {!error && detail && detail.matches.length > 0 && (
                <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
                    {detail.matches.map(m => (
                        <div key={m.roomId} className='border border-slate-200 rounded-xl p-3'>
                            <p className='text-[11px] font-semibold text-slate-500'>Match #{m.number}</p>
                            <p className='text-xl font-bold text-slate-800 mt-1'>{m.joinedPlayers}<span className='text-slate-300'>/{m.maxPlayers}</span></p>
                            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stateBadge(m.matchState)}`}>{m.matchState}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function QuickMatchConfig() {
    const [fees,     setFees]     = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [filterId, setFilterId] = useState('');
    const [busyId,   setBusyId]   = useState(null);
    const [modal,    setModal]    = useState(null); // { fee? }
    const [tick,     setTick]     = useState(0);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetchPools({ limit: 50, sortBy: 'entryFee', sortDir: 'asc' });
            setFees(res.data?.data?.pools || []);
            setTick(t => t + 1);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load Quick Match configuration');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const configured = fees.filter(isConfigured);
    const rows = filterId ? configured.filter(f => f.id === filterId) : configured;

    const flip = async fee => {
        setBusyId(fee.id);
        try {
            await updatePool(fee.id, { quickMatchEnabled: !fee.quickMatchEnabled });
            toast.success(`Quick Match ${fee.quickMatchEnabled ? 'disabled' : 'enabled'} for ${money(fee.entryFee)}`);
            await load();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Update failed');
        } finally { setBusyId(null); }
    };

    return (
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
            <div className='p-4 sm:p-5 space-y-4'>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <p className='text-sm font-bold text-slate-700'>Quick Match Configuration</p>
                        <p className='text-xs text-slate-400 mt-0.5'>Choose an approved entry fee, then how many matches it starts with and how many players each holds</p>
                    </div>
                    <button onClick={() => setModal({ fee: null })}
                        className='h-9 px-4 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shrink-0'>
                        <PlusIcon />Configure Fee
                    </button>
                </div>
                <div className='max-w-xs space-y-1.5'>
                    <label className={labelCls}>Filter by Entry Fee</label>
                    <select value={filterId} onChange={e => setFilterId(e.target.value)} className={selectCls}>
                        <option value=''>All entry fees</option>
                        {configured.map(f => <option key={f.id} value={f.id}>{money(f.entryFee)}</option>)}
                    </select>
                </div>
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
                            <tr className='bg-slate-50 border-y-[1.5px] border-slate-200'>
                                {['Entry Fee', 'Matches', 'Players', 'Open', 'Status', 'Actions'].map(h => (
                                    <th key={h} className='px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading && fees.length === 0 ? (
                                <tr><td colSpan={6} className='px-5 py-10 text-center text-xs text-slate-400'>Loading…</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={6}>
                                    <div className='flex flex-col items-center justify-center py-14 gap-3'>
                                        <div className='text-slate-200'><EmptyIcon /></div>
                                        <p className='font-semibold text-slate-500 text-sm'>No Quick Match configured yet</p>
                                        <p className='text-xs text-slate-400'>Use “Configure Fee” to pick an approved entry fee and set its matches.</p>
                                    </div>
                                </td></tr>
                            ) : rows.map(fee => (
                                <tr key={fee.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors ${filterId === fee.id ? 'bg-indigo-50/40' : ''}`}>
                                    <td className='px-5 py-3.5'>
                                        <span className='font-bold text-slate-800'>{money(fee.entryFee)}</span>
                                        {!fee.isActive && <span className='ml-2 text-[10px] font-semibold text-amber-600'>fee disabled</span>}
                                    </td>
                                    <td className='px-5 py-3.5 text-slate-700 font-semibold'>{fee.targetOpenMatches}</td>
                                    <td className='px-5 py-3.5 text-slate-600'>{fee.maxPlayers}</td>
                                    <td className='px-5 py-3.5'>
                                        <span className={`font-semibold ${fee.targetOpenMatches > 0 && fee.openMatches < fee.targetOpenMatches ? 'text-amber-600' : 'text-emerald-700'}`}>{fee.openMatches}</span>
                                    </td>
                                    <td className='px-5 py-3.5'>
                                        <StatusPill active={fee.quickMatchEnabled} busy={busyId === fee.id} onClick={() => flip(fee)} />
                                    </td>
                                    <td className='px-5 py-3.5'>
                                        <div className='flex items-center gap-1.5'>
                                            <button onClick={() => setFilterId(filterId === fee.id ? '' : fee.id)}
                                                className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:scale-95 transition-all'>
                                                <ViewIcon />{filterId === fee.id ? 'Hide' : 'Matches'}
                                            </button>
                                            <button onClick={() => setModal({ fee })}
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

            {filterId && <FeeMatches feeId={filterId} refreshKey={tick} />}

            {modal && <ConfigModal fees={fees} fee={modal.fee} onClose={() => setModal(null)} onSaved={load} />}
        </div>
    );
}
