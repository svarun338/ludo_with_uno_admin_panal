import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
    fetchPools, createPool, updatePool, togglePool, deletePool,
    fetchPoolDetail, fetchMatchSettings, updateMatchSettings,
} from '../../api';
import { cacheGet, cacheSet, cacheHas, cacheClear } from '../../cache';
import { toast } from '../../toast';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import PageBtn from '../../components/PageBtn';
import EntryFees from './EntryFees';
import QuickMatchConfig from './QuickMatchConfig';

/* ── Icons ── */
const SearchIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>;
const PlusIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>;
const EditIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>;
const TrashIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/><path d='M10 11v6'/><path d='M14 11v6'/><path d='M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/></svg>;
const ViewIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>;
const XIcon      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' stroke='currentColor' className='w-4 h-4'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>;
const ChevL      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevR      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='9 18 15 12 9 6'/></svg>;
const EmptyIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-10 h-10'><rect x='2' y='3' width='20' height='14' rx='2'/><line x1='8' y1='21' x2='16' y2='21'/><line x1='12' y1='17' x2='12' y2='21'/></svg>;
const ChevDown   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3 h-3'><polyline points='6 9 12 15 18 9'/></svg>;

const PAGE_LIMIT = 20;

const STATUS_OPTIONS = [
    { value: '',      label: 'All Status' },
    { value: 'true',  label: 'Active'     },
    { value: 'false', label: 'Inactive'   },
    { value: 'completed', label: 'Completed' },
];
const PLAYERS_OPTIONS = [
    { value: '',  label: 'All Players' },
    { value: '2', label: '2 Players'   },
    { value: '4', label: '4 Players'   },
];
const SORT_OPTIONS = [
    { value: 'createdAt', label: 'Created Date' },
    { value: 'name',      label: 'Name'         },
    { value: 'entryFee',  label: 'Entry Fee'    },
];

const inputCls = err =>
    `w-full h-10 px-3.5 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${
        err ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/10'}`;

const selectCls = 'w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10';

/* ── Status toggle ── */
const ToggleSwitch = memo(function ToggleSwitch({ id, initial, name, onUpdated }) {
    const [active, setActive] = useState(initial);
    const [busy,   setBusy]   = useState(false);

    const toggle = useCallback(async () => {
        setBusy(true);
        try {
            const res  = await togglePool(id);
            const next = res.data?.data?.isActive ?? !active;
            setActive(next);
            onUpdated?.(id, next);
            next ? toast.success(`"${name}" enabled`) : toast.warning(`"${name}" disabled`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Toggle failed');
        } finally { setBusy(false); }
    }, [active, id, name, onUpdated]);

    return (
        <button onClick={toggle} disabled={busy}
            title={active ? 'Click to disable' : 'Click to enable'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:opacity-80 disabled:opacity-60 ${
                active ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                       : 'bg-slate-100 text-slate-500 border-slate-200'}`}
        >
            {busy ? <span className='w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin'/>
                  : <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`}/>}
            {active ? 'Active' : 'Inactive'}
        </button>
    );
});

/* ── Filter input ── */
const FilterInput = memo(function FilterInput({ label, placeholder, value, onChange }) {
    return (
        <div className='flex flex-col gap-1.5'>
            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</label>
            <div className='relative'>
                <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'><SearchIcon /></span>
                <input type='text' placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
                    className='w-full h-9 pl-8 pr-7 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300' />
                {value && <button onClick={() => onChange('')} className='absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400 transition-colors'><XIcon /></button>}
            </div>
        </div>
    );
});

/* ── Skeleton ── */
const Skeleton = memo(function Skeleton({ rows = 8 }) {
    return <>{Array.from({length: rows}).map((_, i) => (
        <tr key={i} className='border-b border-slate-50'>
            {[30, 140, 70, 60, 80, 60, 60, 80, 80, 120].map((w, j) => (
                <td key={j} className='px-5 py-4'>
                    <div className='h-3 bg-slate-100 rounded animate-pulse' style={{width: w}}/>
                </td>
            ))}
        </tr>
    ))}</>;
});

/* ── Public Match on/off — a database-backed setting (AppSetting), not a .env edit.
   Admin-approved entry fees and Quick Match are never affected by this toggle. ── */
