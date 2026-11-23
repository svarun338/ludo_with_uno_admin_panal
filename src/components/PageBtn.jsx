import { memo } from 'react';

const PageBtn = memo(function PageBtn({ children, onClick, disabled, active }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={
                'min-w-9 h-9 px-2 flex items-center justify-center rounded-xl border-[1.5px] text-sm font-semibold transition-all ' +
                (active
                    ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed')
            }
        >
            {children}
        </button>
    );
});

export default PageBtn;
