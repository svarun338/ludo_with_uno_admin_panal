import { memo } from 'react';
import { SortAscIcon, SortDescIcon } from '../utils/icons';
import { alignCls } from '../utils/helpers';

/**
 * Renders <thead> entirely from the TABLE_COLUMNS config array.
 * Sortable columns show the sort indicator. Non-sortable columns render plain text.
 */
const TableHeader = memo(function TableHeader({ columns, sortBy, sortDir, onSort }) {
    return (
        <thead className='sticky top-0 z-10'>
            <tr className='bg-slate-50/80 backdrop-blur-sm border-b-[1.5px] border-slate-200'>
                {columns.map((col, i) => {
                    const sortable = !!col.sortField;
                    const active   = sortBy === col.sortField;
                    const edgeCls  = i === 0 ? 'pl-6 pr-4' : i === columns.length - 1 ? 'pl-4 pr-6' : 'px-4';
                    const borderCls = i !== columns.length - 1 ? 'border-r border-slate-200' : '';
                    return (
                        <th
                            key={col.key}
                            onClick={sortable ? () => onSort(col.sortField) : undefined}
                            className={`${edgeCls} ${borderCls} py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap ${alignCls(col.align)} ${sortable ? 'cursor-pointer select-none hover:text-indigo-500 transition-colors' : ''}`}
                        >
                            {sortable ? (
                                <span className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                                    {col.headerName}
                                    <span className={active ? 'text-indigo-500' : 'text-slate-300'}>
                                        {active && sortDir === 'asc' ? <SortAscIcon /> : <SortDescIcon />}
                                    </span>
                                </span>
                            ) : col.headerName}
                        </th>
                    );
                })}
            </tr>
        </thead>
    );
});

export default TableHeader;
