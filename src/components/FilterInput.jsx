import { memo } from 'react';
import { SearchIcon, XIcon } from '../utils/icons';

const FilterInput = memo(function FilterInput({ label, placeholder, value, onChange }) {
    return (
        <div className='flex flex-col gap-1.5'>
            <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>{label}</label>
            <div className='relative'>
                <span className='absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'>
                    <SearchIcon />
                </span>
                <input
                    type='text'
                    placeholder={placeholder}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className='w-full h-9 pl-8 pr-7 border-[1.5px] border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300'
                />
                {value && (
                    <button
                        onClick={() => onChange('')}
                        className='absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400 transition-colors'
                    >
                        <XIcon />
                    </button>
                )}
            </div>
        </div>
    );
});

export default FilterInput;
