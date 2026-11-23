import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchMatches, fetchMatchSummary, fetchMatchDetail, fetchMatchRefunds } from '../../api';
import TimezoneSelect from '../../components/TimezoneSelect';
import { useTimezone, getTz, todayIn, fmtDateTimeIn, dayRangeText } from '../../utils/timezone';
import PageBtn from '../../components/PageBtn';

const money = n => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
// Old (browser timezone): const dt = iso => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const dt = iso => fmtDateTimeIn(iso, getTz()); // in the chosen timezone (IST default / UTC)
const PAGE_SIZES = [10, 20, 50, 100];

const STATUS_STYLE = {
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PLAYING:   'bg-indigo-50 text-indigo-700 border-indigo-200',
    READY:     'bg-sky-50 text-sky-700 border-sky-200',
    WAITING:   'bg-amber-50 text-amber-700 border-amber-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200',
};
const TX_STYLE = {
    GAME_ENTRY: 'text-red-600',
    GAME_WIN:   'text-emerald-600',
    ROLLBACK:   'text-sky-600',
};
const TX_LABEL = { GAME_ENTRY: 'Entry fee', GAME_WIN: 'Winnings', ROLLBACK: 'Refund' };

const selCls = 'w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';
const lblCls = 'text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5';

// Word for the table's match count, e.g. "64 settled matches".
const STATUS_WORD = { SETTLED: 'settled ', CANCELLED: 'cancelled ', ACTIVE: 'playing ', WAITING: 'waiting ', UNPAID: 'unpaid ' };
const STATUS_LABEL = { COMPLETED: 'Settled', PLAYING: 'Playing', READY: 'Playing', WAITING: 'Waiting', CANCELLED: 'Cancelled' };
// unpaid = finished but the prize was not paid (escrow not distributed)
function Badge({ status, unpaid }) {
    if (unpaid) return <span className='inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border bg-red-50 text-red-700 border-red-200'>Not paid</span>;
    return <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{STATUS_LABEL[status] || status}</span>;
}

// When the match was really played: finished / cancelled time, else start time. Quick Match rooms
// are opened days earlier and wait for players, so the room's open date is shown only as a small note.
const dayKey = v => new Date(v).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
function PlayedOn({ m }) {
    const when = m.completedAt || m.cancelledAt || m.startedAt;
    const label = m.completedAt ? 'Finished' : m.cancelledAt ? 'Cancelled' : m.startedAt ? 'Started' : null;
    return (
        <div>
            {when ? <p className='text-slate-700'>{dt(when)}</p> : <p className='text-slate-400'>Not started</p>}
            {label && <p className='text-[10px] text-slate-400'>{label}</p>}
            {(!when || dayKey(when) !== dayKey(m.createdAt)) && <p className='text-[10px] text-slate-400'>Room opened {dt(m.createdAt)}</p>}
        </div>
    );
}

export function WhoTag({ isBot }) {
    return isBot
        ? <span className='px-1.5 py-px rounded text-[10px] font-bold bg-violet-100 text-violet-700'>BOT</span>
        : <span className='px-1.5 py-px rounded text-[10px] font-bold bg-slate-100 text-slate-600'>USER</span>;
}

