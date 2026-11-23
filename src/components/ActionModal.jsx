import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { WalletIcon, XIcon, PlusIcon, MinusIcon } from '../utils/icons';
import { fmtMoney, fullName, capWords } from '../utils/helpers';

const ActionModal = memo(function ActionModal({ modal, onClose, onConfirm }) {
    const [amount,  setAmount]  = useState('');
    const [loading, setLoading] = useState(false);
    const [err,     setErr]     = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (modal.open) {
            setAmount(''); setErr('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [modal.open]);

    if (!modal.open) return null;

    const isDeposit = modal.type === 'deposit';
    const name      = modal.user ? fullName(modal.user) : '';
    const balance   = modal.user?.balance?.total ?? modal.user?.balance ?? 0;
    const amt       = Number(amount) || 0;

    const confirm = async () => {
        if (!amt || amt <= 0) return setErr('Enter a valid amount greater than 0.');
        if (!isDeposit && amt > balance) return setErr(`Insufficient balance — current: ${fmtMoney(balance)}`);
        setLoading(true); setErr('');
        try {
            await onConfirm(amt);
            onClose();
        } catch (e) {
            setErr(e.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const onKey = e => {
        if (e.key === 'Enter')  confirm();
        if (e.key === 'Escape') onClose();
    };

    return (
        <div
            className='fixed inset-0 bg-black/50 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4'
           
        >
            <div className='bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>

                {/* Header */}
                <div className={`px-6 py-5 flex items-center gap-3 ${isDeposit ? 'bg-emerald-500' : 'bg-orange-500'}`}>
                    <div className='w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white'>
                        <WalletIcon />
                    </div>
                    <div className='flex-1'>
                        <h3 className='text-white font-bold text-base'>{isDeposit ? 'Deposit Funds' : 'Withdraw Funds'}</h3>
                        <p className='text-white/80 text-xs mt-0.5'>{name}</p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white transition-colors'>
                        <XIcon />
                    </button>
                </div>

                {/* Body */}
                <div className='px-6 py-5 space-y-4'>
                    <div className='flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl border border-slate-100'>
                        <span className='text-sm text-slate-500 font-medium'>Current Balance</span>
                        <span className='text-lg font-bold text-slate-800'>{fmtMoney(balance)}</span>
                    </div>

                    <div className='space-y-1.5'>
                        <label className='text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                            {isDeposit ? 'Deposit Amount (₹)' : 'Withdrawal Amount (₹)'}
                        </label>
                        <div className='relative'>
                            <span className='absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm pointer-events-none'>₹</span>
                            <input
                                ref={inputRef}
                                type='number'
                                min={1}
                                value={amount}
                                placeholder='0'
                                onChange={e => { setAmount(e.target.value); setErr(''); }}
                                onKeyDown={onKey}
                                className='w-full h-12 pl-8 pr-4 border-[1.5px] border-slate-200 rounded-xl text-lg font-semibold text-slate-800 bg-white outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                            />
                        </div>
                        <p className='text-[11px] text-slate-400'>
                            After {isDeposit ? 'deposit' : 'withdrawal'}:{' '}
                            <span className='font-semibold text-slate-600'>
                                {fmtMoney(isDeposit ? balance + amt : balance - amt)}
                            </span>
                        </p>
                    </div>

                    {err && (
                        <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg'>{err}</p>
                    )}
                </div>

                {/* Footer */}
                <div className='px-6 pb-6 flex gap-3'>
                    <button onClick={onClose} className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>
                        Cancel
                    </button>
                    <button
                        onClick={confirm}
                        disabled={loading || !amount}
                        className={`flex-1 h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDeposit ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-500 hover:bg-orange-600'
                        }`}
                    >
                        {loading
                            ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                            : <>{isDeposit ? <PlusIcon /> : <MinusIcon />} {isDeposit ? 'Deposit' : 'Withdraw'} {amt ? fmtMoney(amt) : ''}</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ActionModal;
