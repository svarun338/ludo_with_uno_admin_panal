import { useState, useEffect, useCallback, memo } from 'react';

const CheckIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'>
        <polyline points='20 6 9 17 4 12'/>
    </svg>
);
const WarnIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'>
        <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/>
        <line x1='12' y1='9' x2='12' y2='13'/><line x1='12' y1='17' x2='12.01' y2='17'/>
    </svg>
);
const ErrorIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-4 h-4'>
        <circle cx='12' cy='12' r='10'/>
        <line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/>
    </svg>
);
const CloseIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' stroke='currentColor' className='w-3.5 h-3.5'>
        <line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/>
    </svg>
);

const CONFIG = {
    success: {
        icon:   <CheckIcon />,
        label:  'Success',
        iconBg: 'bg-emerald-500',
        border: 'border-emerald-100',
        title:  'text-emerald-700',
    },
    warning: {
        icon:   <WarnIcon />,
        label:  'Warning',
        iconBg: 'bg-amber-400',
        border: 'border-amber-100',
        title:  'text-amber-700',
    },
    error: {
        icon:   <ErrorIcon />,
        label:  'Error',
        iconBg: 'bg-red-500',
        border: 'border-red-100',
        title:  'text-red-700',
    },
};

const ToastItem = memo(function ToastItem({ item, onRemove }) {
    const [out, setOut] = useState(false);
    const cfg = CONFIG[item.type] || CONFIG.success;

    const dismiss = useCallback(() => {
        setOut(true);
        setTimeout(() => onRemove(item.id), 320);
    }, [item.id, onRemove]);

    useEffect(() => {
        const t = setTimeout(dismiss, 3800);
        return () => clearTimeout(t);
    }, [dismiss]);

    return (
        <div
            style={{ animation: `${out ? 'toast-out' : 'toast-in'} 0.32s cubic-bezier(.4,0,.2,1) forwards` }}
            className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-xl border bg-white min-w-72 max-w-sm pointer-events-auto ${cfg.border}`}
        >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white ${cfg.iconBg}`}>
                {cfg.icon}
            </div>
            <div className='flex-1 min-w-0 pt-0.5'>
                <p className={`text-sm font-bold leading-tight ${cfg.title}`}>{cfg.label}</p>
                <p className='text-xs text-slate-500 mt-0.5 leading-relaxed'>{item.msg}</p>
            </div>
            <button onClick={dismiss} className='shrink-0 mt-0.5 text-slate-400 hover:text-slate-700 transition-colors'>
                <CloseIcon />
            </button>
        </div>
    );
});

export default function ToastContainer() {
    const [items, setItems] = useState([]);

    const remove = useCallback(id => setItems(t => t.filter(x => x.id !== id)), []);

    useEffect(() => {
        const handler = e => {
            const id = `${Date.now()}-${Math.random()}`;
            setItems(t => [...t, { id, ...e.detail }]);
        };
        window.addEventListener('app:toast', handler);
        return () => window.removeEventListener('app:toast', handler);
    }, []);

    if (!items.length) return null;

    return (
        <div className='fixed top-4 right-4 z-200 flex flex-col gap-2.5 pointer-events-none'>
            {items.map(item => <ToastItem key={item.id} item={item} onRemove={remove} />)}
        </div>
    );
}
