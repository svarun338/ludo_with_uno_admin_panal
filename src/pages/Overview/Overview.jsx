// Profit & Loss (admin). Only what an admin needs: the money check, the four headline numbers,
// matches that need fixing, and profit by entry fee and by day. Numbers come from /admin/overview.
// Counts SETTLED matches only (finished + prize paid), on the day the match finished - the same rule as
// Bot Analytics, the Matches cards and Reports. Old: every match, money counted on the day it moved.
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchOverview } from '../../api';
import TimezoneSelect from '../../components/TimezoneSelect';
import { useTimezone, getTz, todayIn, dayRangeText } from '../../utils/timezone';
import { DetailDrawer } from '../Matches/Matches';

const money = n => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n || 0));
const tone = n => n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-slate-700';

// India-time calendar day, YYYY-MM-DD
// Old (India day only): const istToday = (back = 0) => new Date(Date.now() + 330 * 60000 - back * 86400000).toISOString().slice(0, 10);
const istToday = (back = 0) => todayIn(getTz(), back); // today in the chosen timezone (IST default / UTC)
const PRESETS = [
    { key: 'today', label: 'Today',    range: () => [istToday(), istToday()] },
    { key: '7d',    label: '7 days',   range: () => [istToday(6), istToday()] },
    { key: '30d',   label: '30 days',  range: () => [istToday(29), istToday()] },
    { key: 'all',   label: 'All time', range: () => ['', ''] },
];

const box = 'bg-white rounded-2xl border border-slate-100 shadow-sm';
const th = 'px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap';
const td = 'px-4 py-2.5 whitespace-nowrap';