// The level a bot actually played this match (the difficulty policy's choice, else its own).
const DIFFICULTY_STYLE = {
    EASY:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
    HARD:   'bg-red-50 text-red-700 border-red-200',
};
export function DifficultyTag({ level }) {
    if (!level) return null;
    return (
        <span title={`Bot difficulty: ${level}`}
            className={`px-1.5 py-px rounded border text-[9px] font-bold uppercase tracking-wide ${DIFFICULTY_STYLE[level] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            {level}
        </span>
    );
}

function Card({ label, value, sub, tone = 'text-slate-800' }) {
    return (
        <div className='bg-white rounded-2xl border border-slate-100 shadow-sm p-4'>
            <p className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</p>
            <p className={`text-xl font-bold mt-1 ${tone}`}>{value}</p>
            {sub && <p className='text-xs text-slate-400 mt-1'>{sub}</p>}
        </div>
    );
}

// 'YYYY-MM-DD' -> '27 Oct 2026'
const dayText = v => { const [y, mo, d] = v.split('-').map(Number); return new Date(y, mo - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
function periodText(from, to) {
    if (!from && !to) return 'All dates';
    if (from && to) return from === to ? dayText(from) : `${dayText(from)} – ${dayText(to)}`;
    return from ? `From ${dayText(from)}` : `Up to ${dayText(to)}`;
}

// One clickable status card: shows how many matches and filters the table to them.
function StatusCard({ label, value, sub, tone, active, onClick, warn }) {
    return (
        <button type='button' onClick={onClick}
            className={`text-left rounded-2xl border shadow-sm p-4 transition-all hover:border-indigo-300 ${warn ? 'bg-red-50' : 'bg-white'} ${active ? 'border-indigo-500 ring-4 ring-indigo-500/10' : warn ? 'border-red-200' : 'border-slate-100'}`}>
            <p className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</p>
            <p className={`text-2xl font-bold mt-1 ${tone}`}>{Number(value).toLocaleString()}</p>
            <p className='text-xs text-slate-400 mt-1'>{sub}</p>
        </button>
    );
}

// Top of the page. Every number follows the same filters as the table (dates, type, players, search),
// so the cards and the list always agree. Cards = status; click one to show only those matches.
function Summary({ s, status, onStatus, filterText }) {
    if (!s) return (
        <div className='grid grid-cols-2 lg:grid-cols-5 gap-3'>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className='h-24 bg-white rounded-2xl border border-slate-100 animate-pulse' />)}
        </div>
    );
    // An API started before this change does not send `view` yet - say so instead of breaking the page.
    if (!s.view) return (
        <div className='p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-800'>
            The backend API is running old code. Restart the API server to see the match cards. The table below still works.
        </div>
    );
    const v = s.view;
    const st = v.settled;
    const tone = n => n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-slate-700';
    const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
    const notRefunded = v.cancelled.held;
    const liveHeld = v.playing.held + v.waiting.held;
    return (
        <div className='space-y-3'>
            <p className='text-sm text-slate-600'>Showing: <b className='text-slate-800'>{filterText}</b></p>

            {/* 1. How many matches, by status. Click a card to show only those matches below. */}
            <div className={`grid grid-cols-2 ${v.unpaid.matches ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3`}>
                <StatusCard label='All matches' value={v.all} tone='text-slate-800' sub='Every status' active={status === ''} onClick={() => onStatus('')} />
                <StatusCard label='Settled' value={v.settled.matches} tone='text-emerald-600' sub='Finished & prize paid' active={status === 'SETTLED'} onClick={() => onStatus('SETTLED')} />
                <StatusCard label='Cancelled' value={v.cancelled.matches} tone='text-red-600' sub={`${money(v.cancelled.refunds)} refunded`} active={status === 'CANCELLED'} onClick={() => onStatus('CANCELLED')} />
                <StatusCard label='Playing' value={v.playing.matches} tone='text-indigo-600' sub={v.playing.held ? `${money(v.playing.held)} in play` : 'In a game now'} active={status === 'ACTIVE'} onClick={() => onStatus('ACTIVE')} />
                <StatusCard label='Waiting' value={v.waiting.matches} tone='text-amber-600' sub={v.waiting.held ? `${money(v.waiting.held)} joined` : 'Waiting for players'} active={status === 'WAITING'} onClick={() => onStatus('WAITING')} />
                {v.unpaid.matches > 0 && <StatusCard warn label='Prize not paid' value={v.unpaid.matches} tone='text-red-600' sub='Finished - fix in Match Recovery' active={status === 'UNPAID'} onClick={() => onStatus('UNPAID')} />}
            </div>

            {/* 2. Money of the settled matches only - same rule and same numbers as Profit & Loss.
                One small table: who joined with how much, how much came back, and the result. */}
            <div className='bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden'>
                <div className='px-4 py-3 border-b border-slate-100 flex flex-wrap items-baseline justify-between gap-2'>
                    <p className='text-sm font-bold text-slate-700'>
                        Money · settled matches only
                        <span className='font-normal text-slate-400'> · {st.matches.toLocaleString()} match{st.matches === 1 ? '' : 'es'} · same as Profit &amp; Loss</span>
                    </p>
                    <p className={`text-sm font-bold ${tone(st.platformProfit)}`}>{st.platformProfit < 0 ? 'Platform loss' : 'Platform profit'} {signed(st.platformProfit)}</p>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm min-w-[560px]'>
                        <thead>
                            <tr className='bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500'>
                                <th className='px-4 py-2 text-left font-bold'></th>
                                <th className='px-4 py-2 text-right font-bold'>Joined</th>
                                <th className='px-4 py-2 text-right font-bold'>Won</th>
                                {st.refunds > 0 && <th className='px-4 py-2 text-right font-bold'>Refunded</th>}
                                <th className='px-4 py-2 text-right font-bold'>Result</th>
                            </tr>
                        </thead>
                        <tbody className='tabular-nums'>
                            {[['Users', st.users], ['Bots', st.bots]].map(([who, x]) => (
                                <tr key={who} className='border-t border-slate-100'>
                                    <td className='px-4 py-2.5 font-semibold text-slate-700'>{who}</td>
                                    <td className='px-4 py-2.5 text-right text-slate-700'>{money(x.entry)}</td>
                                    <td className='px-4 py-2.5 text-right text-emerald-600'>{money(x.winnings)}</td>
                                    {st.refunds > 0 && <td className='px-4 py-2.5 text-right text-sky-600'>{money(x.refunds)}</td>}
                                    <td className={`px-4 py-2.5 text-right font-bold ${tone(x.net)}`}>{signed(x.net)} <span className='text-xs font-normal text-slate-400'>{x.net < 0 ? 'lost' : x.net > 0 ? 'won' : ''}</span></td>
                                </tr>
                            ))}
                            <tr className='border-t-2 border-slate-200 bg-slate-50/60'>
                                <td className='px-4 py-2.5 font-bold text-slate-800'>Total</td>
                                <td className='px-4 py-2.5 text-right font-bold text-slate-800'>{money(st.entry)}</td>
                                <td className='px-4 py-2.5 text-right font-bold text-emerald-600'>{money(st.winnings)}</td>
                                {st.refunds > 0 && <td className='px-4 py-2.5 text-right font-bold text-sky-600'>{money(st.refunds)}</td>}
                                <td className='px-4 py-2.5 text-right font-bold text-indigo-600'>{money(st.commission)} <span className='text-xs font-normal text-slate-400'>commission</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className='px-4 py-3 border-t border-slate-100 text-sm text-slate-600'>
                    Platform {st.platformProfit < 0 ? 'loss' : 'profit'} = Commission <b className='text-indigo-600'>{money(st.commission)}</b>
                    {' '}{st.bots.net < 0 ? '−' : '+'} Bots {st.bots.net < 0 ? 'lost' : 'won'} <b className={tone(st.bots.net)}>{money(Math.abs(st.bots.net))}</b>
                    {' '}= <b className={tone(st.platformProfit)}>{signed(st.platformProfit)}</b>
                    {(notRefunded > 0 || liveHeld > 0) && (
                        <div className='mt-1.5 space-y-0.5 text-xs'>
                            {liveHeld > 0 && <p className='text-slate-500'>{money(liveHeld)} is inside matches still playing or waiting. It counts once they finish.</p>}
                            {notRefunded > 0 && <p className='text-red-600 font-semibold'>⚠ {money(notRefunded)} paid into cancelled matches was not refunded. Click Cancelled and open those matches to check.</p>}
                        </div>
                    )}
                </div>
            </div>
            {s.checks && s.checks.transactionsWithoutMatch.count > 0 && (
                <p className='text-xs text-red-700 font-semibold px-1'>⚠ {s.checks.transactionsWithoutMatch.count} game transaction(s) ({money(s.checks.transactionsWithoutMatch.amount)}) belong to no match - check them.</p>
            )}
        </div>
    );
}

// What happened to one player, in plain words. Display only — the stored status is unchanged.
// FORFEITED = quit or dropped out mid-game; LEFT = left the room before the game started.
// WON / LOST only once the match has finished; while it is live the real status is shown.
const RESULT_STYLE = {
    WON:                 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LOST:                'bg-red-50 text-red-700 border-red-200',
    'EXITED MATCH':      'bg-orange-50 text-orange-700 border-orange-200',
    'LEFT BEFORE START': 'bg-slate-100 text-slate-500 border-slate-200',
};
function playerResult(p, d) {
    if (p.status === 'FORFEITED') return 'EXITED MATCH';
    if (p.status === 'LEFT') return 'LEFT BEFORE START';
    if (d.roomStatus === 'COMPLETED') {
        const won = p.money.win > 0 || (d.winnerColor && p.color === d.winnerColor);
        return won ? 'WON' : 'LOST';
    }
    return p.status;
}
function PlayerResult({ p, d }) {
    const r = playerResult(p, d);
    const style = RESULT_STYLE[r];
    if (!style) return <span className='text-xs text-slate-500'>{r}</span>;
    return <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap ${style}`}>{r}</span>;
}

export function DetailDrawer({ matchId, onClose }) {
    useTimezone(); // re-render the times when IST / UTC changes
    const [d, setD] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => {
        setD(null); setErr('');
        fetchMatchDetail(matchId).then(r => setD(r.data.data)).catch(e => setErr(e.response?.data?.message || 'Failed to load match'));
    }, [matchId]);

    return (
        <div className='fixed inset-0 z-[60] flex justify-end'>
            <div className='absolute inset-0 bg-slate-900/40' onClick={onClose} />
            <div className='relative w-full max-w-2xl h-full bg-slate-50 overflow-y-auto shadow-2xl'>
                <div className='sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10'>
                    <div>
                        <p className='text-xs text-slate-400'>Match</p>
                        <p className='text-base font-bold text-slate-800 font-mono'>{matchId}</p>
                    </div>
                    <button onClick={onClose} className='h-9 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100'>Close</button>
                </div>

                {err && <p className='p-5 text-sm text-red-600'>{err}</p>}
                {!d && !err && <div className='p-5 space-y-3'>{[1,2,3].map(i => <div key={i} className='h-28 bg-white rounded-2xl animate-pulse' />)}</div>}

                {d && (
                    <div className='p-5 space-y-4'>
                        <div className='bg-white rounded-2xl border border-slate-100 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm'>
                            <Info k='Status' v={<Badge status={d.roomStatus} />} />
                            <Info k='Type' v={d.type === 'PRIVATE' ? `Private${d.roomCode ? ` (${d.roomCode})` : ''}` : 'Quick Match'} />
                            <Info k='Pool' v={d.pool?.name || '—'} />
                            <Info k='Entry fee' v={money(d.entryFee)} />
                            <Info k='Players' v={`${d.joinedPlayers} / ${d.maxPlayers}`} />
                            <Info k='Created by' v={d.createdBy?.name} />
                            <Info k='Created' v={dt(d.createdAt)} />
                            <Info k='Started' v={dt(d.startedAt)} />
                            <Info k={d.cancelledAt ? 'Cancelled' : 'Completed'} v={dt(d.cancelledAt || d.completedAt)} />
                            {d.cancelReason && <div className='col-span-2 sm:col-span-3'><Info k='Cancel reason' v={d.cancelReason} /></div>}
                        </div>

                        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                            <Card label='Join fees' value={money(d.totals.entry)}
                                sub={d.totals.refunds > 0 ? `(${money(d.totals.entry - d.totals.refunds)} joined + ${money(d.totals.refunds)} refunded)` : null} />
                            <Card label='Winnings' value={money(d.totals.winnings)} tone='text-emerald-600' />
                            <Card label='Refunds' value={money(d.totals.refunds)} tone='text-sky-600' />
                            <Card label='Commission' value={money(d.escrow?.status === 'DISTRIBUTED' ? d.escrow.platformFee : 0)} tone='text-indigo-600'
                                sub={d.winConfig ? `${d.winConfig.platformFeePercent}% fee` : null} />
                        </div>

                        <div className='bg-white rounded-2xl border border-slate-100 overflow-hidden'>
                            <p className='px-4 py-3 text-sm font-bold text-slate-700 border-b border-slate-100'>Who joined ({d.players.length})</p>
                            <div className='overflow-x-auto'>
                                <table className='w-full text-sm min-w-[560px]'>
                                    <thead><tr className='bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wider'>
                                        {['Player', 'Color', 'Status', 'Entry', 'Won', 'Refund', 'Net'].map(h => <th key={h} className='px-3 py-2 text-left font-bold'>{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {d.players.map(p => (
                                            <tr key={p.userId} className='border-t border-slate-50'>
                                                <td className='px-3 py-2.5'>
                                                    <div className='flex items-center gap-1.5'>
                                                        <WhoTag isBot={p.isBot} />
                                                        <Link to={p.isBot ? `/dashboard/boats/${p.userId}` : `/dashboard/users/${p.userId}`} className='font-semibold text-slate-800 hover:text-indigo-600 truncate max-w-[140px]'>{p.name}</Link>
                                                        {p.isBot && <DifficultyTag level={p.botDifficulty} />}
                                                    </div>
                                                    {(p.email || p.mobile) && <p className='text-[10px] text-slate-400'>{p.email || p.mobile}</p>}
                                                </td>
                                                <td className='px-3 py-2.5 capitalize text-slate-600'>{p.color || '—'}</td>
                                                <td className='px-3 py-2.5'><PlayerResult p={p} d={d} /></td>
                                                <td className='px-3 py-2.5 text-red-600'>{money(p.money.entry)}</td>
                                                <td className='px-3 py-2.5 text-emerald-600'>{money(p.money.win)}</td>
                                                <td className='px-3 py-2.5 text-sky-600'>{money(p.money.refund)}</td>
                                                <td className={`px-3 py-2.5 font-bold ${p.money.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.money.net >= 0 ? '+' : '−'}{money(Math.abs(p.money.net))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className='bg-white rounded-2xl border border-slate-100 overflow-hidden'>
                            <p className='px-4 py-3 text-sm font-bold text-slate-700 border-b border-slate-100'>Transactions ({d.transactions.length})</p>
                            {d.transactions.length === 0 ? <p className='px-4 py-6 text-sm text-slate-400'>No money moved for this match.</p> : (
                                <div className='overflow-x-auto'>
                                    <table className='w-full text-sm min-w-[560px]'>
                                        <thead><tr className='bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wider'>
                                            {['Time', 'Player', 'Type', 'Amount', 'Status'].map(h => <th key={h} className='px-3 py-2 text-left font-bold'>{h}</th>)}
                                        </tr></thead>
                                        <tbody>
                                            {d.transactions.map(t => (
                                                <tr key={t.id} className='border-t border-slate-50'>
                                                    <td className='px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap'>{dt(t.createdAt)}</td>
                                                    <td className='px-3 py-2.5'><div className='flex items-center gap-1.5'><WhoTag isBot={t.user.isBot} /><span className='text-slate-700 truncate max-w-[130px]'>{t.user.name}</span></div></td>
                                                    <td className='px-3 py-2.5 text-xs text-slate-600'>{TX_LABEL[t.type] || t.type.replace(/_/g, ' ')}</td>
                                                    <td className={`px-3 py-2.5 font-bold ${TX_STYLE[t.type] || 'text-slate-700'}`}>{t.type === 'GAME_ENTRY' ? '−' : '+'}{money(t.amount)}</td>
                                                    <td className='px-3 py-2.5 text-xs text-slate-500'>{t.status}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Info({ k, v }) {
    return <div><p className='text-[11px] text-slate-400 uppercase tracking-wider font-semibold'>{k}</p><div className='text-slate-700 font-medium mt-0.5'>{v ?? '—'}</div></div>;
}

// Refunds of the matches shown with the current filters: who got money back, how much, when and why.
const REASON = {
    LEFT_BEFORE_START: { label: 'Left before start', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    CANCELLED:         { label: 'Match cancelled',   cls: 'bg-red-50 text-red-700 border-red-200' },
    OTHER:             { label: 'Other',             cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};
// One plain sentence for each refund.
function refundText(r) {
    const p = r.player;
    if (r.reason === 'CANCELLED') return 'The match was cancelled, so the entry fee was given back.';
    if (r.reason === 'LEFT_BEFORE_START') {
        if (p.playedAfterRejoin) return `Left the room before the game started and got the fee back. Joined again later and played${p.won ? ' and won' : ''} (paid ${p.paid}×, refunded ${p.refunded}×).`;
        return r.roomStatus === 'CANCELLED'
            ? 'Left the room before the game started and got the fee back. The match was cancelled later.'
            : 'Left the room before the game started and got the fee back. Did not play this match.';
    }
    return r.description || 'Refund';
}

function RefundsSection({ filters, onOpen }) {
    const [d, setD] = useState(null);
    const [page, setPage] = useState(1);
    const [err, setErr] = useState('');
    const key = JSON.stringify(filters);
    useEffect(() => { setPage(1); }, [key]);
    useEffect(() => {
        setD(null); setErr('');
        fetchMatchRefunds({ ...filters, page, limit: 10 })
            .then(r => setD({ rows: r.data.data.rows, totals: r.data.data.totals, pg: r.data.pagination }))
            .catch(e => setErr(e.response?.data?.message || 'Failed to load refunds'));
    }, [key, page]); // eslint-disable-line react-hooks/exhaustive-deps

    const t = d?.totals;
    const pg = d?.pg || { page: 1, totalPages: 1, total: 0, limit: 10 };
    return (
        <details className='bg-white rounded-2xl border border-slate-100 shadow-sm group'>
            <summary className='px-5 py-3.5 cursor-pointer list-none flex flex-wrap items-center justify-between gap-2'>
                <span>
                    <span className='text-sm font-bold text-slate-700'>Refunds</span>
                    <span className='block text-xs text-slate-400 mt-0.5'>Money given back to players in these matches - click to see who, how much and why</span>
                </span>
                <span className='flex items-center gap-3'>
                    {t ? <span className='text-sm font-bold text-sky-600'>{money(t.amount)} <span className='font-normal text-slate-400'>· {t.count} refund{t.count === 1 ? '' : 's'}</span></span>
                        : err ? <span className='text-xs text-red-600'>{err}</span> : <span className='text-xs text-slate-400'>Loading…</span>}
                    <span className='text-slate-400 text-xs group-open:rotate-180 transition-transform'>▼</span>
                </span>
            </summary>
            <div className='border-t border-slate-100'>
                {t && t.count > 0 && (
                    <div className='px-5 py-3 flex flex-wrap gap-2 text-xs'>
                        {t.leftBeforeStart.count > 0 && <span className='px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-semibold'>Left before start: {t.leftBeforeStart.count} · {money(t.leftBeforeStart.amount)}</span>}
                        {t.cancelled.count > 0 && <span className='px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-semibold'>Match cancelled: {t.cancelled.count} · {money(t.cancelled.amount)}</span>}
                        {t.other.count > 0 && <span className='px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold'>Other: {t.other.count} · {money(t.other.amount)}</span>}
                    </div>
                )}
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm min-w-[900px]'>
                        <thead><tr className='bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500'>
                            {['Time', 'Match', 'Player', 'Refund', 'Why', 'What happened'].map(h => <th key={h} className='px-4 py-2.5 text-left font-bold whitespace-nowrap'>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {!d && !err && <tr><td colSpan={6} className='px-4 py-6 text-center text-slate-400 text-xs'>Loading…</td></tr>}
                            {d && d.rows.length === 0 && <tr><td colSpan={6} className='px-4 py-8 text-center text-slate-400'>No refunds in these matches.</td></tr>}
                            {d && d.rows.map(r => (
                                <tr key={r.id} className='border-t border-slate-50 align-top hover:bg-indigo-50/40 cursor-pointer' onClick={() => onOpen(r.roomId)}>
                                    <td className='px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap'>{dt(r.createdAt)}</td>
                                    <td className='px-4 py-2.5'>
                                        <p className='font-mono text-xs font-bold text-indigo-600'>{r.roomId}</p>
                                        <p className='text-[10px] text-slate-400'>{STATUS_LABEL[r.roomStatus] || r.roomStatus} · fee {money(r.entryFee)}</p>
                                    </td>
                                    <td className='px-4 py-2.5'>
                                        <div className='flex items-center gap-1.5'><WhoTag isBot={r.user.isBot} /><span className='text-slate-700 truncate max-w-[140px]'>{r.user.name}</span></div>
                                        {r.user.contact && <p className='text-[10px] text-slate-400'>{r.user.contact}</p>}
                                    </td>
                                    <td className='px-4 py-2.5 font-bold text-sky-600 whitespace-nowrap'>{money(r.amount)}</td>
                                    <td className='px-4 py-2.5'><span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap ${REASON[r.reason]?.cls}`}>{REASON[r.reason]?.label}</span></td>
                                    <td className='px-4 py-2.5 text-xs text-slate-500 min-w-[280px]'>{refundText(r)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {pg.total > 0 && (
                    <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100'>
                        <span className='text-xs text-slate-500'>Showing <b className='text-slate-700'>{(pg.page - 1) * pg.limit + 1}–{Math.min(pg.page * pg.limit, pg.total)}</b> of <b className='text-slate-700'>{pg.total}</b> · click a row to open the match</span>
                        {pg.totalPages > 1 && (
                            <div className='flex items-center gap-1.5'>
                                <PageBtn onClick={() => setPage(p => p - 1)} disabled={pg.page === 1}>‹</PageBtn>
                                <span className='text-xs text-slate-500 px-1'>Page {pg.page} of {pg.totalPages}</span>
                                <PageBtn onClick={() => setPage(p => p + 1)} disabled={pg.page === pg.totalPages}>›</PageBtn>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </details>
    );
}

export default function Matches() {
    const [summary, setSummary] = useState(null);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState(null);

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    // Opens on settled matches - the same matches the money box counts. Old: useState('')
    const [status, setStatus] = useState('SETTLED');
    const [type, setType] = useState('');
    const [players, setPlayers] = useState('');
    // Old (all dates by default): const [fromDate, setFromDate] = useState(''); const [toDate, setToDate] = useState('');
    const [fromDate, setFromDate] = useState(() => todayIn(getTz())); // default: today
    const [toDate, setToDate] = useState(() => todayIn(getTz()));
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const tz = useTimezone(); // IST (default) or UTC
    // Dates start at today. If they are still "today" when IST / UTC is switched, move them to that timezone's today.
    const prevTz = useRef(tz);
    useEffect(() => {
        const oldToday = todayIn(prevTz.current);
        prevTz.current = tz;
        if (fromDate === oldToday && toDate === oldToday) { setFromDate(todayIn(tz)); setToDate(todayIn(tz)); setPage(1); }
    }, [tz]); // eslint-disable-line react-hooks/exhaustive-deps
    const today = todayIn(tz);
    const [refreshKey, setRefreshKey] = useState(0); // Refresh button: bump to load again

    useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400); return () => clearTimeout(t); }, [searchInput]);

    useEffect(() => {
        setSummary(null);
        fetchMatchSummary({ startDate: fromDate, endDate: toDate, type, players, search, tz }).then(r => setSummary(r.data.data)).catch(() => {});
    }, [fromDate, toDate, type, players, search, tz, refreshKey]);

    const doFetch = useCallback(() => {
        setLoading(true); setError('');
        fetchMatches({ page, limit, status, type, players, search, startDate: fromDate, endDate: toDate, tz })
            .then(r => {
                setRows(r.data.data || []);
                setTotal(r.data.pagination?.total || 0);
                setPages(r.data.pagination?.totalPages || 1);
            })
            .catch(e => setError(e.response?.data?.message || 'Failed to load matches'))
            .finally(() => setLoading(false));
    }, [page, limit, status, type, players, search, fromDate, toDate, tz, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { doFetch(); }, [doFetch]);

    const hasFilters = status !== 'SETTLED' || type || players || search || fromDate !== today || toDate !== today;
    // Back to the page's start: today's settled matches.
    const clearFilters = () => { setStatus('SETTLED'); setType(''); setPlayers(''); setSearchInput(''); setSearch(''); setFromDate(today); setToDate(today); setPage(1); };
    const allDates = () => { setFromDate(''); setToDate(''); setPage(1); };

    const pageNums = useMemo(() =>
        Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
            .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…'); acc.push(p); return acc; }, []),
        [pages, page]);

    const set = fn => e => { fn(e.target.value); setPage(1); };

    // Plain words for what the cards and table are showing right now.
    const filterText = [
        periodText(fromDate, toDate),
        type === 'quick' ? 'Quick Match' : type === 'private' ? 'Private' : null,
        players === 'with_bots' ? 'with bots' : players === 'humans_only' ? 'users only' : null,
        search ? `"${search}"` : null,
    ].filter(Boolean).join(' · ');
    const firstRow = total ? (page - 1) * limit + 1 : 0;
    const lastRow = Math.min(page * limit, total);

    return (
        <div className='space-y-4'>
            <Summary s={summary} status={status} onStatus={v => { setStatus(v); setPage(1); }} filterText={filterText} />

            <RefundsSection filters={{ status, type, players, search, startDate: fromDate, endDate: toDate }} onOpen={setOpenId} />

            <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
                <div className='p-5 border-b border-slate-100 space-y-4'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <p className='text-sm font-bold text-slate-700'>Matches</p>
                            <p className='text-xs text-slate-400 mt-0.5'>Click a match to see every player and transaction.</p>
                        </div>
                        <div className='flex items-center gap-2'>
                            <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading} className='h-9 px-3 rounded-xl border-[1.5px] border-slate-200 text-sm font-semibold text-slate-600 bg-slate-50 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50 transition-all'>Refresh</button>
                            {!loading && <span className='h-9 flex items-center px-3 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full whitespace-nowrap'>{total.toLocaleString()} {STATUS_WORD[status] || ''}match{total === 1 ? '' : 'es'}</span>}
                        </div>
                    </div>

                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3'>
                        <div className='lg:col-span-2'>
                            <label className={lblCls}>Search</label>
                            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder='Match key, room code or player name' className={selCls + ' cursor-text'} />
                        </div>
                        <div>
                            <label className={lblCls}>Status</label>
                            <select value={status} onChange={set(setStatus)} className={selCls}>
                                <option value=''>All</option>
                                <option value='SETTLED'>Settled (finished &amp; paid)</option>
                                <option value='CANCELLED'>Cancelled</option>
                                <option value='ACTIVE'>Playing</option>
                                <option value='WAITING'>Waiting</option>
                                <option value='UNPAID'>Finished, prize not paid</option>
                            </select>
                        </div>
                        <div>
                            <label className={lblCls}>Type</label>
                            <select value={type} onChange={set(setType)} className={selCls}>
                                <option value=''>All</option><option value='quick'>Quick Match</option><option value='private'>Private</option>
                            </select>
                        </div>
                        <div>
                            <label className={lblCls}>Players</label>
                            <select value={players} onChange={set(setPlayers)} className={selCls}>
                                <option value=''>All</option><option value='with_bots'>With bots</option><option value='humans_only'>Users only</option>
                            </select>
                        </div>
                        <div className='grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2'>
                            <div><label className={lblCls}>From</label><input type='date' value={fromDate} max={toDate || undefined} onChange={set(setFromDate)} className={selCls + ' px-2'} /></div>
                            <div><label className={lblCls}>To</label><input type='date' value={toDate} min={fromDate || undefined} onChange={set(setToDate)} className={selCls + ' px-2'} /></div>
                        </div>
                        <TimezoneSelect />
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        {(fromDate !== today || toDate !== today) && <button onClick={() => { setFromDate(today); setToDate(today); setPage(1); }} className='text-xs font-semibold text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 h-8 rounded-lg'>Today</button>}
                        {(fromDate || toDate) && <button onClick={allDates} className='text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 h-8 rounded-lg'>All dates</button>}
                        {hasFilters && <button onClick={clearFilters} className='text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-3 h-8 rounded-lg'>Clear filters</button>}
                    </div>
                </div>

                {error ? (
                    <div className='flex flex-col items-center py-14 gap-3'>
                        <p className='text-sm font-semibold text-slate-700'>{error}</p>
                        <button onClick={doFetch} className='h-9 px-5 bg-indigo-500 text-white text-xs font-semibold rounded-xl hover:bg-indigo-600'>Retry</button>
                    </div>
                ) : (
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm min-w-[1000px]'>
                            <thead>
                                <tr className='bg-slate-50 border-b-[1.5px] border-slate-200'>
                                    {['#', 'Match key', 'Status', 'Fee', 'Players', 'Winner', 'Join fees', 'Winnings', 'Refunds', 'Commission', 'Played on'].map(h => (
                                        <th key={h} className='px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i} className='border-b border-slate-50'>{Array.from({ length: 11 }).map((_, j) => <td key={j} className='px-4 py-4'><div className='h-3 bg-slate-100 rounded animate-pulse w-16' /></td>)}</tr>
                                )) : rows.length === 0 ? (
                                    <tr><td colSpan={11} className='py-16 text-center text-sm font-semibold text-slate-500'>No matches found</td></tr>
                                ) : rows.map((m, i) => (
                                    <tr key={m.roomId} onClick={() => setOpenId(m.roomId)} className='border-b border-slate-50 last:border-0 hover:bg-indigo-50/40 cursor-pointer transition-colors align-top'>
                                        <td className='px-4 py-3 text-xs text-slate-400 font-mono'>{(page - 1) * limit + i + 1}</td>
                                        <td className='px-4 py-3'>
                                            <p className='font-mono text-xs font-bold text-slate-800'>{m.roomId}</p>
                                            <p className='text-[10px] text-slate-400'>{m.type === 'PRIVATE' ? `Private${m.roomCode ? ` · ${m.roomCode}` : ''}` : `Quick${m.poolName ? ` · ${m.poolName}` : ''}`}</p>
                                        </td>
                                        <td className='px-4 py-3'><Badge status={m.roomStatus} unpaid={m.roomStatus === 'COMPLETED' && !m.money.settled} /></td>
                                        <td className='px-4 py-3 font-semibold text-slate-700 whitespace-nowrap'>{money(m.entryFee)}</td>
                                        <td className='px-4 py-3 min-w-[170px]'>
                                            <div className='space-y-1'>
                                                {m.players.length === 0 ? <span className='text-xs text-slate-300'>—</span> : m.players.map(p => (
                                                    <div key={p.userId} className={`flex items-center gap-1.5 ${p.status === 'LEFT' ? 'opacity-50' : ''}`}>
                                                        <WhoTag isBot={p.isBot} /><span className='text-xs text-slate-700 truncate max-w-[110px]'>{p.name}</span>
                                                        {p.isBot && <DifficultyTag level={p.botDifficulty} />}
                                                        {p.status === 'LEFT' && <span className='text-[10px] text-slate-400 whitespace-nowrap'>left before start{p.money?.refund > 0 ? ` · ${money(p.money.refund)} refunded` : ''}</span>}
                                                        {p.status === 'FORFEITED' && <span className='text-[10px] text-orange-500 whitespace-nowrap'>exited match</span>}
                                                        {p.status !== 'LEFT' && p.money?.refund > 0 && <span className='text-[10px] text-sky-600 whitespace-nowrap'>{money(p.money.refund)} refunded</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className='px-4 py-3 min-w-[120px]'>
                                            {m.winners.length === 0 ? <span className='text-xs text-slate-300'>—</span> : m.winners.map(w => (
                                                <div key={w.userId} className='flex items-center gap-1.5'><WhoTag isBot={w.isBot} /><span className='text-xs font-semibold text-slate-800 truncate max-w-[100px]'>{w.name}</span>{w.isBot && <DifficultyTag level={w.botDifficulty} />}</div>
                                            ))}
                                        </td>
                                        <td className='px-4 py-3 whitespace-nowrap'>
                                            <p className='text-red-600'>{money(m.money.entry)}</p>
                                            {/* Someone got their fee back: show what was really played for. */}
                                            {m.money.refunds > 0 && (
                                                <p className='text-[10px] text-slate-500' title='Someone paid, left before the start and got the fee back'>
                                                    (<span className='text-slate-700 font-semibold'>{money(m.money.entry - m.money.refunds)} joined</span> + <span className='text-sky-600'>{money(m.money.refunds)} refunded</span>)
                                                </p>
                                            )}
                                        </td>
                                        <td className='px-4 py-3 text-emerald-600 whitespace-nowrap'>{money(m.money.winnings)}</td>
                                        <td className='px-4 py-3 whitespace-nowrap'>
                                            <p className='text-sky-600'>{money(m.money.refunds)}</p>
                                            {m.money.refunds > 0 && (() => {
                                                const n = m.players.filter(p => p.money?.refund > 0).length;
                                                return n > 0 && <p className='text-[10px] text-slate-500'>{n} player{n === 1 ? '' : 's'}</p>;
                                            })()}
                                        </td>
                                        <td className='px-4 py-3 text-indigo-600 font-semibold whitespace-nowrap'>{money(m.money.commission)}</td>
                                        <td className='px-4 py-3 text-xs whitespace-nowrap'><PlayedOn m={m} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!error && total > 0 && (
                    <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100'>
                        <div className='flex items-center gap-3 text-xs text-slate-500'>
                            <span>Showing <b className='text-slate-700'>{firstRow}–{lastRow}</b> of <b className='text-slate-700'>{total.toLocaleString()}</b></span>
                            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className='h-8 px-2 border-[1.5px] border-slate-200 rounded-lg text-xs bg-slate-50 cursor-pointer'>
                                {PAGE_SIZES.map(n => <option key={n} value={n}>{n} per page</option>)}
                            </select>
                        </div>
                        {pages > 1 && (
                            <div className='flex items-center gap-1.5 flex-wrap'>
                                <PageBtn onClick={() => setPage(1)} disabled={page === 1}>«</PageBtn>
                                <PageBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</PageBtn>
                                {pageNums.map((p, i) => p === '…'
                                    ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                                    : <PageBtn key={p} onClick={() => setPage(p)} active={p === page}>{p}</PageBtn>)}
                                <PageBtn onClick={() => setPage(p => p + 1)} disabled={page === pages}>›</PageBtn>
                                <PageBtn onClick={() => setPage(pages)} disabled={page === pages}>»</PageBtn>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {openId && <DetailDrawer matchId={openId} onClose={() => setOpenId(null)} />}
        </div>
    );
}
