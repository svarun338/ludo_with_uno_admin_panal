import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    fetchBoats, createBoat, updateBoat,
    updateBoatStatus, deleteBoat, setAllBotsDifficulty,
} from '../../api';
import { cacheGet, cacheSet, cacheHas, cacheClear } from '../../cache';
import { toast } from '../../toast';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import PageBtn from '../../components/PageBtn';

/* ── Icons ── */
const SearchIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>;
const PlusIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>;
const EditIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>;
const TrashIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><polyline points='3 6 5 6 21 6'/><path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/><path d='M10 11v6'/><path d='M14 11v6'/><path d='M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/></svg>;
const ViewIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>;
const XIcon      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' stroke='currentColor' className='w-4 h-4'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>;
const ChevL      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='15 18 9 12 15 6'/></svg>;
const ChevR      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'><polyline points='9 18 15 12 9 6'/></svg>;
const EmptyIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-10 h-10'><path d='M2 21c.6.5 1.2 1 2.5 1C7 22 7 20 9.5 20c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'/><path d='M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76'/><path d='M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6'/><path d='M12 10v4'/><path d='M12 7v.01'/></svg>;

const PAGE_LIMIT = 20;
const AVATARS    = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
const avatarBg   = n => AVATARS[(n?.charCodeAt(0)||0) % AVATARS.length];

const SORT_OPTIONS = [
    { value: 'createdAt',   label: 'Created Date' },
    { value: 'displayName', label: 'Name'          },
    { value: 'email',       label: 'Email'          },
    { value: 'status',      label: 'Status'         },
];
const STATUS_OPTIONS = [
    { value: '',        label: 'All Status' },
    { value: 'active',  label: 'Active'     },
    { value: 'blocked', label: 'Blocked'    },
];

const inputCls = err =>
    `w-full h-10 px-3.5 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${
        err ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/10'}`;

/* ════════════════════════════════
   Status Toggle  (block / unblock)
════════════════════════════════ */
const normalizeStatus = s => {
    const v = (s || '').toLowerCase();
    if (v === 'active') return 'active';
    return 'blocked';
};