const PublicMatchSettingCard = () => {
    const [enabled, setEnabled] = useState(null); // null = still loading
    const [busy,    setBusy]    = useState(false);
    const [error,   setError]   = useState('');

    useEffect(() => {
        let alive = true;
        fetchMatchSettings()
            .then(res => { if (alive) setEnabled(!!res.data?.data?.publicMatchEnabled); })
            .catch(() => { if (alive) setError('Could not load Public Match setting'); });
        return () => { alive = false; };
    }, []);

    const toggle = async () => {
        setBusy(true); setError('');
        try {
            const res = await updateMatchSettings({ publicMatchEnabled: !enabled });
            const next = !!res.data?.data?.publicMatchEnabled;
            setEnabled(next);
            next ? toast.success('Public Match enabled — restored exactly as before')
                 : toast.warning('Public Match disabled — hidden from players, Quick Match & Private Room unaffected');
        } catch (e) {
            setError(e.response?.data?.message || 'Update failed');
            toast.error('Failed to update Public Match setting');
        } finally { setBusy(false); }
    };

    return (
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap'>
            <div>
                <p className='text-sm font-bold text-slate-700'>Public Match</p>
                <p className='text-xs text-slate-400 mt-0.5 max-w-md'>
                    When off, players only see Quick Match and Private Room. The Public Match
                    implementation itself is kept intact — turning this back on restores it exactly.
                </p>
                {error && <p className='text-[11px] text-red-500 mt-1'>{error}</p>}
            </div>
            <button onClick={toggle} disabled={busy || enabled === null}
                role='switch' aria-checked={!!enabled}
                title={enabled ? 'Click to disable' : 'Click to enable'}
                className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-bold border transition-all disabled:opacity-60 ${
                    enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'}`}
            >
                {busy
                    ? <span className='w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin' />
                    : <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />}
                {enabled === null ? 'Loading…' : enabled ? 'Enabled' : 'Disabled'}
            </button>
        </div>
    );
};

/* ── Private Room entry-fee range (min / max) — AppSetting-backed. When set, hosts type any
   amount inside it; when cleared, they pick from the approved Entry Fees as before. ── */
const PrivateFeeRangeCard = () => {
    const [loaded, setLoaded] = useState(false);
    const [min,    setMin]    = useState('');
    const [max,    setMax]    = useState('');
    const [saved,  setSaved]  = useState({ min: null, max: null });
    const [busy,   setBusy]   = useState(false);
    const [error,  setError]  = useState('');

    useEffect(() => {
        let alive = true;
        fetchMatchSettings()
            .then(res => {
                if (!alive) return;
                const d = res.data?.data || {};
                setSaved({ min: d.privateEntryFeeMin ?? null, max: d.privateEntryFeeMax ?? null });
                setMin(d.privateEntryFeeMin ?? ''); setMax(d.privateEntryFeeMax ?? '');
                setLoaded(true);
            })
            .catch(() => { if (alive) setError('Could not load private entry fee range'); });
        return () => { alive = false; };
    }, []);

    const amountOk = v => /^\d+(\.\d{1,2})?$/.test(v.trim());

    const save = async (clear = false) => {
        setError('');
        if (!clear) {
            if (!amountOk(min) || !amountOk(max)) { setError('Enter both amounts (up to 2 decimals)'); return; }
            if (Number(min) <= 0) { setError('Minimum must be greater than 0'); return; }
            if (Number(max) < Number(min)) { setError('Maximum must be at least the minimum'); return; }
        }
        setBusy(true);
        try {
            const res = await updateMatchSettings(clear
                ? { privateEntryFeeMin: null, privateEntryFeeMax: null }
                : { privateEntryFeeMin: min.trim(), privateEntryFeeMax: max.trim() });
            const d = res.data?.data || {};
            setSaved({ min: d.privateEntryFeeMin ?? null, max: d.privateEntryFeeMax ?? null });
            setMin(d.privateEntryFeeMin ?? ''); setMax(d.privateEntryFeeMax ?? '');
            clear ? toast.warning('Range cleared — Private Room uses the approved Entry Fees')
                  : toast.success('Private Room entry fee range saved');
        } catch (e) {
            setError(e.response?.data?.message || 'Update failed');
            toast.error('Failed to update private entry fee range');
        } finally { setBusy(false); }
    };

    const active = saved.min !== null && saved.max !== null;

    return (
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 mt-4'>
            <div className='flex items-center justify-between gap-3 flex-wrap'>
                <div>
                    <p className='text-sm font-bold text-slate-700'>Private Room Entry Fee Range</p>
                    <p className='text-xs text-slate-400 mt-0.5 max-w-md'>
                        When a minimum and maximum are set, players hosting a private room type any entry fee
                        inside the range. When cleared, they choose from the approved Entry Fees below.
                        Quick Match is never affected.
                    </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {active ? `Active: ₹${saved.min} – ₹${saved.max}` : 'Not set (approved fees)'}
                </span>
            </div>
            <div className='flex items-end gap-3 flex-wrap mt-3'>
                <div className='flex flex-col gap-1.5'>
                    <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Min (₹)</label>
                    <input className='h-9 w-32 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:border-indigo-500'
                        value={min} onChange={e => setMin(e.target.value)} disabled={!loaded || busy} inputMode='decimal' placeholder='e.g. 5' />
                </div>
                <div className='flex flex-col gap-1.5'>
                    <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Max (₹)</label>
                    <input className='h-9 w-32 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:border-indigo-500'
                        value={max} onChange={e => setMax(e.target.value)} disabled={!loaded || busy} inputMode='decimal' placeholder='e.g. 500' />
                </div>
                <button onClick={() => save(false)} disabled={!loaded || busy}
                    className='h-9 px-4 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60'>
                    {busy ? 'Saving…' : 'Save Range'}
                </button>
                {active && (
                    <button onClick={() => save(true)} disabled={busy}
                        className='h-9 px-4 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60'>
                        Clear
                    </button>
                )}
            </div>
            {error && <p className='text-[11px] text-red-500 mt-2'>{error}</p>}
        </div>
    );
};

/* ── Pool Form Modal (Create + Edit) ── */
const PoolModal = memo(function PoolModal({ open, onClose, onSaved, pool }) {
    const isEdit = !!pool;
    const EMPTY  = { name: '', description: '', entryFee: '', maxPlayers: 2, targetOpenMatches: '', isActive: true };
    const [form,     setForm]     = useState(EMPTY);
    const [errors,   setErrors]   = useState({});
    const [apiError, setApiError] = useState('');
    const [saving,   setSaving]   = useState(false);
    const firstRef = useRef(null);

    useEffect(() => {
        if (open) {
            setForm(pool
                ? { name: pool.name || '', description: pool.description || '', entryFee: pool.entryFee || '', maxPlayers: pool.maxPlayers || 2, targetOpenMatches: pool.targetOpenMatches ?? '', isActive: pool.isActive ?? true }
                : EMPTY
            );
            setErrors({}); setApiError('');
            setTimeout(() => firstRef.current?.focus(), 60);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const validate = () => {
        const e = {};
        if (!form.name.trim())    e.name     = 'Pool name is required';
        if (!form.entryFee || isNaN(Number(form.entryFee)) || Number(form.entryFee) <= 0)
                                  e.entryFee = 'Enter a valid entry fee';
        if (form.targetOpenMatches !== '' &&
            (isNaN(Number(form.targetOpenMatches)) || !Number.isInteger(Number(form.targetOpenMatches)) ||
             Number(form.targetOpenMatches) < 0 || Number(form.targetOpenMatches) > 50))
                                  e.targetOpenMatches = 'Enter a whole number from 0 to 50';
        return e;
    };

    const change = (f, v) => { setForm(p => ({...p, [f]: v})); setErrors(p => ({...p, [f]: ''})); setApiError(''); };

    const submit = async () => {
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSaving(true);
        try {
            const payload = {
                name:              form.name.trim(),
                description:       form.description.trim() || undefined,
                entryFee:          String(form.entryFee),
                maxPlayers:        Number(form.maxPlayers),
                targetOpenMatches: form.targetOpenMatches === '' ? 0 : Number(form.targetOpenMatches),
                isActive:          !!form.isActive,
            };
            const res = isEdit ? await updatePool(pool.id, payload) : await createPool(payload);
            toast.success(isEdit ? 'Pool updated' : 'Pool created');
            onSaved?.(res.data?.data);
            onClose();
        } catch (e) {
            setApiError(e.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    // Only shown when editing an existing pool, using the real platform commission the
    // server already resolved from WinConfig — never a hardcoded percentage.
    const prizePool = pool && pool.platformFeePercent != null && form.entryFee && !isNaN(Number(form.entryFee))
        ? (Number(form.entryFee) * Number(form.maxPlayers) * (100 - pool.platformFeePercent) / 100).toFixed(2)
        : null;

    return (
        <div className='fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4' onClick={onClose}>
            <div className='bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden' onClick={e => e.stopPropagation()}>
                <div className='px-6 py-5 flex items-center justify-between bg-indigo-600'>
                    <div>
                        <h3 className='text-white font-bold text-base'>{isEdit ? 'Edit Pool' : 'Create Pool'}</h3>
                        <p className='text-indigo-200 text-xs mt-0.5'>{isEdit ? pool.name : 'Set up a new game pool'}</p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white transition-colors'><XIcon /></button>
                </div>

                <div className='px-6 py-5 space-y-4'>
                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Pool Name</label>
                        <input ref={firstRef} type='text' value={form.name} onChange={e => change('name', e.target.value)}
                            placeholder='e.g. Gold Pool' className={inputCls(errors.name)} />
                        {errors.name && <p className='text-[10px] text-red-500'>{errors.name}</p>}
                    </div>

                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                            Description <span className='normal-case font-normal text-slate-400'>(optional)</span>
                        </label>
                        <input type='text' value={form.description} onChange={e => change('description', e.target.value)}
                            placeholder='Short description…' className={inputCls(false)} />
                    </div>

                    <div className='grid grid-cols-2 gap-3'>
                        <div className='space-y-1.5'>
                            <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Entry Fee (₹)</label>
                            <input type='text' value={form.entryFee} onChange={e => change('entryFee', e.target.value)}
                                placeholder='e.g. 100' className={inputCls(errors.entryFee)} />
                            {errors.entryFee && <p className='text-[10px] text-red-500'>{errors.entryFee}</p>}
                        </div>
                        <div className='space-y-1.5'>
                            <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Max Players</label>
                            <div className='flex gap-2 h-10 items-center'>
                                {[2, 4].map(n => (
                                    <button key={n} type='button' onClick={() => change('maxPlayers', n)}
                                        className={`flex-1 h-10 rounded-xl text-sm font-bold border-[1.5px] transition-all ${
                                            form.maxPlayers === n
                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                        }`}>{n}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                            Quick Match — Initial Matches <span className='normal-case font-normal text-slate-400'>(optional)</span>
                        </label>
                        <input type='text' inputMode='numeric' value={form.targetOpenMatches}
                            onChange={e => change('targetOpenMatches', e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder='0 = off — only create a match when a player joins'
                            className={inputCls(errors.targetOpenMatches)} />
                        {errors.targetOpenMatches
                            ? <p className='text-[10px] text-red-500'>{errors.targetOpenMatches}</p>
                            : <p className='text-[10px] text-slate-400'>How many matches are created and shown to players straight away (e.g. 3 = Match #1, #2, #3 at 0/4). The system also keeps this many open by replacing a match the moment it fills.</p>}
                    </div>

                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Status</label>
                        <div className='flex gap-2 h-10 items-center'>
                            {[{ v: true, l: 'Active' }, { v: false, l: 'Inactive' }].map(({ v, l }) => (
                                <button key={l} type='button' onClick={() => change('isActive', v)}
                                    className={`flex-1 h-10 rounded-xl text-sm font-bold border-[1.5px] transition-all ${
                                        form.isActive === v
                                            ? (v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-100 text-slate-500')
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}>{l}</button>
                            ))}
                        </div>
                        <p className='text-[10px] text-slate-400'>
                            Active pools appear in Quick Match. Disabling keeps existing rooms/players safe — it only stops new matchmaking for this pool.
                        </p>
                    </div>

                    {prizePool && (
                        <div className='flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3'>
                            <span className='text-xs font-semibold text-indigo-600'>Prize Pool (est.)</span>
                            <span className='text-sm font-bold text-indigo-700'>₹{prizePool}</span>
                        </div>
                    )}

                    {apiError && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiError}</p>}
                </div>

                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className='flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60'>
                        {saving ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : (isEdit ? 'Save Changes' : '+ Create Pool')}
                    </button>
                </div>
            </div>
        </div>
    );
});

/* ── Pool Detail Modal ── */
function PoolDetailModal({ pool, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedRoom, setExpandedRoom] = useState(null);

    useEffect(() => {
        if (!pool) return;
        setLoading(true);
        fetchPoolDetail(pool.id)
            .then(r => setDetail(r.data?.data))
            .catch(() => toast.error('Failed to load pool detail'))
            .finally(() => setLoading(false));
    }, [pool?.id]);

    if (!pool) return null;

    // Colours keyed to the normalized labels the backend already computes
    // (see pool.controller.js matchStateOf) — WAITING/FILLING/FULL/STARTED/COMPLETED.
    // The database enum itself (WAITING/READY/PLAYING/COMPLETED) is untouched.
    const statusBadge = s => {
        const map = {
            WAITING:   'bg-sky-50 text-sky-700 border-sky-200',
            FILLING:   'bg-amber-50 text-amber-700 border-amber-200',
            FULL:      'bg-rose-50 text-rose-700 border-rose-200',
            STARTED:   'bg-indigo-50 text-indigo-700 border-indigo-200',
            COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            CANCELLED: 'bg-red-50 text-red-700 border-red-200',
        };
        return map[s] || 'bg-slate-50 text-slate-600 border-slate-200';
    };

    return (
        <div className='fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4' onClick={onClose}>
            <div className='bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col' onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className='flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0'>
                    <div>
                        <h2 className='text-base font-bold text-slate-800'>{pool.name}</h2>
                        <p className='text-xs text-slate-500 mt-0.5'>Pool ID: {pool.id}</p>
                    </div>
                    <button onClick={onClose} className='p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors'><XIcon /></button>
                </div>

                <div className='overflow-y-auto flex-1 px-6 py-4 space-y-6'>
                    {loading ? (
                        <div className='flex items-center justify-center py-16'>
                            <span className='w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin'/>
                        </div>
                    ) : detail ? (
                        <>
                            {/* Pool Info Grid */}
                            <div>
                                <h3 className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3'>Pool Details</h3>
                                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                                    {[
                                        { label: 'Entry Fee',    value: `₹${detail.entryFee}` },
                                        { label: 'Max Players',  value: detail.maxPlayers },
                                        { label: 'Status',       value: detail.status === 'COMPLETED' ? 'Completed' : (detail.isActive ? 'Active' : 'Inactive') },
                                        { label: 'Created',      value: fmtDate(detail.createdAt) },
                                    ].map(({ label, value }) => (
                                        <div key={label} className='bg-slate-50 rounded-xl px-4 py-3'>
                                            <p className='text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1'>{label}</p>
                                            <p className='text-sm font-bold text-slate-800'>{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Stats */}
                            <div>
                                <h3 className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3'>Statistics</h3>
                                <div className='grid grid-cols-2 sm:grid-cols-5 gap-3'>
                                    {[
                                        { label: 'Open / Target',      value: `${detail.stats?.openMatches ?? 0} / ${detail.stats?.targetOpenMatches ?? 0}`, color: 'text-rose-700' },
                                        { label: 'Total Rooms',        value: detail.stats?.totalRooms ?? 0,          color: 'text-indigo-700' },
                                        { label: 'Completed Rooms',    value: detail.stats?.completedRooms ?? 0,      color: 'text-emerald-700' },
                                        { label: 'Players Joined',     value: detail.stats?.totalJoinedPlayers ?? 0,  color: 'text-sky-700' },
                                        { label: 'Prize Distributed',  value: `₹${detail.stats?.estimatedPrizePool ?? '0'}`, color: 'text-amber-700' },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} className='bg-slate-50 rounded-xl px-4 py-3'>
                                            <p className='text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1'>{label}</p>
                                            <p className={`text-sm font-bold ${color}`}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Rooms list */}
                            {detail.rooms?.length > 0 && (
                                <div>
                                    <h3 className='text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3'>
                                        Game Rooms ({detail.rooms.length})
                                    </h3>
                                    <div className='space-y-2'>
                                        {detail.rooms.map(room => (
                                            <div key={room.id} className='border border-slate-100 rounded-xl overflow-hidden'>
                                                <button
                                                    onClick={() => setExpandedRoom(expandedRoom === room.id ? null : room.id)}
                                                    className='w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left'
                                                >
                                                    <div className='flex items-center gap-3'>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge(room.matchState || room.roomStatus)}`}>
                                                            {room.matchState || room.roomStatus}
                                                        </span>
                                                        <span className='text-xs font-mono text-slate-500'>{room.roomId}</span>
                                                        <span className='text-xs text-slate-600'>{room.joinedPlayers}/{room.maxPlayers} players</span>
                                                        {room.winners?.length > 0 && (
                                                            <span className='text-xs text-amber-700 font-semibold'>🏆 {room.winners.length} winner{room.winners.length > 1 ? 's' : ''}</span>
                                                        )}
                                                    </div>
                                                    <div className='flex items-center gap-2 text-slate-400'>
                                                        <span className='text-xs'>{fmtDate(room.createdAt)}</span>
                                                        <span className={`transition-transform ${expandedRoom === room.id ? 'rotate-180' : ''}`}><ChevDown /></span>
                                                    </div>
                                                </button>

                                                {expandedRoom === room.id && (
                                                    <div className='border-t border-slate-50 px-4 py-3 bg-slate-50/50 space-y-3'>
                                                        {/* Players */}
                                                        <div>
                                                            <p className='text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2'>Participants</p>
                                                            <div className='space-y-1.5'>
                                                                {room.players?.length > 0 ? room.players.map(p => (
                                                                    <div key={p.userId} className='flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100'>
                                                                        <div>
                                                                            <span className='text-sm font-semibold text-slate-800'>{p.displayName}</span>
                                                                            {p.mobile && <span className='text-xs text-slate-400 ml-2'>{p.mobile}</span>}
                                                                        </div>
                                                                        <div className='flex items-center gap-2'>
                                                                            <span className={`inline-block w-3 h-3 rounded-full border`} style={{backgroundColor: p.color || '#ccc'}} title={`Color: ${p.color}`}/>
                                                                            {p.prizeAmount && (
                                                                                <span className='text-xs font-bold text-emerald-700'>₹{p.prizeAmount}</span>
                                                                            )}
                                                                            <span className='text-[10px] text-slate-400'>{p.status}</span>
                                                                        </div>
                                                                    </div>
                                                                )) : <p className='text-xs text-slate-400'>No participants</p>}
                                                            </div>
                                                        </div>

                                                        {/* Winners */}
                                                        {room.winners?.length > 0 && (
                                                            <div>
                                                                <p className='text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-2'>Winners</p>
                                                                <div className='space-y-1.5'>
                                                                    {room.winners.map((w, idx) => (
                                                                        <div key={idx} className='flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-100'>
                                                                            <div>
                                                                                <span className='text-sm font-semibold text-slate-800'>🏆 {w.displayName}</span>
                                                                                {w.mobile && <span className='text-xs text-slate-400 ml-2'>{w.mobile}</span>}
                                                                            </div>
                                                                            <span className='text-sm font-bold text-emerald-700'>₹{w.amount}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className='text-sm text-slate-400 text-center py-10'>Failed to load pool details</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Confirm Delete ── */
function ConfirmModal({ pool, onClose, onConfirm, busy }) {
    return (
        <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4' onClick={onClose}>
            <div className='bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6' onClick={e => e.stopPropagation()}>
                <h3 className='text-base font-bold text-slate-800 mb-2'>Delete Pool</h3>
                <p className='text-sm text-slate-500 mb-6'>
                    Delete <span className='font-semibold text-slate-700'>"{pool.name}"</span>? This cannot be undone.
                </p>
                <div className='flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50'>Cancel</button>
                    <button onClick={onConfirm} disabled={busy}
                        className='flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2'>
                        {busy ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════ */
const DEFAULT_PARAMS = { page: 1, limit: PAGE_LIMIT, name: '', isActive: '', maxPlayers: '', entryFeeMin: '', entryFeeMax: '', startDate: '', endDate: '', sortBy: 'createdAt', sortDir: 'desc' };
const DEFAULT_FIELDS = { name: '', entryFeeMin: '', entryFeeMax: '' };

function AllPools() {
    const [params,  setParams]  = useState(DEFAULT_PARAMS);
    const [fieldUI, setFieldUI] = useState(DEFAULT_FIELDS);
    const fieldRef = useRef(DEFAULT_FIELDS);
    const timerRef = useRef(null);

    const [pools,   setPools]   = useState([]);
    const [total,   setTotal]   = useState(0);
    const [pages,   setPages]   = useState(1);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    const [modal,      setModal]      = useState({ open: false, pool: null });
    const [detailPool, setDetailPool] = useState(null);
    const [delPool,    setDelPool]    = useState(null);
    const [delBusy,    setDelBusy]    = useState(false);

    /* Debounced text fields */
    const setField = useCallback((f, v) => {
        fieldRef.current = { ...fieldRef.current, [f]: v };
        setFieldUI({ ...fieldRef.current });
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() =>
            setParams(p => ({ ...p, page: 1, ...fieldRef.current })), 380);
    }, []);

    const onName       = useCallback(v => setField('name',       v), [setField]);
    const onFeeMin     = useCallback(v => setField('entryFeeMin', v), [setField]);
    const onFeeMax     = useCallback(v => setField('entryFeeMax', v), [setField]);

    const setStatus     = useCallback(v => setParams(p => ({ ...p, page: 1, isActive:    v })), []);
    const setMaxPlayers = useCallback(v => setParams(p => ({ ...p, page: 1, maxPlayers:  v })), []);
    const setStartDate  = useCallback(v => setParams(p => ({ ...p, page: 1, startDate:   v })), []);
    const setEndDate    = useCallback(v => setParams(p => ({ ...p, page: 1, endDate:     v })), []);
    const setSortBy     = useCallback(v => setParams(p => ({ ...p, page: 1, sortBy:      v })), []);
    const toggleSortDir = useCallback(() => setParams(p => ({ ...p, page: 1, sortDir: p.sortDir === 'desc' ? 'asc' : 'desc' })), []);
    const goToPage      = useCallback(pg => setParams(p => ({ ...p, page: pg })), []);

    const clearAll = useCallback(() => {
        clearTimeout(timerRef.current);
        fieldRef.current = DEFAULT_FIELDS;
        setFieldUI(DEFAULT_FIELDS);
        setParams({ ...DEFAULT_PARAMS });
    }, []);

    /* Fetch with cache */
    const doFetch = useCallback((p, force = false) => {
        const key = 'pools:' + JSON.stringify(p);
        if (!force && cacheHas(key)) {
            const c = cacheGet(key);
            setPools(c.pools ?? []); setTotal(c.total ?? 0); setPages(c.pages ?? 1);
            setLoading(false); return;
        }
        setError('');
        let cancelled = false;
        fetchPools(p)
            .then(r => {
                if (cancelled) return;
                const d   = r.data?.data;
                const pag = r.data?.pagination;
                const list  = d?.pools ?? [];
                const tot   = d?.total ?? pag?.total ?? 0;
                const pg    = Math.ceil(tot / p.limit) || 1;
                setPools(list); setTotal(tot); setPages(pg);
                cacheSet(key, { pools: list, total: tot, pages: pg });
            })
            .catch(e => { if (!cancelled) setError(e.response?.data?.message || 'Network error'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { setLoading(true); return doFetch(params); }, [params, doFetch]);
    const refresh = useCallback(() => { cacheClear(); setLoading(true); doFetch(params, true); }, [params, doFetch]);

    /* CRUD handlers */
    const handleSaved = useCallback(saved => {
        if (!saved) return;
        setPools(prev => {
            const idx = prev.findIndex(p => p.id === saved.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
            return [saved, ...prev];
        });
        setTotal(t => modal.pool ? t : t + 1);
        cacheClear();
    }, [modal.pool]);

    const handleToggle = useCallback((id, isActive) => {
        setPools(prev => prev.map(p => p.id === id ? { ...p, isActive } : p));
        cacheClear();
    }, []);

    const handleDelete = async () => {
        if (!delPool) return;
        setDelBusy(true);
        try {
            await deletePool(delPool.id);
            setPools(prev => prev.filter(p => p.id !== delPool.id));
            setTotal(t => t - 1);
            toast.success('Pool deleted');
            setDelPool(null);
            cacheClear();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Delete failed');
        } finally { setDelBusy(false); }
    };

    /* Derived */
    const { page: curPage, sortBy, sortDir } = params;
    const start    = (curPage - 1) * PAGE_LIMIT + 1;
    const end      = Math.min(curPage * PAGE_LIMIT, total);
    const pageNums = useMemo(() =>
        Array.from({ length: pages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === pages || Math.abs(p - curPage) <= 1)
            .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                acc.push(p); return acc;
            }, []),
    [pages, curPage]);

    const hasFilters = fieldUI.name || fieldUI.entryFeeMin || fieldUI.entryFeeMax
        || params.isActive || params.maxPlayers || params.startDate || params.endDate;

    const SortIcon = () => (
        <span className='inline-block ml-0.5 transition-transform' style={{ transform: sortDir === 'asc' ? 'scaleY(-1)' : 'none' }}>
            <ChevDown />
        </span>
    );

    return (
        <>
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>

            {/* Toolbar */}
            <div className='p-4 sm:p-5 border-b border-slate-100 space-y-4'>
                <div className='flex items-center justify-between'>
                    <div>
                        <p className='text-sm font-bold text-slate-700'>Pool Management</p>
                        <p className='text-xs text-slate-400 mt-0.5'>Game pools with configurable entry fees and prize distribution</p>
                    </div>
                    <button onClick={() => setModal({ open: true, pool: null })}
                        className='h-9 px-4 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm'>
                        <PlusIcon />Create Pool
                    </button>
                </div>

                {/* Search fields */}
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                    <FilterInput label='Pool Name'  placeholder='Search by name…'   value={fieldUI.name}        onChange={onName}   />
                    <FilterInput label='Min Fee (₹)' placeholder='e.g. 10'          value={fieldUI.entryFeeMin} onChange={onFeeMin} />
                    <FilterInput label='Max Fee (₹)' placeholder='e.g. 500'         value={fieldUI.entryFeeMax} onChange={onFeeMax} />
                </div>

                {/* Date range */}
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>From Date</label>
                        <input type='date' value={params.startDate} max={params.endDate || undefined} onChange={e => setStartDate(e.target.value)}
                            className='w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10' />
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>To Date</label>
                        <input type='date' value={params.endDate} min={params.startDate || undefined} onChange={e => setEndDate(e.target.value)}
                            className='w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10' />
                    </div>
                </div>

                {/* Dropdowns row */}
                <div className='grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end'>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Status</label>
                        <select value={params.isActive} onChange={e => setStatus(e.target.value)} className={selectCls}>
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Max Players</label>
                        <select value={params.maxPlayers} onChange={e => setMaxPlayers(e.target.value)} className={selectCls}>
                            {PLAYERS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Sort By</label>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={selectCls}>
                            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Order</label>
                        <button onClick={toggleSortDir} className='h-9 px-3 flex items-center justify-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:border-indigo-400 hover:text-indigo-500 transition-all'>
                            {sortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
                        </button>
                    </div>
                    <div className='col-span-2 sm:col-span-1 sm:ml-auto flex items-end gap-2'>
                        {hasFilters && (
                            <button onClick={clearAll} className='h-9 px-3 text-xs font-semibold text-red-600 border-[1.5px] border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap'>
                                Clear All
                            </button>
                        )}
                        <span className='h-9 flex items-center px-3 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full whitespace-nowrap'>
                            {loading ? '…' : `${total.toLocaleString()} pool${total !== 1 ? 's' : ''}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className='flex flex-col items-center justify-center py-14 gap-3 px-5'>
                    <p className='font-semibold text-slate-700 text-sm'>Failed to load</p>
                    <p className='text-xs text-slate-400 text-center'>{error}</p>
                    <button onClick={refresh} className='h-9 px-6 bg-indigo-500 text-white text-xs font-semibold rounded-xl hover:bg-indigo-600'>Retry</button>
                </div>
            )}

            {/* Table */}
            {!error && (
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm min-w-max'>
                        <thead className='sticky top-0 z-10'>
                            <tr className='bg-slate-50 border-b-[1.5px] border-slate-200'>
                                {['#', 'Pool Name', 'Entry Fee', 'Players', 'Prize Pool', 'Rooms', 'Joined', 'Open Matches', 'Status', 'Created', 'Actions'].map(h => (
                                    <th key={h} className='px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <Skeleton rows={PAGE_LIMIT} /> : pools.length === 0 ? (
                                <tr><td colSpan={11}>
                                    <div className='flex flex-col items-center justify-center py-16 gap-3'>
                                        <div className='text-slate-200'><EmptyIcon /></div>
                                        <p className='font-semibold text-slate-500 text-sm'>No pools found</p>
                                        {hasFilters && <button onClick={clearAll} className='text-xs text-indigo-500 hover:underline'>Clear filters</button>}
                                    </div>
                                </td></tr>
                            ) : pools.map((pool, i) => (
                                <tr key={pool.id} className='border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors'>
                                    <td className='px-5 py-3.5 text-xs text-slate-400 font-mono'>{(curPage - 1) * PAGE_LIMIT + i + 1}</td>
                                    <td className='px-5 py-3.5'>
                                        <p className='font-semibold text-slate-800 text-sm'>{pool.name}</p>
                                        {pool.description && <p className='text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]'>{pool.description}</p>}
                                    </td>
                                    <td className='px-5 py-3.5 font-semibold text-slate-700 whitespace-nowrap'>₹{pool.entryFee}</td>
                                    <td className='px-5 py-3.5 text-slate-600 whitespace-nowrap'>{pool.maxPlayers}</td>
                                    <td className='px-5 py-3.5 whitespace-nowrap'>
                                        <span className='text-emerald-700 font-bold'>₹{pool.prizePool}</span>
                                    </td>
                                    <td className='px-5 py-3.5 text-slate-500 whitespace-nowrap'>{pool.roomCount}</td>
                                    <td className='px-5 py-3.5 text-slate-500 whitespace-nowrap'>{pool.totalJoinedPlayers ?? '—'}</td>
                                    <td className='px-5 py-3.5 whitespace-nowrap'>
                                        {pool.targetOpenMatches > 0 ? (
                                            <span className={`font-semibold ${pool.openMatches < pool.targetOpenMatches ? 'text-amber-600' : 'text-emerald-700'}`}>
                                                {pool.openMatches}/{pool.targetOpenMatches}
                                            </span>
                                        ) : <span className='text-slate-300'>Off</span>}
                                    </td>
                                    <td className='px-5 py-3.5'>
                                        {pool.status === 'COMPLETED' ? (
                                            <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200'>
                                                <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />Completed
                                            </span>
                                        ) : (
                                            <ToggleSwitch id={pool.id} initial={pool.isActive} name={pool.name} onUpdated={handleToggle} />
                                        )}
                                    </td>
                                    <td className='px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap'>{fmtDate(pool.createdAt)}</td>
                                    <td className='px-5 py-3.5'>
                                        <div className='flex items-center gap-1.5 flex-wrap'>
                                            <button onClick={() => setDetailPool(pool)}
                                                className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:scale-95 transition-all'>
                                                <ViewIcon />View
                                            </button>
                                            <button onClick={() => setModal({ open: true, pool })}
                                                className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all'>
                                                <EditIcon />Edit
                                            </button>
                                            <button onClick={() => setDelPool(pool)}
                                                className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-95 transition-all'>
                                                <TrashIcon />Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!loading && !error && pages > 1 && (
                <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100'>
                    <p className='text-xs text-slate-500 text-center'>
                        <span className='font-semibold text-slate-700'>{start}–{end}</span> of{' '}
                        <span className='font-semibold text-slate-700'>{total.toLocaleString()}</span>
                        {' '}· Page <span className='font-semibold text-slate-700'>{curPage}</span>/<span className='font-semibold text-slate-700'>{pages}</span>
                    </p>
                    <div className='flex items-center gap-1.5 flex-wrap justify-center'>
                        <PageBtn onClick={() => goToPage(1)}          disabled={curPage === 1 || loading}>«</PageBtn>
                        <PageBtn onClick={() => goToPage(curPage - 1)} disabled={curPage === 1 || loading}><ChevL /></PageBtn>
                        {pageNums.map((p, i) => p === '…'
                            ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                            : <PageBtn key={p} onClick={() => goToPage(p)} disabled={loading} active={p === curPage}>{p}</PageBtn>
                        )}
                        <PageBtn onClick={() => goToPage(curPage + 1)} disabled={curPage === pages || loading}><ChevR /></PageBtn>
                        <PageBtn onClick={() => goToPage(pages)}       disabled={curPage === pages || loading}>»</PageBtn>
                    </div>
                </div>
            )}
        </div>

        <PoolModal
            open={modal.open}
            pool={modal.pool}
            onClose={() => setModal({ open: false, pool: null })}
            onSaved={handleSaved}
        />
        {detailPool && (
            <PoolDetailModal pool={detailPool} onClose={() => setDetailPool(null)} />
        )}
        {delPool && (
            <ConfirmModal pool={delPool} onClose={() => setDelPool(null)} onConfirm={handleDelete} busy={delBusy} />
        )}
        </>
    );
}
const POOL_TABS = [
    { id: 'fees',  label: 'Entry Fees'  },
    { id: 'quick', label: 'Quick Match' },
    { id: 'all',   label: 'All Pools'   },
];

/* Entry Fees (the approved amounts) -> Quick Match (configured per fee). "All Pools" is the
   original combined table, kept as-is. */
export default function Pools() {
    const [tab, setTab] = useState('fees');
    return (
        <>
            <div className='mb-4'>
                <PublicMatchSettingCard />
                <PrivateFeeRangeCard />
            </div>
            <div className='flex gap-1.5 mb-4 p-1 bg-slate-100 rounded-xl w-fit'>
                {POOL_TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 h-8 rounded-lg text-xs font-bold transition-all ${
                            tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t.label}
                    </button>
                ))}
            </div>
            {tab === 'fees'  && <EntryFees />}
            {tab === 'quick' && <QuickMatchConfig />}
            {tab === 'all'   && <AllPools />}
        </>
    );
}