// The top of the page in plain words: platform profit first, then all money, then users and bots.
function PlainSummary({ d }) {
    const u = d.users;
    const b = d.bots;
    const p = d.profit;
    const m = d.matches;
    const nc = d.notCounted || { live: { matches: 0, held: 0 }, cancelled: { matches: 0, entry: 0, refunds: 0 }, unpaid: { matches: 0, held: 0 }, otherDay: { matches: 0 } };
    const totalJoin = u.entry + b.entry;
    const totalWon = u.winnings + b.winnings;
    const totalRefund = u.refunds + b.refunds;

    // One "Joined -> Won = Result" row, used for users and for bots.
    const Flow = ({ title, sub, joined, won, refunded, result, resultLabel, formula }) => (
        <div className={box + ' p-4'}>
            <p className='text-sm font-bold text-slate-700'>{title} <span className='font-normal text-slate-400'>· {sub}</span></p>
            <div className='grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-2 mt-3'>
                <div className='rounded-xl bg-slate-50 border border-slate-100 px-4 py-3'>
                    <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Joined</p>
                    <p className='text-xl font-bold text-slate-800 mt-0.5'>{money(joined)}</p>
                    <p className='text-xs text-slate-400'>{refunded > 0 ? `${money(refunded)} refunded` : 'Entry fees paid'}</p>
                </div>
                <div className='hidden sm:flex items-center text-xl font-bold text-slate-300'>→</div>
                <div className='rounded-xl bg-slate-50 border border-slate-100 px-4 py-3'>
                    <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Won</p>
                    <p className='text-xl font-bold text-emerald-600 mt-0.5'>{money(won)}</p>
                    <p className='text-xs text-slate-400'>Prize money received</p>
                </div>
                <div className='hidden sm:flex items-center text-xl font-bold text-slate-300'>=</div>
                <div className={`rounded-xl border-2 px-4 py-3 ${result < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>{resultLabel}</p>
                    <p className={`text-2xl font-extrabold mt-0.5 ${tone(result)}`}>{signed(result)}</p>
                    <p className='text-xs text-slate-500'>{formula}</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className='space-y-3'>
            {/* 1. The answer: what the platform made */}
            <div className={`rounded-2xl border-2 p-5 ${p.platformProfit < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className='text-xs font-semibold uppercase tracking-wider text-slate-500'>{p.platformProfit < 0 ? 'Platform loss' : 'Platform profit'}</p>
                <p className={`text-4xl font-extrabold mt-1 ${tone(p.platformProfit)}`}>{signed(p.platformProfit)}</p>
                <p className='text-sm text-slate-600 mt-2'>
                    Commission <b className='text-indigo-600'>{money(p.commission)}</b>
                    {' '}{p.botNet < 0 ? '−' : '+'} Bots {p.botNet < 0 ? 'lost' : 'won'} <b className={tone(p.botNet)}>{money(Math.abs(p.botNet))}</b>
                    {' '}= <b className={tone(p.platformProfit)}>{signed(p.platformProfit)}</b>
                </p>
                <p className='text-xs text-slate-500 mt-1'>
                    From {m.settled} finished match{m.settled === 1 ? '' : 'es'} ({m.withBots} with a bot). Playing and cancelled matches are not counted.
                </p>
            </div>

            {/* 2. All money in the counted matches */}
            <div className={box + ' p-4'}>
                <p className='text-sm font-bold text-slate-700'>All matches together <span className='font-normal text-slate-400'>· users + bots</span></p>
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3'>
                    <div className='rounded-xl bg-slate-50 px-4 py-3'>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Total join amount</p>
                        <p className='text-xl font-bold text-slate-800 mt-0.5'>{money(totalJoin)}</p>
                    </div>
                    <div className='rounded-xl bg-slate-50 px-4 py-3'>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Total win amount paid</p>
                        <p className='text-xl font-bold text-emerald-600 mt-0.5'>{money(totalWon)}</p>
                        {totalRefund > 0 && <p className='text-xs text-slate-400'>+ {money(totalRefund)} refunded</p>}
                    </div>
                    <div className='rounded-xl bg-indigo-50 px-4 py-3'>
                        <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Commission kept</p>
                        <p className='text-xl font-bold text-indigo-600 mt-0.5'>{money(p.commission)}</p>
                    </div>
                </div>
            </div>

            {/* 3. Users and bots, same simple sum */}
            <Flow title='Real users' sub='matches they finished'
                joined={u.entry} won={u.winnings} refunded={u.refunds} result={u.net}
                resultLabel={u.net < 0 ? 'Users lost' : 'Users won'}
                formula={`${money(u.winnings)} won${u.refunds > 0 ? ` + ${money(u.refunds)} refunded` : ''} − ${money(u.entry)} joined`} />
            <Flow title='Bots' sub='play with platform money'
                joined={b.entry} won={b.winnings} refunded={b.refunds} result={b.net}
                resultLabel={b.net < 0 ? 'Bots lost' : 'Bots profit'}
                formula={`${money(b.winnings)} won${b.refunds > 0 ? ` + ${money(b.refunds)} refunded` : ''} − ${money(b.entry)} joined`} />

            {/* 4. Where the users' money went. Always true: what users lost = what bots won + commission. */}
            <div className={box + ' p-4'}>
                <p className='text-sm font-bold text-slate-700'>
                    {u.net <= 0 ? `Where did the users' ${money(-u.net)} go?` : `Where did the users' ${money(u.net)} win come from?`}
                </p>
                {u.net <= 0 ? (
                    <div className='mt-3 flex flex-wrap items-center gap-2 text-sm'>
                        <span className='px-3 py-2 rounded-xl bg-red-50 text-red-700 font-semibold'>Users lost {money(-u.net)}</span>
                        <span className='text-slate-400 font-bold'>=</span>
                        {b.net >= 0 ? <>
                            <span className='px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-semibold'>Bots won {money(b.net)}</span>
                            <span className='text-slate-400 font-bold'>+</span>
                            <span className='px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-semibold'>Commission {money(p.commission)}</span>
                        </> : <>
                            <span className='px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-semibold'>Commission {money(p.commission)}</span>
                            <span className='text-slate-400 font-bold'>−</span>
                            <span className='px-3 py-2 rounded-xl bg-red-50 text-red-700 font-semibold'>Bots lost {money(-b.net)}</span>
                        </>}
                    </div>
                ) : (
                    <div className='mt-3 flex flex-wrap items-center gap-2 text-sm'>
                        <span className='px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-semibold'>Users won {money(u.net)}</span>
                        <span className='text-slate-400 font-bold'>+</span>
                        <span className='px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-semibold'>Commission {money(p.commission)}</span>
                        <span className='text-slate-400 font-bold'>=</span>
                        <span className='px-3 py-2 rounded-xl bg-red-50 text-red-700 font-semibold'>Bots lost {money(-b.net)}</span>
                    </div>
                )}
                <p className='text-xs text-slate-500 mt-3'>
                    {u.net <= 0
                        ? (b.net >= 0
                            ? `Out of the ${money(-u.net)} users lost, ${money(b.net)} went to the bots and ${money(p.commission)} was kept as commission. Bots are platform money, so the platform keeps all of it: profit ${signed(p.platformProfit)}.`
                            : `Users lost ${money(-u.net)}, but bots lost ${money(-b.net)}, so out of the ${money(p.commission)} commission the platform keeps ${signed(p.platformProfit)}.`)
                        : `Users took home ${money(u.net)} more than they paid. That money, plus the ${money(p.commission)} commission, came from the bots. Platform result: ${signed(p.platformProfit)}.`}
                </p>
            </div>

            {/* 3. Matches: counted, and not counted (money moved on these dates but the match did not settle on them) */}
            <div className={box + ' p-4 space-y-2'}>
                <p className='text-sm font-bold text-slate-700'>Matches</p>
                <div className='flex flex-wrap gap-2 text-xs'>
                    <span className='px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold'>Counted: {m.settled} settled (finished & paid)</span>
                    <span className='px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 font-semibold'>{m.withBots} of them had a bot</span>
                </div>
                <p className='text-xs font-semibold text-slate-500 pt-1'>Not counted above</p>
                <div className='flex flex-wrap gap-2 text-xs'>
                    <span className='px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-semibold'>{nc.live.matches} still playing / waiting · {money(nc.live.held)} held</span>
                    <span className='px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold'>{nc.cancelled.matches} cancelled · {money(nc.cancelled.refunds)} refunded</span>
                    {nc.unpaid.matches > 0 && <span className='px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-semibold'>{nc.unpaid.matches} finished, prize NOT paid · {money(nc.unpaid.held)} held - fix in Match Recovery</span>}
                    {nc.otherDay.matches > 0 && <span className='px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold'>{nc.otherDay.matches} settled on another date (counted on that date)</span>}
                </div>
                <p className='text-[11px] text-slate-400'>They count here once they settle. A cancelled match never counts: its join fees were given back.</p>
            </div>
        </div>
    );
}

// One plain sentence describing what happened in a row (an entry fee or a day).
function explainRow(r) {
    const profit = r.commission + r.botNet;
    const m = n => `${n} settled match${n === 1 ? '' : 'es'}`;
    const parts = [`${m(r.settled)}: ${money(r.entry)} join fees, ${money(r.winnings)} winnings paid.`];
    parts.push(`Platform kept ${money(r.commission)} commission`);
    if (r.withBots === 0) parts.push('and no bots played');
    else if (r.botNet > 0) parts.push(`and bots won ${money(r.botNet)}`);
    else if (r.botNet < 0) parts.push(`but bots lost ${money(-r.botNet)}`);
    else parts.push('and bots broke even');
    return `${parts[0]} ${parts.slice(1).join(' ')}, so the platform ${profit >= 0 ? 'earned' : 'lost'} ${money(Math.abs(profit))}.`;
}

// Column meanings shown under each table title.
const LEGEND = [
    ['Settled', 'matches that finished and were paid on these dates (only these are counted)'],
    ['Commission', "the platform's fee taken from each settled match"],
    ['Bots result', 'what bots won minus what they paid (bots play with platform money)'],
    ['Profit', 'commission + bots result = what the platform made'],
];

function Legend() {
    return (
        <div className='px-5 py-2.5 bg-slate-50/60 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1'>
            {LEGEND.map(([k, v]) => (
                <p key={k} className='text-[11px] text-slate-500'><b className='text-slate-600'>{k}:</b> {v}</p>
            ))}
        </div>
    );
}

function Table({ title, sub, head, rows, empty }) {
    return (
        <div className={box + ' overflow-hidden'}>
            <div className='px-5 py-3.5 border-b border-slate-100'>
                <p className='text-sm font-bold text-slate-700'>{title}</p>
                {sub && <p className='text-xs text-slate-400 mt-0.5'>{sub}</p>}
            </div>
            <Legend />
            <div className='overflow-x-auto max-h-[460px] overflow-y-auto'>
                <table className='w-full text-sm min-w-[900px]'>
                    <thead className='bg-slate-50 sticky top-0'><tr>{head.map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {rows.length === 0
                            ? <tr><td colSpan={head.length} className='py-8 text-center text-sm text-slate-400'>{empty}</td></tr>
                            : rows}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function Overview() {
    const [preset, setPreset] = useState('today');
    const [startDate, setStartDate] = useState(istToday());
    const [endDate, setEndDate] = useState(istToday());
    const [d, setD] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openMatch, setOpenMatch] = useState(null);
    const tz = useTimezone(); // IST (default) or UTC

    // Switching timezone moves a preset (Today / 7 days / 30 days) to that timezone's days.
    useEffect(() => {
        const p = PRESETS.find(x => x.key === preset);
        if (p) { const [s, e] = p.range(); setStartDate(s); setEndDate(e); }
    }, [tz]); // eslint-disable-line react-hooks/exhaustive-deps

    const load = useCallback(() => {
        setLoading(true); setError('');
        fetchOverview({ startDate, endDate, tz })
            .then(r => setD(r.data.data))
            .catch(e => setError(e.response?.data?.message || 'Failed to load'))
            .finally(() => setLoading(false));
    }, [startDate, endDate, tz]);
    useEffect(() => { load(); }, [load]);

    const pick = p => { setPreset(p.key); const [s, e] = p.range(); setStartDate(s); setEndDate(e); };
    const inp = 'h-9 px-2 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none focus:border-indigo-500';
    const v = d?.validation;

    return (
        <div className='space-y-4'>
            {/* Period */}
            <div className={box + ' p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between'}>
                <div className='flex p-0.5 bg-slate-100 rounded-xl w-full lg:w-auto'>
                    {PRESETS.map(p => (
                        <button key={p.key} onClick={() => pick(p)}
                            className={`flex-1 lg:flex-none px-4 h-8 rounded-[10px] text-xs font-semibold transition-all ${preset === p.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{p.label}</button>
                    ))}
                </div>
                <div className='flex items-center gap-2 text-xs text-slate-500'>
                    <input type='date' value={startDate} max={endDate || istToday()} onChange={e => { setPreset(''); setStartDate(e.target.value); }} className={inp} />
                    <span>to</span>
                    <input type='date' value={endDate} min={startDate || undefined} max={istToday()} onChange={e => { setPreset(''); setEndDate(e.target.value); }} className={inp} />
                    <TimezoneSelect label={false} />
                    <button onClick={load} disabled={loading} className='h-9 px-3 rounded-xl border-[1.5px] border-slate-200 font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50'>Refresh</button>
                </div>
            </div>

            {error && (
                <div className={box + ' p-8 text-center space-y-3'}>
                    <p className='text-sm font-semibold text-slate-700'>{error}</p>
                    <button onClick={load} className='h-9 px-5 bg-indigo-500 text-white text-xs font-semibold rounded-xl'>Retry</button>
                </div>
            )}

            {!error && (!d || loading) && (
                <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
                    {[1, 2, 3, 4].map(i => <div key={i} className='h-28 bg-white rounded-2xl border border-slate-100 animate-pulse' />)}
                </div>
            )}

            {!error && d && !loading && <>
                {/* Money check */}
                {v.ok ? (
                    <div className='rounded-2xl border bg-emerald-50 border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700'>
                        ✓ All money is accounted for <span className='font-normal text-emerald-600'>· {v.checkedMatches} matches checked</span>
                    </div>
                ) : (
                    <div className='rounded-2xl border bg-red-50 border-red-200 overflow-hidden'>
                        <div className='px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
                            <div>
                                <p className='text-sm font-bold text-red-700'>⚠ {v.mismatchCount} match{v.mismatchCount === 1 ? '' : 'es'} need fixing · {money(Math.abs(v.unaccounted))} {v.unaccounted > 0 ? 'not paid back' : 'paid out too much'}</p>
                                <p className='text-xs text-red-600 mt-0.5'>
                                    {v.unaccounted > 0
                                        ? 'Players paid to join, but the money was not refunded or paid as winnings.'
                                        : 'More money went out than players paid in.'} Open each match in Match Recovery to fix it.
                                </p>
                            </div>
                            <Link to='/dashboard/match-recovery' className='h-9 px-4 shrink-0 inline-flex items-center rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700'>Go to Match Recovery</Link>
                        </div>
                        <div className='bg-white/60 border-t border-red-100 divide-y divide-red-100'>
                            {v.mismatches.map(m => (
                                <div key={m.roomId} className='px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-sm'>
                                    <button onClick={() => setOpenMatch(m.roomId)} className='font-mono text-xs font-bold text-red-700 hover:underline'>{m.roomId}</button>
                                    <span className='text-xs text-slate-500'>
                                        {m.unaccounted < 0 ? 'Paid out more than paid in'
                                            : m.roomStatus === 'CANCELLED' ? 'Cancelled – refund missing'
                                            : m.escrowStatus !== 'DISTRIBUTED' ? 'Finished – prize not paid'
                                            : 'Settled – part of prize missing'}
                                    </span>
                                    <span className='font-bold text-red-700'>{signed(m.unaccounted)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <PlainSummary d={d} />

                {/* By entry fee */}
                <Table title='By entry fee' sub='Settled matches at each entry fee (the amount a player pays to join)' empty='No matches in this period'
                    head={['Entry fee', 'Settled', 'Join fees', 'Winnings', 'Commission', 'Bots result', 'Profit', 'What happened']}
                    rows={d.byEntryFee.filter(f => f.matches > 0).map(f => (
                        <tr key={f.entryFee} className='border-t border-slate-50'>
                            <td className={td + ' font-bold text-slate-800'}>{money(f.entryFee)}</td>
                            <td className={td}>{f.settled}</td>
                            <td className={td}>{money(f.entry)}</td>
                            <td className={td + ' text-emerald-600'}>{money(f.winnings)}</td>
                            <td className={td + ' text-indigo-600'}>{money(f.commission)}</td>
                            <td className={td + ' ' + tone(f.botNet)}>{signed(f.botNet)}</td>
                            <td className={td + ' font-bold ' + tone(f.commission + f.botNet)}>{signed(f.commission + f.botNet)}</td>
                            <td className='px-4 py-2.5 text-xs text-slate-500 min-w-[320px] whitespace-normal'>{explainRow(f)}</td>
                        </tr>
                    ))} />

                {/* By day (only useful for more than one day) */}
                {d.daily.length > 1 && (
                    <Table title='By day' sub={`Settled matches by the day they finished (${dayRangeText(tz)})`} empty='No matches in this period'
                        head={['Date', 'Settled', 'Join fees', 'Winnings', 'Commission', 'Bots result', 'Profit', 'What happened']}
                        rows={d.daily.map(x => (
                            <tr key={x.date} className='border-t border-slate-50'>
                                <td className={td + ' font-semibold text-slate-800'}>{new Date(`${x.date}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td className={td}>{x.settled}</td>
                                <td className={td}>{money(x.entry)}</td>
                                <td className={td + ' text-emerald-600'}>{money(x.winnings)}</td>
                                <td className={td + ' text-indigo-600'}>{money(x.commission)}</td>
                                <td className={td + ' ' + tone(x.botNet)}>{signed(x.botNet)}</td>
                                <td className={td + ' font-bold ' + tone(x.commission + x.botNet)}>{signed(x.commission + x.botNet)}</td>
                                <td className='px-4 py-2.5 text-xs text-slate-500 min-w-[320px] whitespace-normal'>{explainRow(x)}</td>
                            </tr>
                        ))} />
                )}

                <p className='text-[11px] text-slate-400 px-1'>
                    Counts settled matches only, on the day each match finished - the same as Bot Analytics, the Matches page cards and Reports. The Transactions page lists every transaction by its own time, so its totals also include matches still playing or cancelled. Need more detail? Download it from <Link to='/dashboard/reports' className='text-indigo-500 hover:underline'>Reports</Link>.
                </p>
            </>}

            {openMatch && <DetailDrawer matchId={openMatch} onClose={() => setOpenMatch(null)} />}
        </div>
    );
}
