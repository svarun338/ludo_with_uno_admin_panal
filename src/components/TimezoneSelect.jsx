/* IST / UTC switch for the report pages. The choice is shared by all of them (see utils/timezone.js). */
import { TIMEZONES, setTz, useTimezone } from '../utils/timezone';

export default function TimezoneSelect({ label = true, className = '' }) {
    const tz = useTimezone();
    return (
        <div className={className}>
            {label && <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5'>Timezone</label>}
            <div role='radiogroup' aria-label='Timezone' title='Which timezone the dates and times use'
                className='inline-flex h-9 p-0.5 rounded-xl bg-slate-100 border-[1.5px] border-slate-200'>
                {TIMEZONES.map(v => (
                    <button key={v} type='button' role='radio' aria-checked={tz === v} onClick={() => setTz(v)}
                        className={`px-3 rounded-[10px] text-xs font-bold transition-all ${tz === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {v}
                    </button>
                ))}
            </div>
        </div>
    );
}
