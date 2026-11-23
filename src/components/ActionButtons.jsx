import { memo } from 'react';
import { PlusIcon, MinusIcon } from '../utils/icons';

const ActionButtons = memo(function ActionButtons({ onDeposit, onWithdraw }) {
    return (
        <div className='flex items-center gap-1.5 whitespace-nowrap'>
            <button
                onClick={onDeposit}
                className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all'
            >
                <PlusIcon /> Deposit
            </button>
            <button
                onClick={onWithdraw}
                className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 active:scale-95 transition-all'
            >
                <MinusIcon /> Withdraw
            </button>
        </div>
    );
});

export default ActionButtons;
