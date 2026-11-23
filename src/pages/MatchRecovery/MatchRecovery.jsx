import { useState, useEffect, useCallback, useRef } from 'react';
import {
    fetchMatchRecovery, fetchMatchRecoveryDetail, executeMatchRecovery, newIdempotencyKey,
} from '../../api';
import { toast } from '../../toast';
import PageBtn from '../../components/PageBtn';

/* The ONLY three actions this page can send. Which one is offered is decided by the backend
   (availableAction / resumeAction) from the persisted match state - never by this page. */
const ACTIONS = {
    REFUND_ALL_ELIGIBLE_PLAYERS: { label: 'Refund All Eligible Players', tone: 'bg-indigo-600 hover:bg-indigo-700' },
    SETTLE_INTERRUPTED_MATCH:    { label: 'Settle Interrupted Match',    tone: 'bg-amber-600 hover:bg-amber-700' },
    COMPLETE_WINNER_SETTLEMENT:  { label: 'Complete Winner Settlement',  tone: 'bg-emerald-600 hover:bg-emerald-700' },
};
const STAGES = [
    { value: '', label: 'All stages' },
    { value: 'MATCH_JOINING', label: 'Match joining' },
    { value: 'MATCH_PLAYING', label: 'Match playing' },
    { value: 'WINNER_DISTRIBUTION', label: 'Winner distribution' },
];
const STATUSES = [
    { value: '', label: 'Needs attention' },
    { value: 'NEEDS_RECOVERY', label: 'Needs recovery' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'PARTIALLY_COMPLETED', label: 'Partially completed' },
    { value: 'FAILED', label: 'Failed' },
    { value: 'BLOCKED', label: 'Blocked (investigate)' },
    { value: 'RECOVERED', label: 'Recovered' },
];
const STATUS_STYLE = {
    NEEDS_RECOVERY: 'bg-red-50 text-red-700 border-red-200',
    IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
    PARTIALLY_COMPLETED: 'bg-amber-50 text-amber-700 border-amber-200',
    FAILED: 'bg-red-50 text-red-700 border-red-200',
    BLOCKED: 'bg-slate-100 text-slate-700 border-slate-300',
    RECOVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const money = v => `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = v => v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const errMsg = e => e.response?.data?.message || e.message || 'Request failed';

const selCls = 'h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';
const inpCls = 'h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';

const Badge = ({ status }) => status
    ? <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{status.replaceAll('_', ' ')}</span>
    : null;

const Field = ({ k, v }) => (
    <div className='min-w-0'>
        <p className='text-[11px] font-semibold uppercase tracking-wide text-slate-400'>{k}</p>
        <p className='text-sm text-slate-800 break-words'>{v ?? '—'}</p>
    </div>
);

/* ── Confirmation dialog: players, per-player amounts, total, financial result ── */
function ConfirmDialog({ match, action, onClose, onDone }) {
    const [reason, setReason] = useState('');
    const [ack, setAck] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const keyRef = useRef(newIdempotencyKey()); // same key for a double-click / retry of this dialog

    const meta = ACTIONS[action];
    const items = match.plan?.items || [];
    const resuming = !!match.resumeAction;
    const ok = ack && reason.trim().length >= 5 && !busy;

    const submit = async () => {
        setBusy(true); setErr('');
        try {
            const r = await executeMatchRecovery(match.roomId, { action, reason: reason.trim(), idempotencyKey: keyRef.current });
            if (r.data.data.completed) toast.success(`${meta.label}: completed and verified`);
            else toast.warning(`${meta.label}: only partly completed - review failed players and retry`);
            onDone();
        } catch (e) {
            setErr(errMsg(e));
        } finally { setBusy(false); }
    };

    return (
        <div className='fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4'>
            <div className='bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col'>
                <div className='px-6 py-4 border-b border-slate-100'>
                    <p className='text-base font-bold text-slate-800'>{meta.label}</p>
                    <p className='text-xs text-slate-500 mt-0.5'>Match {match.roomId} · stage {match.stage?.replaceAll('_', ' ')}</p>
                </div>
                <div className='px-6 py-4 space-y-4 overflow-y-auto'>
                    <div className='rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700'>
                        <p className='font-semibold text-slate-800 mb-1'>Financial result</p>
                        {match.financialResult}
                        {resuming && <p className='mt-1 text-amber-700'>This resumes an unfinished recovery. Players already paid are skipped by the server.</p>}
                    </div>

                    <div>
                        <p className='text-xs font-bold uppercase tracking-wide text-slate-500 mb-2'>Affected players</p>
                        {items.length === 0
                            ? <p className='text-sm text-slate-500'>{resuming ? 'The server will re-check each player and finish only what is missing.' : 'No money will move; only the missing records are completed.'}</p>
                            : <ul className='divide-y divide-slate-100 border border-slate-200 rounded-xl'>
                                {items.map(i => (
                                    <li key={i.userId} className='flex items-center justify-between px-3 py-2 text-sm'>
                                        <span className='truncate pr-3'>{i.username || i.userId}</span>
                                        <span className='font-semibold tabular-nums'>{money(i.amount)}</span>
                                    </li>))}
                            </ul>}
                        <div className='flex items-center justify-between mt-2 px-1 text-sm'>
                            <span className='font-semibold text-slate-600'>Total</span>
                            <span className='font-bold text-slate-900 tabular-nums'>{money(match.plan?.totalAmount)}</span>
                        </div>
                        <p className='text-[11px] text-slate-400 mt-1'>Amounts are recalculated by the server from the wallet ledger when you confirm.</p>
                    </div>

                    <div>
                        <label className='text-xs font-bold uppercase tracking-wide text-slate-500'>Reason (audit log)</label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={500}
                            placeholder='e.g. Server failure during match joining'
                            className='mt-1 w-full px-3 py-2 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:border-indigo-500' />
                    </div>
                    <label className='flex items-start gap-2 text-sm text-slate-700 cursor-pointer'>
                        <input type='checkbox' checked={ack} onChange={e => setAck(e.target.checked)} className='mt-1' />
                        I reviewed the players and amounts above and confirm this recovery.
                    </label>
                    {err && <p className='text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2'>{err}</p>}
                </div>
                <div className='px-6 py-4 border-t border-slate-100 flex justify-end gap-2'>
                    <button onClick={onClose} disabled={busy} className='h-9 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50'>Cancel</button>
                    <button onClick={submit} disabled={!ok} className={`h-9 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-40 ${meta.tone}`}>
                        {busy ? 'Working…' : meta.label}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Detail drawer ── */
function DetailPanel({ roomId, onClose, onChanged }) {
    const [m, setM] = useState(null);
    const [err, setErr] = useState('');
    const [confirm, setConfirm] = useState(null);

    const load = useCallback(() => {
        fetchMatchRecoveryDetail(roomId).then(r => setM(r.data.data)).catch(e => setErr(errMsg(e)));
    }, [roomId]);
    useEffect(() => { load(); }, [load]);

    // Only an action the server says is valid for this exact persisted state is ever shown.
    const action = m ? (m.resumeAction || m.availableAction) : null;

    return (
        <div className='fixed inset-0 bg-black/40 z-50 flex justify-end'>
            <div className='bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl'>
                <div className='sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10'>
                    <div>
                        <p className='text-sm font-bold text-slate-800'>Match {roomId}</p>
                        {m && <div className='mt-1'><Badge status={m.recoveryStatus} /></div>}
                    </div>
                    <button onClick={onClose} className='text-slate-500 hover:text-slate-800 text-xl px-2'>×</button>
                </div>
                {err && <p className='m-5 text-sm text-red-600'>{err}</p>}
                {!m && !err && <p className='m-5 text-sm text-slate-400'>Loading…</p>}
                {m && (
                    <div className='p-5 space-y-6'>
                        <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
                            <Field k='Match ID' v={m.matchId} />
                            <Field k='Room ID' v={m.roomId} />
                            <Field k='Failure stage' v={m.stage?.replaceAll('_', ' ')} />
                            <Field k='Current status' v={`${m.currentStatus} / ${m.gameStatus}`} />
                            <Field k='Previous status' v={m.previousStatus ? `${m.previousStatus}${m.previousStatusSource === 'inferred' ? ' (inferred)' : ''}` : '—'} />
                            <Field k='Players' v={`${m.playerCount} / ${m.maxPlayers}`} />
                            <Field k='Entry fee / player' v={money(m.entryFee)} />
                            <Field k='Total fees deducted' v={money(m.totalEntryFeesDeducted)} />
                            <Field k='Already refunded' v={money(m.amountAlreadyRefunded)} />
                            <Field k='Already distributed' v={money(m.amountAlreadyDistributed)} />
                            <Field k='Outstanding' v={money(m.outstandingAmount)} />
                            <Field k='Recorded winner' v={m.winner ? `${m.winner.username || m.winner.userId} (${m.winner.color})` : '—'} />
                            <Field k='Prize' v={m.prizeAmount ? money(m.prizeAmount) : '—'} />
                            <Field k='Commission' v={m.commission ? money(m.commission) : '—'} />
                            <Field k='Created' v={when(m.createdAt)} />
                            <Field k='Started' v={when(m.startedAt)} />
                            <Field k='Last activity' v={when(m.lastActivityAt)} />
                        </div>
                        {m.failureReason && <p className='text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3'><b>Failure reason:</b> {m.failureReason}</p>}
                        {m.blockedReason && <p className='text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3'><b>Blocked - manual investigation:</b> {m.blockedReason}</p>}

                        {m.verification?.length > 0 && (
                            <div>
                                <p className='text-xs font-bold uppercase tracking-wide text-slate-500 mb-2'>Result verification</p>
                                <ul className='space-y-1'>{m.verification.map(c => (
                                    <li key={c.name} className='text-sm flex gap-2'>
                                        <span className={c.ok ? 'text-emerald-600' : 'text-red-600'}>{c.ok ? '✓' : '✗'}</span>
                                        <span className='text-slate-700'>{c.name} <span className='text-slate-400'>({c.detail})</span></span>
                                    </li>))}</ul>
                            </div>
                        )}

                        <div>
                            <p className='text-xs font-bold uppercase tracking-wide text-slate-500 mb-2'>Players &amp; transactions</p>
                            <div className='space-y-3'>
                                {m.players.map(p => (
                                    <div key={p.userId} className='border border-slate-200 rounded-xl p-3'>
                                        <div className='flex flex-wrap items-center justify-between gap-2'>
                                            <p className='text-sm font-semibold text-slate-800'>{p.username || p.userId} <span className='text-xs font-normal text-slate-400'>{p.color || 'no seat'} · {p.playerType || '—'}</span></p>
                                            <p className='text-xs text-slate-500'>debited {money(p.entryDebited)} · refunded {money(p.refunded)} · prize {money(p.prizeCredited)}</p>
                                        </div>
                                        <p className='text-[11px] text-slate-400 break-all'>{p.userId}</p>
                                        <p className={`text-xs mt-1 ${p.eligible ? 'text-emerald-700' : 'text-slate-500'}`}>
                                            {p.eligible ? `Eligible: ${money(p.refundable)}` : (p.anomaly || p.ineligibleReason || 'Nothing to refund')}
                                        </p>
                                        {p.transactions.length > 0 && (
                                            <table className='w-full mt-2 text-xs'>
                                                <tbody>{p.transactions.map(t => (
                                                    <tr key={t.id} className='border-t border-slate-100'>
                                                        <td className='py-1 pr-2 font-semibold'>{t.type}</td>
                                                        <td className='py-1 pr-2'>{t.balanceType}</td>
                                                        <td className='py-1 pr-2 tabular-nums'>{money(t.amount)}</td>
                                                        <td className='py-1 pr-2'>{t.status}</td>
                                                        <td className='py-1 text-slate-400'>{when(t.createdAt)}</td>
                                                    </tr>))}</tbody>
                                            </table>)}
                                    </div>))}
                            </div>
                        </div>

                        {m.history?.length > 0 && (
                            <div>
                                <p className='text-xs font-bold uppercase tracking-wide text-slate-500 mb-2'>Recovery history</p>
                                <div className='space-y-2'>{m.history.map(h => (
                                    <div key={h.id} className='border border-slate-200 rounded-xl p-3 text-sm'>
                                        <div className='flex flex-wrap items-center justify-between gap-2'>
                                            <b>{ACTIONS[h.action]?.label || h.action}</b><Badge status={h.status === 'COMPLETED' ? 'RECOVERED' : h.status} />
                                        </div>
                                        <p className='text-xs text-slate-500'>by {h.admin.name || h.admin.id} · {when(h.createdAt)} · {money(h.totalAmount)}</p>
                                        <p className='text-xs text-slate-600 mt-1'>Reason: {h.reason}</p>
                                        <ul className='mt-1 text-xs text-slate-600'>{h.affectedUsers.map(u => (
                                            <li key={u.userId + u.kind}>{u.username || u.userId}: {money(u.amount)} - {u.status}{u.transactionId ? ` (tx ${u.transactionId.slice(0, 8)}…)` : ''}{u.error ? ` - ${u.error}` : ''}</li>))}</ul>
                                        {h.failureDetail && <p className='text-xs text-red-600 mt-1'>{h.failureDetail}</p>}
                                    </div>))}</div>
                            </div>
                        )}

                        {action && ACTIONS[action] && (
                            <div className='sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-100'>
                                <button onClick={() => setConfirm(action)}
                                    className={`h-10 px-5 rounded-xl text-sm font-semibold text-white ${ACTIONS[action].tone}`}>
                                    {m.resumeAction ? `Resume: ${ACTIONS[action].label}` : ACTIONS[action].label}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {confirm && m && (
                <ConfirmDialog match={m} action={confirm} onClose={() => setConfirm(null)}
                    onDone={() => { setConfirm(null); load(); onChanged(); }} />
            )}
        </div>
    );
}

export default function MatchRecovery() {
    const [rows, setRows] = useState([]);
    const [pg, setPg] = useState({ total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [f, setF] = useState({ failureStage: '', recoveryStatus: '', roomId: '', startDate: '', endDate: '' });
    const [open, setOpen] = useState(null);

    const load = useCallback(() => {
        setLoading(true); setError('');
        fetchMatchRecovery({ ...f, page, limit: 20 })
            .then(r => { setRows(r.data.data || []); setPg(r.data.pagination || { total: 0, totalPages: 1 }); })
            .catch(e => setError(errMsg(e)))
            .finally(() => setLoading(false));
    }, [f, page]);
    useEffect(() => { load(); }, [load]);

    const set = (k, v) => { setPage(1); setF(p => ({ ...p, [k]: v })); };

    return (
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
            <div className='p-5 border-b border-slate-100 space-y-4'>
                <div className='flex items-center justify-between'>
                    <div>
                        <p className='text-sm font-bold text-slate-700'>Match Recovery</p>
                        <p className='text-xs text-slate-400 mt-0.5'>Matches stuck after a server crash, restart or failed transaction. Nothing here runs automatically.</p>
                    </div>
                    <button onClick={load} className='h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:border-indigo-400'>Refresh</button>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <select className={selCls} value={f.failureStage} onChange={e => set('failureStage', e.target.value)}>{STAGES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    <select className={selCls} value={f.recoveryStatus} onChange={e => set('recoveryStatus', e.target.value)}>{STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    <input className={inpCls} placeholder='Room / match ID' value={f.roomId} onChange={e => set('roomId', e.target.value.trim())} />
                    <input type='date' className={inpCls} value={f.startDate} onChange={e => set('startDate', e.target.value)} />
                    <input type='date' className={inpCls} value={f.endDate} onChange={e => set('endDate', e.target.value)} />
                </div>
            </div>

            {error && <p className='m-5 text-sm text-red-600'>{error}</p>}
            <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead><tr className='text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100'>
                        {['Room', 'Failure stage', 'Status', 'Players', 'Fees deducted', 'Outstanding', 'Last activity', ''].map(h => <th key={h} className='px-4 py-3 font-semibold'>{h}</th>)}
                    </tr></thead>
                    <tbody>
                        {loading && <tr><td colSpan={8} className='px-4 py-8 text-center text-slate-400'>Loading…</td></tr>}
                        {!loading && rows.length === 0 && <tr><td colSpan={8} className='px-4 py-8 text-center text-slate-400'>No matches need recovery.</td></tr>}
                        {!loading && rows.map(r => (
                            <tr key={r.matchId} className='border-b border-slate-50 hover:bg-slate-50/60'>
                                <td className='px-4 py-3 font-semibold text-slate-800'>{r.roomId}</td>
                                <td className='px-4 py-3'>{r.stage?.replaceAll('_', ' ')}</td>
                                <td className='px-4 py-3'><Badge status={r.recoveryStatus} /></td>
                                <td className='px-4 py-3'>{r.playerCount}/{r.maxPlayers}</td>
                                <td className='px-4 py-3 tabular-nums'>{money(r.totalEntryFeesDeducted)}</td>
                                <td className='px-4 py-3 tabular-nums'>{money(r.outstandingAmount)}</td>
                                <td className='px-4 py-3 text-slate-500'>{when(r.lastActivityAt)}</td>
                                <td className='px-4 py-3 text-right'>
                                    <button onClick={() => setOpen(r.roomId)} className='h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'>
                                        Review
                                    </button>
                                </td>
                            </tr>))}
                    </tbody>
                </table>
            </div>
            {pg.totalPages > 1 && (
                <div className='flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500'>
                    <span>{pg.total} matches</span>
                    <div className='flex gap-1 items-center'>
                        <PageBtn disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</PageBtn>
                        <span className='px-2'>{page} / {pg.totalPages}</span>
                        <PageBtn disabled={page >= pg.totalPages} onClick={() => setPage(p => p + 1)}>›</PageBtn>
                    </div>
                </div>
            )}
            {open && <DetailPanel roomId={open} onClose={() => setOpen(null)} onChanged={load} />}
        </div>
    );
}
