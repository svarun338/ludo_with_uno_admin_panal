import { memo } from 'react';

const VerifiedBadge = memo(function VerifiedBadge({ verified }) {
    return verified
        ? <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100'>
            <span className='w-1.5 h-1.5 rounded-full bg-blue-500' />Verified
          </span>
        : <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200'>
            <span className='w-1.5 h-1.5 rounded-full bg-slate-400' />Unverified
          </span>;
});

export default VerifiedBadge;
