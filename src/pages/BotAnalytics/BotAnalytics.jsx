/*
 * Bot Analytics (admin page, /dashboard/bot-analytics) — simple view of how the bots did on one day.
 *
 *   1. Day summary    - bots' net result, winnings, entry fees, matches (settled matches only)
 *   2. Daily target   - progress towards the target % (reporting only, never changes gameplay)
 *   3. Ledger check   - one line: do the recorded figures match the wallet ledger?
 *   4. Matches        - per-match bot result; click a match to see every player and transaction
 *   5. Settings       - target % (folded away)
 *   6. Bot difficulty - difficulty policy On / Off (folded away)
 *   7. Advanced       - backfill of missed records, config history, audit trail (folded away)
 *
 * Old: The difficulty policy is intentionally not shown here. It still runs on the server exactly as last saved.
 * Every calculation and permission check is done by the backend API.
 */
// Old: import { useState, useEffect, useCallback } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    fetchBotAnalytics, fetchBotTargetConfig, saveBotTargetConfig, fetchBotAnalyticsAudit, runBotAnalyticsBackfill,
    fetchBotDifficultyPolicy, saveBotDifficultyPolicy,
} from '../../api';
import TimezoneSelect from '../../components/TimezoneSelect';
import { useTimezone, getTz, todayIn, fmtDateTimeIn, dayRangeText } from '../../utils/timezone';
import { toast } from '../../toast';
import PageBtn from '../../components/PageBtn';
import { DetailDrawer } from '../Matches/Matches';

