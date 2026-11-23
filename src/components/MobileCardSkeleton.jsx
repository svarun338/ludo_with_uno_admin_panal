import { memo } from 'react';

const MobileCardSkeleton = memo(function MobileCardSkeleton({ rows = 5 }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className='flex gap-3 px-4 py-4 border-b border-slate-50'>
                    <div className='flex flex-col items-center gap-1.5 shrink-0'>
                        <div className='h-2.5 w-4 bg-slate-100 rounded animate-pulse' />
                        <div className='w-10 h-10 bg-slate-100 rounded-xl animate-pulse' />
                    </div>
                    <div className='flex-1 space-y-2.5 pt-1'>
                        <div className='flex justify-between gap-2'>
                            <div className='h-3 w-32 bg-slate-100 rounded animate-pulse' />
                            <div className='h-5 w-16 bg-slate-100 rounded-full animate-pulse' />
                        </div>
                        {[176, 112, 96, 64].map((w, j) => (
                            <div key={j} className='h-2.5 bg-slate-100 rounded animate-pulse' style={{ width: w }} />
                        ))}
                        <div className='flex gap-2'>
                            <div className='h-6 w-16 bg-slate-100 rounded-full animate-pulse' />
                            <div className='h-6 w-16 bg-slate-100 rounded-lg animate-pulse' />
                            <div className='h-6 w-16 bg-slate-100 rounded-lg animate-pulse' />
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
});

export default MobileCardSkeleton;
