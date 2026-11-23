import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import TopBar  from '../../components/TopBar/TopBar';
import Footer  from '../../components/Footer/Footer';

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const open  = useCallback(() => setSidebarOpen(true),  []);
    const close = useCallback(() => setSidebarOpen(false), []);

    return (
        <div className='flex min-h-screen bg-slate-100'>
            {/* Mobile backdrop */}
            {sidebarOpen && (
                <div
                    className='fixed inset-0 bg-black/50 z-40 lg:hidden'
                    onClick={close}
                />
            )}

            <Sidebar open={sidebarOpen} onClose={close} />

            <div className='flex flex-col flex-1 min-w-0 lg:ml-64 transition-all'>
                <TopBar onMenuClick={open} />
                <main className='flex-1 p-4 sm:p-6 lg:p-7'>
                    <Outlet />
                </main>
                <Footer />
            </div>
        </div>
    );
}
