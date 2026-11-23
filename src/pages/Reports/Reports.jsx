import { useState, useEffect, useCallback } from 'react';
import { fetchOverview, downloadReport } from '../../api';
import { toast } from '../../toast';
import TimezoneSelect from '../../components/TimezoneSelect';
import { useTimezone, getTz, todayIn, dayRangeText } from '../../utils/timezone';

const money = n => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n || 0));
const tone = n => n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-slate-800';
// India-time calendar day, YYYY-MM-DD
// Old (India day only): const istDay = (back = 0) => new Date(Date.now() + 330 * 60000 - back * 86400000).toISOString().slice(0, 10);
const istDay = (back = 0) => todayIn(getTz(), back); // today in the chosen timezone (IST default / UTC)
const nice = d => new Date(`${d}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
const MAX_DAYS = 31;

const PRESETS = [
    { key: 'today',     label: 'Today',     range: () => [istDay(), istDay()] },
    { key: 'yesterday', label: 'Yesterday', range: () => [istDay(1), istDay(1)] },
    { key: '7d',        label: 'Last 7 days',  range: () => [istDay(6), istDay()] },
    { key: '30d',       label: 'Last 30 days', range: () => [istDay(29), istDay()] },
];

const REPORTS = [
    { kind: 'summary',      title: 'Profit & Loss summary', desc: 'Platform profit, commission, users vs bots, money check, by entry fee and by day.' },
    { kind: 'matches',      title: 'Matches',               desc: 'Every match: key, status, players (user / bot), winner, entry fees, winnings, refunds, commission.' },
    { kind: 'players',      title: 'Players',               desc: 'Every user and bot who played: matches, wins, paid, won, refunded and net result.' },
    // [Game-only transactions, 2026-10-27] Transactions report description: game money only.
    { kind: 'transactions', title: 'Transactions',          desc: 'Every game transaction (entry fee, winnings, refund): time, player, amount in / out, balance before and after, match key.' },
];

const box = 'bg-white rounded-2xl border border-slate-100 shadow-sm';
const inp = 'h-9 px-2 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none focus:border-indigo-500';

const DownloadIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'>
        <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' y1='15' x2='12' y2='3'/>
    </svg>
);

// The API sends errors as JSON, but a blob download receives them as a Blob - read the message out of it.
async function blobError(e) {
    try { return JSON.parse(await e.response.data.text()).message; } catch { return e.message || 'Download failed'; }
}

export default function Reports() {
    const [preset, setPreset] = useState('today');
    const [startDate, setStartDate] = useState(istDay());
    const [endDate, setEndDate] = useState(istDay());
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const tz = useTimezone(); // IST (default) or UTC

    // Switching timezone moves a preset (Today / Yesterday / ...) to that timezone's days.
    useEffect(() => {
        const p = PRESETS.find(x => x.key === preset);
        if (p) { const [s, e] = p.range(); setStartDate(s); setEndDate(e); }
    }, [tz]); // eslint-disable-line react-hooks/exhaustive-deps

    const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;
    const rangeError = !startDate || !endDate ? 'Pick both dates'
        : startDate > endDate ? 'Start date must be before end date'
        : days > MAX_DAYS ? `Pick at most ${MAX_DAYS} days` : '';

    const load = useCallback(() => {
        if (rangeError) { setPreview(null); return; }
        setPreview(null); setError('');
        fetchOverview({ startDate, endDate, tz })
            .then(r => setPreview(r.data.data))
            .catch(e => setError(e.response?.data?.message || 'Failed to load preview'));
    }, [startDate, endDate, rangeError, tz]);
    useEffect(() => { load(); }, [load]);

    const pick = p => { setPreset(p.key); const [s, e] = p.range(); setStartDate(s); setEndDate(e); };

    const download = async kind => {
        setBusy(kind);
        try {
            const res = await downloadReport(kind, { startDate, endDate, tz });
            // Old: const span = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
            const span = (startDate === endDate ? startDate : `${startDate}_to_${endDate}`) + (tz === 'UTC' ? '_UTC' : '');
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url; a.download = `ludo-${kind}-${span}.csv`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success('Report downloaded');
        } catch (e) {
            toast.error(await blobError(e));
        } finally { setBusy(''); }
    };

    const downloadAll = async () => { for (const r of REPORTS) await download(r.kind); };

    return (
        <div className='space-y-4'>
            {/* Period */}
            <div className={box + ' p-4 space-y-3'}>
                <div className='flex flex-col lg:flex-row lg:items-center gap-3 justify-between'>
                    <div className='flex flex-wrap p-0.5 bg-slate-100 rounded-xl'>
                        {PRESETS.map(p => (
                            <button key={p.key} onClick={() => pick(p)}
                                className={`px-3.5 h-8 rounded-[10px] text-xs font-semibold transition-all ${preset === p.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{p.label}</button>
                        ))}
                    </div>
                    <div className='flex items-center gap-2 text-xs text-slate-500'>
                        <input type='date' value={startDate} max={endDate || istDay()} onChange={e => { setPreset(''); setStartDate(e.target.value); }} className={inp} />
                        <span>to</span>
                        <input type='date' value={endDate} min={startDate} max={istDay()} onChange={e => { setPreset(''); setEndDate(e.target.value); }} className={inp} />
                        <TimezoneSelect label={false} />
                        <button onClick={load} disabled={!!rangeError} className='h-9 px-3 rounded-xl border-[1.5px] border-slate-200 text-sm font-semibold text-slate-600 bg-slate-50 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-50 transition-all'>Refresh</button>
                    </div>
                </div>
                <p className='text-xs text-slate-400'>
                    {rangeError ? <span className='text-red-600 font-semibold'>{rangeError}</span>
                        : <>Report for <b className='text-slate-600'>{startDate === endDate ? nice(startDate) : `${nice(startDate)} – ${nice(endDate)}`}</b> ({days} day{days > 1 ? 's' : ''}), {dayRangeText(tz)}. Up to {MAX_DAYS} days per report.</>}
                </p>
            </div>

            {/* Preview */}
            {error && <div className='p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700'>{error}</div>}
            {!rangeError && !error && (
                !preview ? (
                    <div className='grid grid-cols-2 lg:grid-cols-5 gap-3'>{[1, 2, 3, 4, 5].map(i => <div key={i} className='h-24 bg-white rounded-2xl border border-slate-100 animate-pulse' />)}</div>
                ) : (
                    <>
                        <div className='grid grid-cols-2 lg:grid-cols-5 gap-3'>
                            {[
                                ['Platform profit', signed(preview.profit.platformProfit), tone(preview.profit.platformProfit)],
                                ['Commission', money(preview.profit.commission), 'text-indigo-600'],
                                ['Bots won / lost', signed(preview.profit.botNet), tone(preview.profit.botNet)],
                                ['Users won / lost', signed(preview.profit.usersNet), tone(preview.profit.usersNet)],
                                ['Matches', `${preview.matches.total}`, 'text-slate-800'],
                            ].map(([l, v, c]) => (
                                <div key={l} className={box + ' p-4'}>
                                    <p className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{l}</p>
                                    <p className={`text-lg font-bold mt-1 ${c}`}>{v}</p>
                                </div>
                            ))}
                        </div>
                        <div className={`rounded-2xl border px-5 py-3 text-sm font-semibold ${preview.validation.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            {preview.validation.ok
                                ? `✓ Money check passed: all ${preview.validation.checkedMatches} matches in this period balance`
                                : `⚠ ${preview.validation.mismatchCount} match(es) in this period do not balance (${signed(preview.validation.unaccounted)}). They are listed in the summary report.`}
                        </div>
                    </>
                )
            )}

            {/* Downloads */}
            <div className={box + ' overflow-hidden'}>
                <div className='px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3'>
                    <div>
                        <p className='text-sm font-bold text-slate-700'>Download reports</p>
                        <p className='text-xs text-slate-400 mt-0.5'>CSV files open in Excel or Google Sheets</p>
                    </div>
                    <button onClick={downloadAll} disabled={!!rangeError || !!busy}
                        className='h-9 px-4 rounded-xl text-sm font-semibold text-indigo-600 border-[1.5px] border-indigo-200 hover:bg-indigo-50 disabled:opacity-50'>Download all</button>
                </div>
                <div className='divide-y divide-slate-50'>
                    {REPORTS.map((r, i) => (
                        <div key={r.kind} className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4'>
                            <div className='flex gap-3'>
                                <span className='w-7 h-7 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center'>{i + 1}</span>
                                <div>
                                    <p className='text-sm font-semibold text-slate-800'>{r.title}</p>
                                    <p className='text-xs text-slate-400 mt-0.5'>{r.desc}</p>
                                </div>
                            </div>
                            <button onClick={() => download(r.kind)} disabled={!!rangeError || !!busy}
                                className='h-9 px-4 shrink-0 inline-flex items-center gap-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'>
                                <DownloadIcon />{busy === r.kind ? 'Preparing…' : 'Download CSV'}
                            </button>
                        </div>
                    ))}
                </div>
                <p className='px-5 py-3 text-[11px] text-slate-400 border-t border-slate-50'>
                    Summary and Players reports count settled matches only (finished + paid), on the day the match finished - the same as Profit &amp; Loss, the Matches cards and Bot Analytics. The Matches report lists every match with a Settled column; the Transactions report lists every transaction by its own time.
                    Numbers are the same as the Profit &amp; Loss and Matches pages.
                </p>
            </div>
        </div>
    );
}