const money = v => `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = v => (Number(v) > 0 ? '+' : Number(v) < 0 ? '−' : '') + money(Math.abs(Number(v || 0)));
const tone = v => Number(v) > 0 ? 'text-emerald-600' : Number(v) < 0 ? 'text-red-600' : 'text-slate-800';
// Old (India time only): const when = v => v ? new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const when = v => fmtDateTimeIn(v, getTz()); // in the chosen timezone (IST default / UTC)
const dayLabel = d => d ? new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '';
const errMsg = e => e.response?.data?.message || e.message || 'Request failed';
const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); // backfill always uses India days
const dayToday = () => todayIn(getTz()); // the day picker: today in the chosen timezone

const PERCENTS = [10, 20, 30, 40, 50];
const PAGE_SIZES = [10, 20, 50, 100];
const TARGET_TEXT = {
    MET:               { label: 'Target reached',          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
    BELOW_TARGET:      { label: 'Below target',            cls: 'bg-red-50 text-red-700 border-red-200',             bar: 'bg-red-400' },
    INSUFFICIENT_DATA: { label: 'Not enough matches yet',  cls: 'bg-amber-50 text-amber-700 border-amber-200',       bar: 'bg-amber-400' },
    NOT_CONFIGURED:    { label: 'No target set',           cls: 'bg-slate-100 text-slate-600 border-slate-300',      bar: 'bg-slate-300' },
};
const OUTCOME_TEXT = { SETTLED: 'Settled', CANCELLED: 'Cancelled' };
// Report tabs: '' = all bot matches combined, 2 / 4 = only that room size (view only).
const PLAYER_TABS = [['', 'All matches'], [2, '2 Players'], [4, '4 Players']];

// One plain sentence describing what happened to the bots' money in a match.
function explainMatch(m) {
    const paid = Number(m.botEntryFees), back = Number(m.botRefunds), won = Number(m.botGrossWinnings), net = Number(m.botNetProfit);
    const bots = Number(m.botCount) > 1 ? `${m.botCount} bots` : 'The bot';
    if (m.outcome === 'CANCELLED') {
        return Math.abs(net) < 0.01
            ? `Match was cancelled. ${bots} paid ${money(paid)} and got it all back, so nothing was won or lost.`
            : `Match was cancelled. ${bots} paid ${money(paid)} but got back only ${money(back)}. Check this match in Match Recovery.`;
    }
    const refundTxt = back > 0 ? ` (${money(back)} was refunded)` : '';
    const fee = Number(m.platformCommission) > 0 ? ` The platform also kept ${money(m.platformCommission)} commission.` : '';
    if (won > 0) return `A bot won the match. ${bots} paid ${money(paid)}${refundTxt} and won ${money(won)}, so bots made ${money(net)}.${fee}`;
    return `A real player won the match. ${bots} paid ${money(paid)}${refundTxt} and won nothing, so bots lost ${money(-net)}.${fee}`;
}

// Column meanings shown above the matches table.
const MATCH_LEGEND = [
    ['Result', 'Settled = finished and paid out; Cancelled = called off and refunded'],
    ['Bots paid', 'entry fees the bots paid to join (platform money)'],
    ['Refunded', 'entry fees given back to the bots (e.g. a cancelled match)'],
    ['Bots won', 'prize money paid to a bot that won'],
    ['Bots net', 'won + refunded − paid: what the platform gained or lost through its bots'],
    ['Commission', 'platform fee from the match; counted separately from the bots'],
];

const inpCls = 'h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';
const btnCls = 'h-9 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all';
const box = 'bg-white border border-slate-100 shadow-sm rounded-2xl';

const Fold = ({ title, sub, children }) => (
    <details className={box + ' group'}>
        <summary className='px-5 py-3.5 cursor-pointer list-none flex items-center justify-between'>
            <span>
                <span className='text-sm font-bold text-slate-700'>{title}</span>
                {sub && <span className='block text-xs text-slate-400 mt-0.5'>{sub}</span>}
            </span>
            <span className='text-slate-400 text-xs group-open:rotate-180 transition-transform'>▼</span>
        </summary>
        <div className='px-5 pb-5 border-t border-slate-100 pt-4'>{children}</div>
    </details>
);

export default function BotAnalytics() {
    const [date, setDate] = useState(dayToday());
    const tz = useTimezone(); // IST (default) or UTC - UTC is view only
    const [players, setPlayers] = useState(''); // '' = all, 2 or 4
    const reqId = useRef(0); // only the latest request may fill the page (fast tab / date switching)
    const [data, setData] = useState(null);
    const [cfgData, setCfgData] = useState(null);
    const [audit, setAudit] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [openMatch, setOpenMatch] = useState(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    // Only targetPercent, minSampleSize and reason are sent; the baseline is chosen by the backend.
    const [cfg, setCfg] = useState({ targetPercent: '', minSampleSize: 1, reason: '' });
    const [bf, setBf] = useState({ from: istToday(), to: istToday(), reason: '' });
    const [busy, setBusy] = useState('');
    // Difficulty policy: { current, window } from the API, or { error } when it could not be read.
    const [pol, setPol] = useState(null);
    const [polReason, setPolReason] = useState('');

    const load = useCallback(async () => {
        const my = ++reqId.current;
        setLoading(true); setError('');
        // Loaded on its own so a policy read failure never hides the rest of the page.
        fetchBotDifficultyPolicy().then(r => setPol(r.data.data)).catch(e => setPol({ error: errMsg(e) }));
        try {
            // Old: const [s, c, a] = await Promise.all([fetchBotAnalytics(date, tz), fetchBotTargetConfig(), fetchBotAnalyticsAudit()]);
            const [s, c, a] = await Promise.all([fetchBotAnalytics(date, tz, players, page, limit), fetchBotTargetConfig(), fetchBotAnalyticsAudit()]);
            if (my !== reqId.current) return; // a newer tab / date was picked meanwhile - drop this answer
            setData(s.data.data); setCfgData(c.data.data); setAudit(a.data.data || []);
            const cur = c.data.data.current;
            if (cur) setCfg(x => ({ ...x, targetPercent: cur.targetPercent ?? '', minSampleSize: cur.minSampleSize }));
        // Old: } catch (e) { setError(errMsg(e)); }
        // Old: finally { setLoading(false); }
        } catch (e) { if (my === reqId.current) setError(errMsg(e)); }
        finally { if (my === reqId.current) setLoading(false); }
    // Old: }, [date, tz]);
    }, [date, tz, players, page, limit]);
    useEffect(() => { load(); }, [load]);
    // A new day starts on page 1.
    const pickDate = d => { setDate(d); setPage(1); };

    const submit = async (name, fn, okMsg) => {
        setBusy(name);
        try { await fn(); toast.success(okMsg); await load(); return true; }
        catch (e) { toast.error(errMsg(e)); return false; }
        finally { setBusy(''); }
    };

    const saveCfg = () => submit('cfg', () => saveBotTargetConfig({
        targetPercent: cfg.targetPercent === '' ? null : Number(cfg.targetPercent),
        minSampleSize: Number(cfg.minSampleSize),
        reason: cfg.reason,
    }), 'Target saved').then(ok => ok && setCfg(x => ({ ...x, reason: '' })));

    // Flips the policy On/Off. The backend keeps the window start and the other settings as they are.
    const polOn = !!pol?.current?.enabled;
    const togglePolicy = () => submit('pol', () => saveBotDifficultyPolicy({
        enabled: !polOn,
        maxStalenessMinutes: pol?.current?.maxStalenessMinutes ?? 30,
        reason: polReason,
    }), polOn ? 'Difficulty policy turned off' : 'Difficulty policy turned on').then(ok => ok && setPolReason(''));

    const runBackfill = () => submit('bf', async () => {
        const r = await runBotAnalyticsBackfill(bf);
        toast.success(`Backfill: ${r.data.data.created} created, ${r.data.data.refreshed} refreshed, ${r.data.data.failed} failed`);
    }, 'Backfill finished');

    const t = data?.totals;
    const tg = data?.target;
    const ts = TARGET_TEXT[tg?.status] || TARGET_TEXT.NOT_CONFIGURED;
    const progress = tg && Number(tg.targetAmount) > 0 ? Math.max(0, Math.min(100, (Number(t.netProfit) / Number(tg.targetAmount)) * 100)) : 0;
    const warnings = data?.reconciliation?.warnings || [];
    const netFees = t ? Number(t.entryFees) - Number(t.refunds) : 0;
    const settledList = (data?.matches || []).filter(m => m.outcome === 'SETTLED');
    // Whole-day counts from the backend (the table is only one page). Fallback: count this page.
    const botWins = t?.botWins ?? settledList.filter(m => Number(m.botGrossWinnings) > 0).length;
    const botLosses = t?.botLosses ?? settledList.length - settledList.filter(m => Number(m.botGrossWinnings) > 0).length;
    const pg = data?.pagination || { page: 1, limit, total: data?.matches?.length || 0, totalPages: 1 };
    const firstRow = pg.total ? (pg.page - 1) * pg.limit + 1 : 0;
    const lastRow = Math.min(pg.page * pg.limit, pg.total);
    const pageNums = Array.from({ length: pg.totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === pg.totalPages || Math.abs(p - pg.page) <= 1)
        .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…'); acc.push(p); return acc; }, []);

    return (
        <div className='space-y-4'>
            {/* Day picker */}
            <div className={box + ' p-4 flex flex-wrap items-center justify-between gap-3'}>
                <div>
                    <p className='text-sm font-bold text-slate-800'>{dayLabel(data?.reportDate || date)}</p>
                    <p className='text-xs text-slate-400'>{dayRangeText(tz)} · Updated {when(data?.lastCalculatedAt)}</p>
                    {tz === 'UTC' && <p className='text-xs text-amber-700 mt-0.5'>UTC view: worked out for the UTC day, for viewing only. Bot difficulty and the saved daily target always use the India (IST) day.</p>}
                </div>
                <div className='flex items-center gap-2'>
                    {date !== dayToday() && <button className='h-9 px-3 rounded-xl border-[1.5px] border-slate-200 text-sm font-semibold text-slate-600 hover:border-indigo-400' onClick={() => pickDate(dayToday())}>Today</button>}
                    <input type='date' className={inpCls} value={date} max={dayToday()} onChange={e => e.target.value && pickDate(e.target.value)} />
                    <TimezoneSelect label={false} />
                    <button className={btnCls} onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                </div>
            </div>

            {/* Report tabs: All / 2 Players / 4 Players */}
            <div className='flex flex-wrap items-center gap-2'>
                <div className='inline-flex p-1 bg-slate-100 rounded-xl'>
                    {PLAYER_TABS.map(([v, label]) => (
                        <button key={label} onClick={() => setPlayers(v)}
                            className={`px-4 h-8 rounded-lg text-sm font-semibold transition-all ${players === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>
                {players !== '' && <p className='text-xs text-slate-400'>Showing {players}-player matches only. Bot difficulty always uses all matches combined.</p>}
            </div>

            {error && <div className='p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700'>{error}</div>}

            {!data && !error && (
                <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
                    {[1, 2, 3, 4].map(i => <div key={i} className='h-28 bg-white rounded-2xl border border-slate-100 animate-pulse' />)}
                </div>
            )}

            {data && <>
                {/* 1. Day summary: Joined − Won = Profit, shown as one simple sum */}
                <div className={box + ' p-5'}>
                    <div className='flex flex-wrap items-center justify-between gap-2 mb-4'>
                        <p className='text-sm font-bold text-slate-700'>Bot profit for the day</p>
                        <p className='text-xs text-slate-500'>
                            {t.settledMatches} match{Number(t.settledMatches) === 1 ? '' : 'es'} played · bots won <b className='text-emerald-600'>{botWins}</b> · lost <b className='text-red-600'>{botLosses}</b>
                            {Number(t.cancelledMatchesExcluded) > 0 && ` · ${t.cancelledMatchesExcluded} cancelled (not counted)`}
                        </p>
                    </div>
                    <div className='grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-3'>
                        <div className='rounded-xl bg-slate-50 border border-slate-100 p-4'>
                            <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Total join amount</p>
                            <p className='text-2xl font-bold text-slate-800 mt-1'>{money(netFees)}</p>
                            <p className='text-xs text-slate-400 mt-1'>
                                {Number(t.refunds) > 0 ? `${money(t.entryFees)} paid − ${money(t.refunds)} refunded` : 'Entry fees bots paid to join matches'}
                            </p>
                        </div>
                        <div className='hidden md:flex items-center text-2xl font-bold text-slate-300'>→</div>
                        <div className='rounded-xl bg-emerald-50/60 border border-emerald-100 p-4'>
                            <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>Total win amount</p>
                            <p className='text-2xl font-bold text-emerald-600 mt-1'>{money(t.grossWinnings)}</p>
                            <p className='text-xs text-slate-400 mt-1'>Prize money bots won back</p>
                        </div>
                        <div className='hidden md:flex items-center text-2xl font-bold text-slate-300'>=</div>
                        <div className={`rounded-xl border-2 p-4 ${Number(t.netProfit) < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <p className='text-[11px] font-semibold uppercase tracking-wider text-slate-500'>{Number(t.netProfit) < 0 ? 'Actual loss' : 'Actual profit'}</p>
                            <p className={`text-3xl font-extrabold mt-1 ${tone(t.netProfit)}`}>{signed(t.netProfit)}</p>
                            <p className='text-xs text-slate-500 mt-1'>{money(t.grossWinnings)} won − {money(netFees)} joined</p>
                        </div>
                    </div>
                    <div className='mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500'>
                        <span>Commission from bot matches: <b className='text-slate-700'>{money(t.platformCommission)}</b> <span className='text-slate-400'>(not in bot profit · all matches are on Profit &amp; Loss)</span></span>
                        <span>Admin top-ups to bots: <b className='text-slate-700'>{money(data.adminCapital.net)}</b> <span className='text-slate-400'>(not counted as profit{players !== '' ? '; all modes, cannot be split' : ''})</span></span>
                    </div>
                </div>

                {/* 2. Daily target */}
                <div className={box + ' p-5'}>
                    <div className='flex flex-wrap items-center justify-between gap-2 mb-3'>
                        <p className='text-sm font-bold text-slate-700'>Daily target</p>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ts.cls}`}>{ts.label}</span>
                    </div>
                    {tg.status === 'NOT_CONFIGURED' ? (
                        <p className='text-sm text-slate-500'>No target is set. Pick a target % under <b>Target settings</b> below.</p>
                    ) : (
                        <>
                            <div className='h-3 bg-slate-100 rounded-full overflow-hidden'>
                                <div className={`h-full rounded-full transition-all ${ts.bar}`} style={{ width: `${progress}%` }} />
                            </div>
                            <div className='grid grid-cols-3 gap-3 mt-3 text-sm'>
                                <div><p className='text-[11px] text-slate-400 uppercase font-semibold tracking-wider'>Target ({tg.targetPercent}%)</p><p className='font-bold text-slate-800'>{money(tg.targetAmount)}</p></div>
                                <div><p className='text-[11px] text-slate-400 uppercase font-semibold tracking-wider'>Bots made</p><p className={`font-bold ${tone(t.netProfit)}`}>{signed(t.netProfit)}</p></div>
                                <div><p className='text-[11px] text-slate-400 uppercase font-semibold tracking-wider'>Still needed</p><p className='font-bold text-slate-800'>{money(tg.remainingAmount)}</p></div>
                            </div>
                            <p className='text-xs text-slate-400 mt-3'>
                                Target = {tg.targetPercent}% of the bots' entry fees for the day ({money(tg.baselineAmount)}).
                                {tg.status === 'INSUFFICIENT_DATA' && ' It is checked once enough matches have settled.'}
                                {/* Old: This is for reporting only and never changes how bots play. */}
                                {polOn ? ' While it is below target, new bots play HARD (Bot difficulty is On).' : ' Bot difficulty is Off, so this is for reporting only.'}
                            </p>
                        </>
                    )}
                </div>

                {/* 3. Ledger check */}
                <div className={`rounded-2xl border px-5 py-3 ${warnings.length ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    {warnings.length === 0 ? (
                        <p className='text-sm font-semibold text-emerald-700'>
                            ✓ Numbers verified with the wallet ledger
                            <span className='font-normal text-emerald-600'> · {data.reconciliation.scannedMatches} bot match{data.reconciliation.scannedMatches === 1 ? '' : 'es'} checked</span>
                        </p>
                    ) : (
                        <>
                            <p className='text-sm font-semibold text-amber-800'>⚠ {warnings.length} match{warnings.length === 1 ? '' : 'es'} need a look</p>
                            <ul className='mt-1 space-y-0.5'>
                                {warnings.map((w, i) => (
                                    <li key={i} className='text-xs text-amber-800'>
                                        <button onClick={() => setOpenMatch(w.roomId)} className='font-mono font-bold hover:underline'>{w.roomId}</button> · {w.code.replaceAll('_', ' ').toLowerCase()}
                                    </li>
                                ))}
                            </ul>
                            <p className='text-xs text-amber-700 mt-1.5'>Press <b>Refresh</b> in a minute. If it stays, check the match in Match Recovery.</p>
                        </>
                    )}
                </div>

                {/* 4. Matches */}
                <div className={box + ' overflow-hidden'}>
                    <div className='px-5 py-3.5 border-b border-slate-100'>
                        <p className='text-sm font-bold text-slate-700'>Bot matches this day</p>
                        <p className='text-xs text-slate-400 mt-0.5'>Every match a bot played on this day and what it meant for the platform. Click a match to see every player and transaction.</p>
                    </div>
                    <div className='px-5 py-2.5 bg-slate-50/60 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1'>
                        {MATCH_LEGEND.map(([k, v]) => <p key={k} className='text-[11px] text-slate-500'><b className='text-slate-600'>{k}:</b> {v}</p>)}
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='w-full text-sm min-w-[1000px]'>
                            <thead className='bg-slate-50'><tr className='text-left text-[11px] uppercase tracking-wider text-slate-500'>
                                {/* Old: {['#', 'Match', 'Result', 'Bots paid', 'Refunded', 'Bots won', 'Bots net', 'Commission', 'What happened'].map(...)} */}
                                {['#', 'Match', 'Mode', 'Result', 'Bots paid', 'Refunded', 'Bots won', 'Bots net', 'Commission', 'What happened'].map(h => <th key={h} className='px-4 py-2.5 font-bold'>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {data.matches.map((m, i) => (
                                    <tr key={m.roomId} className='border-t border-slate-50 hover:bg-indigo-50/40 cursor-pointer' onClick={() => setOpenMatch(m.roomId)}>
                                        <td className='px-4 py-2.5 text-xs text-slate-400 font-mono'>{(pg.page - 1) * pg.limit + i + 1}</td>
                                        <td className='px-4 py-2.5 font-mono text-xs font-bold text-indigo-600'>{m.roomId}</td>
                                        <td className='px-4 py-2.5 text-xs font-semibold text-slate-600'>{m.maxPlayers ? `${m.maxPlayers}P` : '—'}</td>
                                        <td className='px-4 py-2.5 text-xs'>{OUTCOME_TEXT[m.outcome] || m.outcome}</td>
                                        <td className='px-4 py-2.5'>{money(m.botEntryFees)}</td>
                                        <td className='px-4 py-2.5 text-sky-600'>{money(m.botRefunds)}</td>
                                        <td className='px-4 py-2.5 text-emerald-600'>{money(m.botGrossWinnings)}</td>
                                        <td className={`px-4 py-2.5 font-bold ${tone(m.botNetProfit)}`}>{signed(m.botNetProfit)}</td>
                                        <td className='px-4 py-2.5 text-slate-500'>{money(m.platformCommission)}</td>
                                        <td className='px-4 py-2.5 text-xs text-slate-500 min-w-[320px]'>{explainMatch(m)}</td>
                                    </tr>
                                ))}
                                {!data.matches.length && <tr><td colSpan={10} className='px-4 py-8 text-center text-slate-400'>No {players ? `${players}-player ` : ''}bot matches on this day.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {pg.total > 0 && (
                        <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100'>
                            <div className='flex items-center gap-3 text-xs text-slate-500'>
                                <span>Showing <b className='text-slate-700'>{firstRow}–{lastRow}</b> of <b className='text-slate-700'>{pg.total.toLocaleString()}</b></span>
                                <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className='h-8 px-2 border-[1.5px] border-slate-200 rounded-lg text-xs bg-slate-50 cursor-pointer'>
                                    {PAGE_SIZES.map(n => <option key={n} value={n}>{n} per page</option>)}
                                </select>
                            </div>
                            {pg.totalPages > 1 && (
                                <div className='flex items-center gap-1.5 flex-wrap'>
                                    <PageBtn onClick={() => setPage(1)} disabled={pg.page === 1 || loading}>«</PageBtn>
                                    <PageBtn onClick={() => setPage(p => p - 1)} disabled={pg.page === 1 || loading}>‹</PageBtn>
                                    {pageNums.map((p, i) => p === '…'
                                        ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                                        : <PageBtn key={p} onClick={() => setPage(p)} active={p === pg.page}>{p}</PageBtn>)}
                                    <PageBtn onClick={() => setPage(p => p + 1)} disabled={pg.page === pg.totalPages || loading}>›</PageBtn>
                                    <PageBtn onClick={() => setPage(pg.totalPages)} disabled={pg.page === pg.totalPages || loading}>»</PageBtn>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </>}

            {/* 5. Target settings */}
            <Fold title='Target settings' sub={cfgData?.current?.targetPercent ? `Current target: ${cfgData.current.targetPercent}% · at least ${cfgData.current.minSampleSize} settled match(es)` : 'No target set'}>
                <div className='flex flex-wrap gap-3 items-end'>
                    <label className='text-xs font-semibold text-slate-500'>Target %
                        <select className={`${inpCls} block mt-1 cursor-pointer`} value={cfg.targetPercent} onChange={e => setCfg({ ...cfg, targetPercent: e.target.value })}>
                            <option value=''>No target</option>{PERCENTS.map(p => <option key={p} value={p}>{p}%</option>)}
                        </select>
                    </label>
                    <label className='text-xs font-semibold text-slate-500'>Check after (matches)
                        <input type='number' min={1} className={`${inpCls} block mt-1 w-28`} value={cfg.minSampleSize} onChange={e => setCfg({ ...cfg, minSampleSize: e.target.value })} />
                    </label>
                    <label className='text-xs font-semibold text-slate-500 flex-1 min-w-48'>Reason for change
                        <input className={`${inpCls} block mt-1 w-full`} value={cfg.reason} onChange={e => setCfg({ ...cfg, reason: e.target.value })} placeholder='At least 5 characters' />
                    </label>
                    <button className={btnCls} disabled={busy === 'cfg' || cfg.reason.trim().length < 5} onClick={saveCfg}>{busy === 'cfg' ? 'Saving…' : 'Save'}</button>
                </div>
                <p className='text-xs text-slate-400 mt-3'>
                    Target amount = bots' entry fees for the day (after refunds, settled matches only) × target %. Every change is saved with your name and reason.
                </p>
            </Fold>

            {/* 6. Bot difficulty (policy On / Off) */}
            <Fold title='Bot difficulty' sub={pol?.error ? 'Could not load' : !pol ? 'Loading…' : polOn ? 'On · bots play HARD when below target' : 'Off · every bot plays its own setting'}>
                {pol?.error ? (
                    <p className='text-sm text-red-600'>{pol.error}</p>
                ) : (
                    <>
                        <div className='flex items-center gap-2 mb-3'>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${polOn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>{polOn ? 'On' : 'Off'}</span>
                            {pol?.current && <span className='text-xs text-slate-400'>v{pol.current.version} · changed {when(pol.current.createdAt)}</span>}
                        </div>
                        <ul className='text-xs text-slate-500 space-y-1 mb-3 list-disc pl-4'>
                            <li>When <b>On</b>: for the first {pol?.window?.minutes ?? 30} minutes after it was first turned on, every new bot plays {pol?.window?.difficulty ?? 'HARD'}. After that, new bots play <b>HARD</b> while the day is <b>Below target</b>, and their own setting otherwise.</li>
                            <li>When <b>Off</b>: every bot plays its own setting.</li>
                            <li>It changes only how well a bot plays. Dice, moves and payouts are never touched. A running match keeps its level.</li>
                            {pol?.window?.active && <li className='text-emerald-700'>The first-{pol.window.minutes}-minute window is running until {when(pol.window.endsAt)}.</li>}
                        </ul>
                        <div className='flex flex-wrap gap-3 items-end'>
                            <label className='text-xs font-semibold text-slate-500 flex-1 min-w-48'>Reason for change
                                <input className={`${inpCls} block mt-1 w-full`} value={polReason} onChange={e => setPolReason(e.target.value)} placeholder='At least 5 characters' />
                            </label>
                            <button className={polOn ? btnCls.replace('bg-indigo-600 hover:bg-indigo-700', 'bg-slate-600 hover:bg-slate-700') : btnCls} disabled={!pol || busy === 'pol' || polReason.trim().length < 5} onClick={togglePolicy}>
                                {busy === 'pol' ? 'Saving…' : polOn ? 'Turn off' : 'Turn on'}
                            </button>
                        </div>
                        <p className='text-xs text-slate-400 mt-3'>Every change is saved with your name and reason.</p>
                    </>
                )}
            </Fold>

            {/* 7. Advanced - hidden on request (2026-10-27). The backend endpoints still work; remove this
                comment wrapper to show the section again. ADVANCED_HIDDEN_START
            <Fold title='Advanced' sub='Fix missed records, change history and audit trail'>
                <div className='space-y-5'>
                    <div>
                        <p className='text-sm font-semibold text-slate-700'>Backfill missed records</p>
                        <p className='text-xs text-slate-400 mb-2'>Rebuilds the bot numbers for these days from the wallet ledger. Safe to run again; it never moves money. Max 31 days.</p>
                        <div className='flex flex-wrap items-end gap-2'>
                            <input type='date' className={inpCls} value={bf.from} max={bf.to || istToday()} onChange={e => setBf({ ...bf, from: e.target.value })} />
                            <span className='text-xs text-slate-400 self-center'>to</span>
                            <input type='date' className={inpCls} value={bf.to} min={bf.from} max={istToday()} onChange={e => setBf({ ...bf, to: e.target.value })} />
                            <input className={`${inpCls} flex-1 min-w-48`} value={bf.reason} onChange={e => setBf({ ...bf, reason: e.target.value })} placeholder='Reason (at least 5 characters)' />
                            <button className={btnCls} disabled={busy === 'bf' || bf.reason.trim().length < 5} onClick={runBackfill}>{busy === 'bf' ? 'Running…' : 'Run backfill'}</button>
                        </div>
                    </div>

                    <div>
                        <p className='text-sm font-semibold text-slate-700 mb-1'>Target change history</p>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-xs min-w-[480px]'>
                                <thead><tr className='text-left text-slate-400'><th className='py-1'>Version</th><th>Target</th><th>Check after</th><th>When</th><th>Reason</th></tr></thead>
                                <tbody>
                                    {(cfgData?.history || []).map(h => (
                                        <tr key={h.id} className='border-t border-slate-100'>
                                            <td className='py-1.5'>v{h.version}</td><td>{h.targetPercent ? `${h.targetPercent}%` : 'None'}</td><td>{h.minSampleSize}</td><td>{when(h.createdAt)}</td><td>{h.reason}</td>
                                        </tr>
                                    ))}
                                    {!(cfgData?.history || []).length && <tr><td colSpan={5} className='py-2 text-slate-400'>No changes yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <p className='text-sm font-semibold text-slate-700 mb-1'>Audit trail</p>
                        <div className='overflow-x-auto'>
                            <table className='w-full text-xs min-w-[480px]'>
                                <thead><tr className='text-left text-slate-400'><th className='py-1'>When</th><th>Action</th><th>Admin</th><th>Reason</th></tr></thead>
                                <tbody>
                                    {audit.map(a => (
                                        <tr key={a.id} className='border-t border-slate-100'>
                                            <td className='py-1.5 whitespace-nowrap'>{when(a.createdAt)}</td><td>{a.action.replaceAll('_', ' ').toLowerCase()}</td><td className='font-mono'>{a.adminId.slice(0, 8)}</td><td>{a.reason}</td>
                                        </tr>
                                    ))}
                                    {!audit.length && <tr><td colSpan={4} className='py-2 text-slate-400'>No changes recorded yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Fold>
            ADVANCED_HIDDEN_END */}

            {openMatch && <DetailDrawer matchId={openMatch} onClose={() => setOpenMatch(null)} />}
        </div>
    );
}
