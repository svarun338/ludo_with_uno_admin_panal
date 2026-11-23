export default function PageLoader() {
    return (
        <div className='fixed inset-0 flex flex-col items-center justify-center bg-slate-50 gap-4 z-50'>
            <div className='w-12 h-12 border-[3px] border-slate-200 border-t-indigo-500 rounded-full animate-spin' />
            <p className='text-sm text-slate-500 font-medium tracking-wide'>Loading…</p>
        </div>
    );
}