const StatusToggle = memo(function StatusToggle({ id, initial, name, onUpdated }) {
    const [cur,  setCur]  = useState(() => normalizeStatus(initial));
    const [busy, setBusy] = useState(false);

    const toggle = useCallback(async () => {
        const next = cur === 'active' ? 'blocked' : 'active';
        setBusy(true);
        try {
            await updateBoatStatus(id, next);
            setCur(next);
            onUpdated?.(id, next);
            next === 'active' ? toast.success(`${name} is now Active`) : toast.warning(`${name} is now Blocked`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Status update failed');
        } finally { setBusy(false); }
    }, [cur, id, name, onUpdated]);

    return (
        <button onClick={toggle} disabled={busy}
            title={cur === 'active' ? 'Click to block' : 'Click to activate'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:opacity-80 disabled:opacity-60 ${
                cur === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}
        >
            {busy ? <span className='w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin' />
                  : <span className={`w-1.5 h-1.5 rounded-full ${cur==='active'?'bg-emerald-500':'bg-red-400'}`} />}
            {cur === 'active' ? 'Active' : 'Blocked'}
        </button>
    );
});

const DIFFICULTY_OPTIONS = [
    { value: 'EASY',   label: 'Easy'   },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HARD',   label: 'Hard'   },
];
const DIFFICULTY_BADGE = {
    EASY:   'bg-emerald-50 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
    HARD:   'bg-red-50 text-red-700 border-red-200',
};

/* One click sets every bot's level — for live tuning without editing bots one by one.
   Matches already in progress keep the level their bot started with. */
const BulkLevelBar = memo(function BulkLevelBar({ onDone }) {
    const [busy, setBusy] = useState('');
    const apply = async level => {
        const label = DIFFICULTY_OPTIONS.find(o => o.value === level).label;
        if (!window.confirm(`Set ALL bots to ${label}? This changes every bot's level at once. Matches already in progress are not affected.`)) return;
        setBusy(level);
        try {
            const res = await setAllBotsDifficulty(level);
            toast.success(`All bots set to ${label} (${res.data?.data?.updated ?? 0} updated)`);
            onDone?.();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update bot levels');
        } finally { setBusy(''); }
    };
    return (
        <div className='flex items-center gap-2 flex-wrap p-3 rounded-xl bg-slate-50 border border-slate-200'>
            <span className='text-xs font-bold text-slate-600'>Set ALL bots to:</span>
            {DIFFICULTY_OPTIONS.map(o => (
                <button key={o.value} onClick={() => apply(o.value)} disabled={!!busy}
                    className={`h-8 px-4 rounded-lg text-xs font-bold border transition-all disabled:opacity-60 ${DIFFICULTY_BADGE[o.value]} hover:opacity-80`}>
                    {busy === o.value ? 'Applying…' : o.label}
                </button>
            ))}
        </div>
    );
});

/* ════════════════════════════════
   Boat Form Modal (Create + Edit)
════════════════════════════════ */
const BoatModal = memo(function BoatModal({ open, onClose, onSaved, boat }) {
    const isEdit = !!boat;
    const EMPTY  = { displayName: '', email: '', phone: '', country_code: '91', botDifficulty: 'HARD' };
    const [form,     setForm]     = useState(EMPTY);
    const [errors,   setErrors]   = useState({});
    const [apiError, setApiError] = useState('');
    const [loading,  setLoading]  = useState(false);
    const firstRef = useRef(null);

    useEffect(() => {
        if (open) {
            setForm(boat
                ? { displayName: boat.displayName || '', email: boat.email || '', phone: '', country_code: '91', botDifficulty: boat.botDifficulty || 'MEDIUM' }
                : EMPTY
            );
            setErrors({}); setApiError('');
            setTimeout(() => firstRef.current?.focus(), 60);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const validate = () => {
        const errs = {};
        if (form.displayName && form.displayName.trim().length < 2)
            errs.displayName = 'Min 2 characters';
        if (form.email && !/^[^@]+@[^@]+\.[a-zA-Z]{2,}$/.test(form.email.trim()))
            errs.email = 'Invalid email address';
        if (!isEdit && form.phone && form.phone.replace(/\D/g,'').length < 4)
            errs.phone = 'Too short (min 4 digits)';
        return errs;
    };

    const change = (f, v) => {
        const val = f === 'phone' ? v.replace(/\D/g,'').slice(0,15) : v;
        setForm(p => ({...p,[f]:val}));
        setErrors(p => ({...p,[f]:''}));
        setApiError('');
    };

    const submit = async () => {
        const errs = validate();
        setErrors(errs);
        if (Object.keys(errs).length) return;
        setLoading(true); setApiError('');
        try {
            let res;
            if (isEdit) {
                res = await updateBoat(boat._id, {
                    displayName: form.displayName.trim() || undefined,
                    email: form.email.trim() || undefined,
                    botDifficulty: form.botDifficulty,
                });
            } else {
                res = await createBoat({
                    displayName: form.displayName.trim() || undefined,
                    email: form.email.trim() || undefined,
                    phone: form.phone || undefined,
                    country_code: form.country_code,
                    botDifficulty: form.botDifficulty,
                });
            }
            const saved = res.data.data;
            toast.success(`${saved?.displayName || 'Bot'} ${isEdit ? 'updated' : 'created'} successfully`);
            onSaved?.(saved);
            onClose();
        } catch (e) {
            const d = e.response?.data;
            if (d?.data?.field) setErrors(p => ({...p,[d.data.field]: d.message}));
            else if (d?.data?.errors) setErrors(d.data.errors);
            else setApiError(d?.message || 'Something went wrong.');
        } finally { setLoading(false); }
    };

    return (
        <div className='fixed inset-0 bg-black/50 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4'>
            <div className='bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>

                <div className='px-6 py-5 flex items-center justify-between bg-indigo-600'>
                    <div>
                        <h3 className='text-white font-bold text-base'>{isEdit ? 'Edit Bot' : 'Create New Bot'}</h3>
                        <p className='text-indigo-200 text-xs mt-0.5'>
                            {isEdit ? boat.displayName : 'Name auto-generated if left blank'}
                        </p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white transition-colors'><XIcon /></button>
                </div>

                <div className='px-6 py-5 space-y-4'>
                    {/* Display Name */}
                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                            Bot Name <span className='normal-case font-normal text-slate-400'>(optional — auto-generated if blank)</span>
                        </label>
                        <input ref={firstRef} type='text' value={form.displayName}
                            onChange={e => change('displayName', e.target.value)}
                            placeholder='e.g. LudoBot-001 (auto)'
                            className={inputCls(errors.displayName)} />
                        {errors.displayName && <p className='text-[10px] text-red-500'>{errors.displayName}</p>}
                    </div>

                    {/* Email */}
                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                            Email Address <span className='normal-case font-normal text-slate-400'>(optional)</span>
                        </label>
                        <input type='email' value={form.email}
                            onChange={e => change('email', e.target.value)}
                            placeholder='bot@example.com'
                            className={inputCls(errors.email)} />
                        {errors.email && <p className='text-[10px] text-red-500'>{errors.email}</p>}
                    </div>

                    {/* Difficulty — how strongly this bot plays. New bots default to Hard. */}
                    <div className='space-y-1.5'>
                        <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                            Difficulty Level
                        </label>
                        <div className='flex gap-2'>
                            {DIFFICULTY_OPTIONS.map(o => (
                                <button key={o.value} type='button' onClick={() => change('botDifficulty', o.value)}
                                    className={`flex-1 h-10 rounded-xl text-sm font-semibold border-[1.5px] transition-all ${
                                        form.botDifficulty === o.value
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-400'
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Phone — create only */}
                    {!isEdit && (
                        <div className='space-y-1.5'>
                            <label className='block text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                                Phone Number <span className='normal-case font-normal text-slate-400'>(optional)</span>
                            </label>
                            <div className='flex gap-2'>
                                <div className='flex items-center gap-1.5 h-10 px-3 border-[1.5px] border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-700 whitespace-nowrap'>
                                    <span>🇮🇳</span><span>+91</span>
                                </div>
                                <input type='tel' value={form.phone}
                                    onChange={e => change('phone', e.target.value)}
                                    placeholder='10 digits'
                                    className={`flex-1 ${inputCls(errors.phone)}`} />
                            </div>
                            {errors.phone && <p className='text-[10px] text-red-500'>{errors.phone}</p>}
                        </div>
                    )}

                    {apiError && <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{apiError}</p>}
                </div>

                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>Cancel</button>
                    <button onClick={submit} disabled={loading}
                        className='flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60'>
                        {loading ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : (isEdit ? 'Save Changes' : '+ Create Bot')}
                    </button>
                </div>
            </div>
        </div>
    );
});

/* ════════════════════════════════
   Filter Input
════════════════════════════════ */
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

/* ════════════════════════════════
   Skeleton
════════════════════════════════ */
const Skeleton = memo(function Skeleton({ rows = 8 }) {
    return <>{Array.from({length:rows}).map((_,i) => (
        <tr key={i} className='border-b border-slate-50'>
            <td className='px-5 py-4'><div className='h-3 w-5 bg-slate-100 rounded animate-pulse'/></td>
            <td className='px-5 py-4'>
                <div className='flex items-center gap-3'>
                    <div className='w-9 h-9 bg-slate-100 rounded-xl animate-pulse shrink-0'/>
                    <div className='space-y-1.5'><div className='h-3 w-24 bg-slate-100 rounded animate-pulse'/><div className='h-2 w-14 bg-slate-100 rounded animate-pulse'/></div>
                </div>
            </td>
            {[44,28,20,20,16,20,36].map((w,j) => (
                <td key={j} className='px-5 py-4'><div className='h-3 bg-slate-100 rounded animate-pulse' style={{width:w*4}}/></td>
            ))}
        </tr>
    ))}</>;
});

/* ════════════════════════════════
   MAIN BOATS PAGE
════════════════════════════════ */
// Old: const DEFAULT_PARAMS = { page:1, limit:PAGE_LIMIT, name:'', email:'', phone:'', status:'', fromDate:'', toDate:'', sortBy:'createdAt', sortDir:'desc' };
const DEFAULT_PARAMS = { page:1, limit:PAGE_LIMIT, name:'', email:'', phone:'', status:'', difficulty:'', fromDate:'', toDate:'', sortBy:'createdAt', sortDir:'desc' };
const DEFAULT_FIELDS = { name:'', email:'', phone:'' };

export default function Boats() {
    const [params,  setParams]  = useState(DEFAULT_PARAMS);
    const [fieldUI, setFieldUI] = useState(DEFAULT_FIELDS);
    const fieldRef = useRef(DEFAULT_FIELDS);
    const timerRef = useRef(null);

    const [boats,   setBoats]   = useState([]);
    const [total,   setTotal]   = useState(0);
    const [pages,   setPages]   = useState(1);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');

    const [modal, setModal] = useState({ open: false, boat: null });

    /* Debounced text search */
    const setField = useCallback((f, v) => {
        fieldRef.current = { ...fieldRef.current, [f]: v };
        setFieldUI({ ...fieldRef.current });
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() =>
            setParams(p => ({ ...p, page:1, ...fieldRef.current })), 380);
    }, []);

    const onName  = useCallback(v => setField('name',  v), [setField]);
    const onEmail = useCallback(v => setField('email', v), [setField]);
    const onPhone = useCallback(v => setField('phone', v), [setField]);

    const setStatus   = useCallback(v => setParams(p => ({...p, page:1, status:  v})), []);
    const setLevel    = useCallback(v => setParams(p => ({...p, page:1, difficulty: v})), []);
    const setSortBy   = useCallback(v => setParams(p => ({...p, page:1, sortBy:  v})), []);
    const setFromDate = useCallback(v => setParams(p => ({...p, page:1, fromDate:v})), []);
    const setToDate   = useCallback(v => setParams(p => ({...p, page:1, toDate:  v})), []);
    const goToPage    = useCallback(pg=> setParams(p => ({...p, page: pg})),           []);
    const toggleDir   = useCallback(()=> setParams(p => ({...p, page:1, sortDir: p.sortDir==='desc'?'asc':'desc'})), []);

    const clearAll = useCallback(() => {
        clearTimeout(timerRef.current);
        fieldRef.current = DEFAULT_FIELDS;
        setFieldUI(DEFAULT_FIELDS);
        setParams({...DEFAULT_PARAMS});
    }, []);

    /* Fetch with cache */
    const doFetch = useCallback((p, force=false) => {
        const key = `boats-${JSON.stringify(p)}`;
        if (!force && cacheHas(key)) {
            const c = cacheGet(key);
            setBoats(c.boats ?? []); setTotal(c.total ?? 0); setPages(c.pages ?? 1);
            setLoading(false); return;
        }
        setError('');
        let cancelled = false;
        const cleanObj = obj => Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==''));
        fetchBoats(cleanObj(p))
            .then(r => {
                if (cancelled) return;
                const d    = r.data.data;
                const pg   = r.data.pagination;
                const list = Array.isArray(d) ? d : (d.boats ?? []);
                const tot  = pg?.total     ?? d.total ?? 0;
                const pgs  = pg?.totalPages ?? d.pages ?? 1;
                setBoats(list); setTotal(tot); setPages(pgs);
                cacheSet(key, { boats: list, total: tot, pages: pgs });
            })
            .catch(e => { if (!cancelled) setError(e.response?.data?.message || 'Network error.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => { setLoading(true); return doFetch(params); }, [params, doFetch]);

    const refresh = useCallback(() => { cacheClear(); setLoading(true); doFetch(params, true); }, [params, doFetch]);

    /* CRUD handlers */
    const handleSaved = useCallback(saved => {
        if (!saved) return;
        setBoats(prev => {
            const idx = prev.findIndex(b => b._id === saved._id);
            return idx >= 0 ? prev.map(b => b._id===saved._id ? {...b,...saved} : b) : [saved, ...prev];
        });
        setTotal(t => t + 1);
        cacheClear();
    }, []);

    const handleStatusUpdated = useCallback((id, s) => {
        setBoats(prev => prev.map(b => b._id===id ? {...b, status: s} : b));
        cacheClear();
    }, []);

    const handleDelete = useCallback(async (boat) => {
        if (!window.confirm(`Delete "${boat.displayName}"? This cannot be undone.`)) return;
        try {
            await deleteBoat(boat._id);
            setBoats(prev => prev.filter(b => b._id !== boat._id));
            setTotal(t => t - 1);
            cacheClear();
            toast.success(`"${boat.displayName}" deleted`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Delete failed');
        }
    }, []);

    /* Derived */
    const { page: curPage, sortBy, sortDir } = params;
    const start = (curPage-1)*PAGE_LIMIT + 1;
    const end   = Math.min(curPage*PAGE_LIMIT, total);
    const pageNums = useMemo(() =>
        Array.from({length:pages},(_,i)=>i+1)
            .filter(p => p===1||p===pages||Math.abs(p-curPage)<=1)
            .reduce((acc,p,idx,arr) => { if(idx>0&&p-arr[idx-1]>1) acc.push('…'); acc.push(p); return acc; },[]),
        [pages, curPage]);

    // Old: const hasFilters = Object.values(fieldUI).some(Boolean) || params.status || params.fromDate || params.toDate;
    const hasFilters = Object.values(fieldUI).some(Boolean) || params.status || params.difficulty || params.fromDate || params.toDate;
    const selectCls  = 'w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10';

    return (
        <>
        <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>

            {/* Toolbar */}
            <div className='p-4 sm:p-5 border-b border-slate-100 space-y-4'>
                <div className='flex items-center justify-between'>
                    <div>
                        <p className='text-sm font-bold text-slate-700'>Bot Management</p>
                        <p className='text-xs text-slate-400 mt-0.5'>Bot players with auto-generated unique names</p>
                    </div>
                    <button onClick={() => setModal({ open:true, boat:null })}
                        className='h-9 px-4 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm'>
                        <PlusIcon />Create Bot
                    </button>
                </div>

                <BulkLevelBar onDone={refresh} />

                {/* Search fields */}
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                    <FilterInput label='Name'  placeholder='Search by name…'  value={fieldUI.name}  onChange={onName}  />
                    <FilterInput label='Email' placeholder='Search by email…' value={fieldUI.email} onChange={onEmail} />
                    <FilterInput label='Phone' placeholder='Search by phone…' value={fieldUI.phone} onChange={onPhone} />
                </div>

                {/* Date range */}
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>From Date</label>
                        <input type='date' value={params.fromDate} max={params.toDate||undefined} onChange={e=>setFromDate(e.target.value)}
                            className='w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'/>
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>To Date</label>
                        <input type='date' value={params.toDate} min={params.fromDate||undefined} onChange={e=>setToDate(e.target.value)}
                            className='w-full h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'/>
                    </div>
                </div>

                {/* Dropdowns */}
                <div className='grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end'>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Status</label>
                        <select value={params.status} onChange={e=>setStatus(e.target.value)} className={selectCls}>
                            {STATUS_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Level</label>
                        <select value={params.difficulty} onChange={e=>setLevel(e.target.value)} className={selectCls}>
                            <option value=''>All Levels</option>
                            {DIFFICULTY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Sort By</label>
                        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className={selectCls}>
                            {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className='flex flex-col gap-1.5'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>Order</label>
                        <button onClick={toggleDir} className='h-9 px-3 flex items-center justify-center gap-1.5 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:border-indigo-400 hover:text-indigo-500 transition-all'>
                            {sortDir==='desc' ? '↓ Desc' : '↑ Asc'}
                        </button>
                    </div>
                    <div className='col-span-2 sm:col-span-1 sm:ml-auto flex items-end gap-2'>
                        {hasFilters && <button onClick={clearAll} className='h-9 px-3 text-xs font-semibold text-red-600 border-[1.5px] border-red-200 rounded-xl bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap'>Clear All</button>}
                        <span className='h-9 flex items-center px-3 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full whitespace-nowrap'>
                            {loading ? '…' : `${total.toLocaleString()} bot${total!==1?'s':''}`}
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
                                {['#','Name','Email','Phone','Level','Balance','Joined','Status','Actions'].map(h => (
                                    <th key={h} className='px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap'>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <Skeleton rows={PAGE_LIMIT} /> : boats.length===0 ? (
                                <tr><td colSpan={9}>
                                    <div className='flex flex-col items-center justify-center py-16 gap-3'>
                                        <div className='text-slate-200'><EmptyIcon /></div>
                                        <p className='font-semibold text-slate-500 text-sm'>No bots found</p>
                                        {hasFilters && <button onClick={clearAll} className='text-xs text-indigo-500 hover:underline'>Clear filters</button>}
                                    </div>
                                </td></tr>
                            ) : boats.map((b, i) => {
                                const name = b.displayName || '—';
                                const inits = (() => { const p = name.trim().split(/\s+/); return ((p[0]?.[0]||'')+(p[1]?.[0]||'')).toUpperCase() || '?'; })();
                                const bal = b.balance?.total ?? null;
                                return (
                                    <tr key={b._id} className='border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors'>
                                        <td className='px-5 py-3.5 text-xs text-slate-400 font-mono'>{(curPage-1)*PAGE_LIMIT+i+1}</td>
                                        <td className='px-5 py-3.5'>
                                            <div className='flex items-center gap-3'>
                                                <div className='w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0' style={{background:avatarBg(name)}}>
                                                    {inits}
                                                </div>
                                                <div>
                                                    <p className='font-semibold text-slate-800 text-sm'>{name}</p>
                                                    <p className='text-[10px] text-slate-400 font-mono'>…{(b._id||'').slice(-8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className='px-5 py-3.5 text-slate-500 text-sm lowercase whitespace-nowrap'>{b.email || '—'}</td>
                                        <td className='px-5 py-3.5 text-slate-500 font-mono text-xs whitespace-nowrap'>{b.mobile || '—'}</td>
                                        <td className='px-5 py-3.5 whitespace-nowrap'>
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${DIFFICULTY_BADGE[b.botDifficulty] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                {DIFFICULTY_OPTIONS.find(o => o.value === b.botDifficulty)?.label || '—'}
                                            </span>
                                        </td>
                                        <td className='px-5 py-3.5 text-slate-700 font-semibold text-sm whitespace-nowrap'>
                                            {bal !== null ? fmtMoney(bal) : <span className='text-slate-300 text-xs'>—</span>}
                                        </td>
                                        <td className='px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap'>{fmtDate(b.createdAt)}</td>
                                        <td className='px-5 py-3.5'>
                                            <StatusToggle id={b._id} initial={b.status} name={name} onUpdated={handleStatusUpdated} />
                                        </td>
                                        <td className='px-5 py-3.5'>
                                            <div className='flex items-center gap-1.5 flex-wrap'>
                                                <Link to={`/dashboard/boats/${b._id}`}
                                                    className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 active:scale-95 transition-all'>
                                                    <ViewIcon />View
                                                </Link>
                                                <button onClick={() => setModal({open:true, boat:b})}
                                                    className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all'>
                                                    <EditIcon />Edit
                                                </button>
                                                <button onClick={() => handleDelete(b)}
                                                    className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-95 transition-all'>
                                                    <TrashIcon />Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
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
                        <PageBtn onClick={()=>goToPage(1)}         disabled={curPage===1||loading}>«</PageBtn>
                        <PageBtn onClick={()=>goToPage(curPage-1)} disabled={curPage===1||loading}><ChevL /></PageBtn>
                        {pageNums.map((p,i) => p==='…'
                            ? <span key={`e${i}`} className='px-1 text-slate-400 text-xs'>…</span>
                            : <PageBtn key={p} onClick={()=>goToPage(p)} disabled={loading} active={p===curPage}>{p}</PageBtn>
                        )}
                        <PageBtn onClick={()=>goToPage(curPage+1)} disabled={curPage===pages||loading}><ChevR /></PageBtn>
                        <PageBtn onClick={()=>goToPage(pages)}     disabled={curPage===pages||loading}>»</PageBtn>
                    </div>
                </div>
            )}
        </div>

        <BoatModal
            open={modal.open}
            boat={modal.boat}
            onClose={() => setModal({open:false, boat:null})}
            onSaved={handleSaved}
        />
        </>
    );
}
