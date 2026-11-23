import { memo } from 'react';

/**
 * Desktop table skeleton.
 * Adapts to any columns array — each column key gets a matching shimmer shape.
 */
const TableSkeleton = memo(function TableSkeleton({ columns, rows = 8 }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <tr key={i} className='border-b border-slate-50'>
                    {columns.map(col => (
                        <td key={col.key} className='px-4 py-4'>
                            {col.key === 'player' ? (
                                <div className='flex items-center gap-2.5'>
                                    <div className='w-8 h-8 bg-slate-100 rounded-xl animate-pulse shrink-0' />
                                    <div className='space-y-1.5'>
                                        <div className='h-3 w-24 bg-slate-100 rounded animate-pulse' />
                                        <div className='h-2 w-14 bg-slate-100 rounded animate-pulse' />
                                    </div>
                                </div>
                            ) : col.key === 'action' ? (
                                <div className='flex gap-1.5'>
                                    <div className='h-6 w-16 bg-slate-100 rounded-lg animate-pulse' />
                                    <div className='h-6 w-16 bg-slate-100 rounded-lg animate-pulse' />
                                </div>
                            ) : col.key === 'status' || col.key === 'verified' ? (
                                <div className='h-6 w-16 bg-slate-100 rounded-full animate-pulse' />
                            ) : col.key === 'index' ? (
                                <div className='h-3 w-4 bg-slate-100 rounded animate-pulse' />
                            ) : (
                                <div
                                    className='h-3 bg-slate-100 rounded animate-pulse'
                                    style={{ width: Math.min(col.width * 0.65, 160) }}
                                />
                            )}
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
});

export default TableSkeleton;
