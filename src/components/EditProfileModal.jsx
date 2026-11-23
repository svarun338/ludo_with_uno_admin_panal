import { useState, useEffect, useRef, memo } from 'react';
import { updateUserProfile }                  from '../api';
import { fullName }                           from '../utils/helpers';
import { XIcon }                              from '../utils/icons';

const EditProfileModal = memo(function EditProfileModal({ modal, onClose, onUpdated }) {
    const [form,    setForm]    = useState({ firstName: '', lastName: '', email: '' });
    const [errors,  setErrors]  = useState({});
    const [loading, setLoading] = useState(false);
    const [apiErr,  setApiErr]  = useState('');
    const firstRef = useRef(null);

    useEffect(() => {
        if (modal.open && modal.user) {
            let firstName = modal.user.firstName || '';
            let lastName  = modal.user.lastName  || '';
            if (!firstName && modal.user.displayName) {
                const parts = modal.user.displayName.trim().split(/\s+/);
                firstName = parts[0] || '';
                lastName  = parts.slice(1).join(' ') || '';
            }
            setForm({ firstName, lastName, email: modal.user.email || '' });
            setErrors({}); setApiErr('');
            setTimeout(() => firstRef.current?.focus(), 60);
        }
    }, [modal.open, modal.user]);

    if (!modal.open) return null;

    const validate = (name, value) => {
        const v = (value || '').trim();
        if (name === 'firstName' || name === 'lastName') {
            if (!v) return `${name === 'firstName' ? 'First' : 'Last'} name is required`;
            if (v.length < 2) return 'At least 2 characters';
            if (!/^[a-zA-Z\s'\-]+$/.test(v)) return 'Letters only';
        }
        if (name === 'email') {
            if (!v) return 'Email is required';
            if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(v))
                return 'Enter a valid email';
        }
        return '';
    };

    const handleChange = e => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
        setApiErr('');
        setErrors(er => ({ ...er, [name]: validate(name, value) }));
    };

    const handleSubmit = async e => {
        e.preventDefault();
        const newErr = {};
        ['firstName', 'lastName', 'email'].forEach(k => {
            const err = validate(k, form[k]);
            if (err) newErr[k] = err;
        });
        if (Object.keys(newErr).length) { setErrors(newErr); return; }

        setLoading(true); setApiErr('');
        try {
            const res = await updateUserProfile(modal.user._id, form);
            onUpdated(res.data.data.user);
            onClose();
        } catch (err) {
            const d = err.response?.data;
            if (d?.data?.errors) setErrors(d.data.errors);
            else setApiErr(d?.message || 'Update failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const onKey = e => { if (e.key === 'Escape') onClose(); };

    return (
        <div
            className='fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4'
           
            onKeyDown={onKey}
        >
            <div className='bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden'>

                {/* Header */}
                <div className='px-6 py-5 flex items-center gap-3 bg-indigo-600'>
                    <div className='w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white'>
                        <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className='w-5 h-5'>
                            <circle cx='12' cy='8' r='4'/><path d='M4 20c0-4 3.6-7 8-7s8 3 8 7'/>
                        </svg>
                    </div>
                    <div className='flex-1'>
                        <h3 className='text-white font-bold text-base'>Edit Profile</h3>
                        <p className='text-white/75 text-xs mt-0.5'>{fullName(modal.user)}</p>
                    </div>
                    <button onClick={onClose} className='text-white/70 hover:text-white transition-colors'>
                        <XIcon />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} noValidate className='px-6 py-5 space-y-4'>

                    <div className='grid grid-cols-2 gap-3'>
                        {[['firstName','First Name'],['lastName','Last Name']].map(([name, label]) => (
                            <div key={name} className='space-y-1'>
                                <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                                    {label}
                                </label>
                                <input
                                    ref={name === 'firstName' ? firstRef : undefined}
                                    name={name}
                                    type='text'
                                    value={form[name]}
                                    onChange={handleChange}
                                    placeholder={label}
                                    className={`w-full h-11 px-3.5 border-[1.5px] rounded-xl text-sm text-slate-800 bg-white outline-none transition-all
                                        ${errors[name]
                                            ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                                            : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                                />
                                {errors[name] && (
                                    <p className='text-[11px] text-red-500 font-medium'>{errors[name]}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className='space-y-1'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                            Email Address
                        </label>
                        <input
                            name='email'
                            type='email'
                            value={form.email}
                            onChange={handleChange}
                            placeholder='Email address'
                            className={`w-full h-11 px-3.5 border-[1.5px] rounded-xl text-sm text-slate-800 bg-white outline-none transition-all
                                ${errors.email
                                    ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                                    : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`}
                        />
                        {errors.email && (
                            <p className='text-[11px] text-red-500 font-medium'>{errors.email}</p>
                        )}
                    </div>

                    {/* Phone — disabled */}
                    <div className='space-y-1'>
                        <label className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider'>
                            Phone Number
                        </label>
                        <div className='relative'>
                            <input
                                type='tel'
                                value={modal.user?.mobile || modal.user?.phone || ''}
                                disabled
                                className='w-full h-11 px-3.5 pr-10 border-[1.5px] border-slate-100 rounded-xl text-sm text-slate-400 bg-slate-50 cursor-not-allowed'
                            />
                            <svg className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300' viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
                                <rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>
                            </svg>
                        </div>
                        <p className='text-[11px] text-slate-400'>Phone number cannot be changed</p>
                    </div>

                    {apiErr && (
                        <p className='text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg font-medium'>
                            {apiErr}
                        </p>
                    )}

                    {/* Footer */}
                    <div className='flex gap-3 pt-1'>
                        <button type='button' onClick={onClose}
                            className='flex-1 h-11 border-[1.5px] border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors'>
                            Cancel
                        </button>
                        <button type='submit' disabled={loading}
                            className='flex-1 h-11 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all'>
                            {loading
                                ? <span className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                                : 'Save Changes'
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

export default EditProfileModal;
