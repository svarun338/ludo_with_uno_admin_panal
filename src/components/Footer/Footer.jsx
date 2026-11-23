import { memo } from 'react';

const YEAR = new Date().getFullYear();

const Footer = memo(function Footer() {
    return (
        <footer className='flex items-center gap-2 px-7 py-3.5 bg-white border-t border-slate-200 text-xs text-slate-400'>
            <span>© {YEAR} Ludo Arena — Admin Panel</span>
            <span className='text-slate-300'>·</span>
            <span>All rights reserved</span>
        </footer>
    );
});

export default Footer;
