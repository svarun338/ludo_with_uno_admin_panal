import { memo } from 'react';

/* Small pieces shared by the Entry Fees and Quick Match sections of the Pools page. */

export const PlusIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></svg>;
export const EditIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></svg>;
export const ViewIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>;
export const XIcon     = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' stroke='currentColor' className='w-4 h-4'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>;
export const PowerIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-3.5 h-3.5'><path d='M18.36 6.64a9 9 0 1 1-12.73 0'/><line x1='12' y1='2' x2='12' y2='12'/></svg>;
export const EmptyIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-10 h-10'><rect x='2' y='3' width='20' height='14' rx='2'/><line x1='8' y1='21' x2='16' y2='21'/><line x1='12' y1='17' x2='12' y2='21'/></svg>;

export const inputCls = err =>
    `w-full h-10 px-3.5 border-[1.5px] rounded-xl text-sm outline-none transition-all focus:ring-4 bg-slate-50 text-slate-900 ${
        err ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
            : 'border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/10'}`;

export const selectCls = 'w-full h-10 px-3 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 outline-none cursor-pointer transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60 disabled:cursor-not-allowed';

export const labelCls = 'block text-[11px] font-semibold text-slate-500 uppercase tracking-wider';

// "50.00" -> "₹50", "12.50" -> "₹12.5": the amount as an admin thinks of it.
export const money = fee => `₹${Number(fee)}`;

export const stateBadge = s => {
    const map = {
        WAITING: 'bg-sky-50 text-sky-700 border-sky-200',
        FILLING: 'bg-amber-50 text-amber-700 border-amber-200',
        FULL:    'bg-rose-50 text-rose-700 border-rose-200',
        STARTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    };
    return map[s] || 'bg-slate-50 text-slate-600 border-slate-200';
};

/* Enabled / Disabled pill. Controlled: the parent owns the value and does the request. */
export const StatusPill = memo(function StatusPill({ active, busy, onClick, onLabel = 'Enabled', offLabel = 'Disabled', title }) {
    return (
        <button type='button' onClick={onClick} disabled={busy}
            title={title || (active ? 'Click to disable' : 'Click to enable')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:opacity-80 disabled:opacity-60 ${
                active ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                       : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            {busy ? <span className='w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin'/>
                  : <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`}/>}
            {active ? onLabel : offLabel}
        </button>
    );
});

/* Two-button Enabled/Disabled picker used inside forms. */
export function EnabledPicker({ value, onChange, disabledLabel = 'Disabled', enabledLabel = 'Enabled' }) {
    return (
        <div className='flex gap-2 h-10 items-center'>
            {[[true, enabledLabel], [false, disabledLabel]].map(([v, l]) => (
                <button key={l} type='button' onClick={() => onChange(v)}
                    className={`flex-1 h-10 rounded-xl border-[1.5px] text-sm font-semibold transition-all ${
                        value === v
                            ? (v ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-400 bg-slate-100 text-slate-700')
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    {l}
                </button>
            ))}
        </div>
    );
}

/* Modal shell in the same style as the existing Pool modals. */
export function ModalShell({ title, subtitle, onClose, children, footer, wide = false }) {
    return (
        <div className='fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4' onClick={onClose}>
            <div className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden`}
                onClick={e => e.stopPropagation()}>
                <div className='px-6 py-5 flex items-center justify-between bg-indigo-600 shrink-0'>
                    <div>
                        <h2 className='text-base font-bold text-white'>{title}</h2>
                        {subtitle && <p className='text-xs text-indigo-200 mt-0.5'>{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className='p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors'><XIcon /></button>
                </div>
                <div className='px-6 py-5 space-y-4 overflow-y-auto'>{children}</div>
                {footer && <div className='px-6 pb-6 flex gap-3 shrink-0'>{footer}</div>}
            </div>
        </div>
    );
}

export function ModalFooter({ onClose, onSubmit, saving, submitLabel, danger = false }) {
    return (
        <>
            <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>Cancel</button>
            <button onClick={onSubmit} disabled={saving}
                className={`flex-1 h-11 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {saving ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'/> : submitLabel}
            </button>
        </>
    );
}
