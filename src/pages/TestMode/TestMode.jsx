/*
 * Testing Mode (admin page, /dashboard/test-mode).
 *
 * ON  = only the DABBA users on this list can open Ludo from DABBA and start / join a match.
 *       Everyone else sees "Ludo Coming Soon!" instead of the lobby, also after a reload.
 * OFF = everyone plays as normal (the list is kept for next time).
 *
 * Matches that are already running are never stopped. Bots are never affected.
 * Every check is done by the backend; this page only shows and edits the setting.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchTestMode, setTestModeEnabled, addTestModeUser, removeTestModeUser } from '../../api';
import { toast } from '../../toast';

const box = 'bg-white border border-slate-100 shadow-sm rounded-2xl';
const inpCls = 'h-9 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all';
const btnCls = 'h-9 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all';
const errMsg = e => e.response?.data?.message || e.message || 'Request failed';
const when = v => v ? new Date(v).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function TestMode() {
    const [state, setState] = useState(null); // { enabled, allowed: [...] }
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(''); // 'toggle' | 'add' | `remove-${id}`
    const [newId, setNewId] = useState('');
    const [note, setNote] = useState('');

    const load = useCallback(async () => {
        setError('');
        try { setState((await fetchTestMode()).data.data); }
        catch (e) { setError(errMsg(e)); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const toggle = async () => {
        const next = !state.enabled;
        if (next && state.allowed.length === 0 &&
            !window.confirm('No users are allowed yet. Turning Testing Mode ON now will block EVERY player. Continue?')) return;
        if (next && !window.confirm(`Turn Testing Mode ON?\n\nOnly the ${state.allowed.length} allowed user(s) will be able to open Ludo and start or join a match. Matches already running are not stopped.`)) return;
        setBusy('toggle');
        try {
            const res = await setTestModeEnabled(next);
            setState(res.data.data);
            next ? toast.warning('Testing Mode is ON — only allowed users can play')
                 : toast.success('Testing Mode is OFF — everyone can play again');
        } catch (e) { toast.error(errMsg(e)); }
        finally { setBusy(''); }
    };

    const idValid = /^\d+$/.test(newId.trim()) && Number(newId) > 0 && Number(newId) <= 2147483647;

    const add = async () => {
        if (!idValid) return;
        setBusy('add');
        try {
            const res = await addTestModeUser(Number(newId.trim()), note.trim());
            setState(res.data.data);
            toast.success(`DABBA user ${newId.trim()} allowed`);
            setNewId(''); setNote('');
        } catch (e) { toast.error(errMsg(e)); }
        finally { setBusy(''); }
    };

    const remove = async u => {
        const last = state.enabled && state.allowed.length === 1;
        if (!window.confirm(`Remove DABBA user ${u.dabaUserId}${u.displayName ? ` (${u.displayName})` : ''}?` +
            (last ? '\n\nThis is the last allowed user — with Testing Mode ON, nobody will be able to play.' : ''))) return;
        setBusy(`remove-${u.dabaUserId}`);
        try {
            const res = await removeTestModeUser(u.dabaUserId);
            setState(res.data.data);
            toast.success(`DABBA user ${u.dabaUserId} removed`);
        } catch (e) { toast.error(errMsg(e)); }
        finally { setBusy(''); }
    };

    if (error) return <div className='p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700'>{error} <button className='underline ml-2' onClick={load}>Retry</button></div>;
    if (!state) return <div className='h-28 bg-white rounded-2xl border border-slate-100 animate-pulse' />;

    return (
        <div className='space-y-4'>
            {/* On / off */}
            <div className={`${box} p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap ${state.enabled ? 'border-amber-200 bg-amber-50/40' : ''}`}>
                <div>
                    <p className='text-sm font-bold text-slate-700'>Testing Mode</p>
                    <p className='text-xs text-slate-500 mt-0.5 max-w-xl'>
                        {state.enabled
                            ? <>ON — only the <b>{state.allowed.length}</b> user(s) below can open Ludo from DABBA and start or join a match. Everyone else sees the testing message.</>
                            : 'OFF — every player can open Ludo and play as normal. The list below is kept for when you turn it on.'}
                    </p>
                    <p className='text-[11px] text-slate-400 mt-1'>Matches already running are never stopped. Bots are not affected.</p>
                </div>
                <button onClick={toggle} disabled={busy === 'toggle'} role='switch' aria-checked={state.enabled}
                    className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-bold border transition-all disabled:opacity-60 ${
                        state.enabled ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {busy === 'toggle'
                        ? <span className='w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin' />
                        : <span className={`w-2 h-2 rounded-full ${state.enabled ? 'bg-amber-500' : 'bg-slate-400'}`} />}
                    {state.enabled ? 'ON — click to turn off' : 'OFF — click to turn on'}
                </button>
            </div>

            {/* Add */}
            <div className={`${box} p-4 sm:p-5`}>
                <p className='text-sm font-bold text-slate-700'>Allow a user</p>
                <p className='text-xs text-slate-400 mt-0.5 mb-3'>Enter the player's DABBA User ID. It works even if they have never opened Ludo before.</p>
                <div className='flex flex-wrap gap-2 items-end'>
                    <label className='text-xs font-semibold text-slate-500'>DABBA User ID
                        <input className={`${inpCls} block mt-1 w-40`} inputMode='numeric' value={newId}
                            onChange={e => setNewId(e.target.value.replace(/[^\d]/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && add()} placeholder='e.g. 25' />
                    </label>
                    <label className='text-xs font-semibold text-slate-500 flex-1 min-w-48'>Note (optional)
                        <input className={`${inpCls} block mt-1 w-full`} maxLength={80} value={note}
                            onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder='e.g. QA phone, Rahul' />
                    </label>
                    <button className={btnCls} disabled={!idValid || busy === 'add'} onClick={add}>{busy === 'add' ? 'Adding…' : 'Allow'}</button>
                </div>
            </div>

            {/* List */}
            <div className={box + ' overflow-hidden'}>
                <div className='px-5 py-3.5 border-b border-slate-100'>
                    <p className='text-sm font-bold text-slate-700'>Allowed users ({state.allowed.length})</p>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm min-w-[640px]'>
                        <thead className='bg-slate-50'><tr className='text-left text-[11px] uppercase tracking-wider text-slate-500'>
                            {['DABBA User ID', 'Ludo name', 'Note', 'Added', ''].map(h => <th key={h} className='px-4 py-2.5 font-bold'>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {state.allowed.map(u => (
                                <tr key={u.dabaUserId} className='border-t border-slate-50'>
                                    <td className='px-4 py-2.5 font-mono font-bold text-indigo-600'>{u.dabaUserId}</td>
                                    <td className='px-4 py-2.5'>{u.displayName || <span className='text-xs text-slate-400'>Not opened Ludo yet</span>}</td>
                                    <td className='px-4 py-2.5 text-slate-500'>{u.note || '—'}</td>
                                    <td className='px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap'>{when(u.addedAt)}</td>
                                    <td className='px-4 py-2.5 text-right'>
                                        <button onClick={() => remove(u)} disabled={busy === `remove-${u.dabaUserId}`}
                                            className='h-8 px-3 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50'>
                                            {busy === `remove-${u.dabaUserId}` ? 'Removing…' : 'Remove'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!state.allowed.length && <tr><td colSpan={5} className='px-4 py-8 text-center text-slate-400'>No users allowed yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* What blocked players see */}
            <div className={`${box} p-4 sm:p-5`}>
                <p className='text-sm font-bold text-slate-700 mb-2'>What other players see</p>
                <div className='rounded-xl bg-slate-900 text-white p-5 text-center max-w-sm'>
                    <div className='text-3xl'>🛠️</div>
                    <p className='font-bold mt-2'>Ludo Coming Soon! 🎲</p>
                    <p className='text-xs text-slate-300 mt-1'>Get ready for the fun! Ludo will be available soon. Stay tuned and get ready to roll the dice!</p>
                </div>
            </div>
        </div>
    );
}
