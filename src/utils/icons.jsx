/* Central icon file — import named icons anywhere */
const s = (d, cls = 'w-4 h-4') => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' className={cls}>
        {d}
    </svg>
);

export const SearchIcon  = ({ cls }) => s(<><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></>, cls || 'w-3.5 h-3.5');
export const XIcon       = ({ cls }) => s(<><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></>, cls || 'w-3.5 h-3.5');
export const ChevLIcon   = ({ cls }) => s(<polyline points='15 18 9 12 15 6'/>, cls || 'w-4 h-4');
export const ChevRIcon   = ({ cls }) => s(<polyline points='9 18 15 12 9 6'/>, cls || 'w-4 h-4');
export const SortAscIcon = ({ cls }) => s(<><line x1='12' y1='19' x2='12' y2='5'/><polyline points='5 12 12 5 19 12'/></>, cls || 'w-3 h-3');
export const SortDescIcon= ({ cls }) => s(<><line x1='12' y1='5' x2='12' y2='19'/><polyline points='19 12 12 19 5 12'/></>, cls || 'w-3 h-3');
export const PeopleIcon  = ({ cls }) => s(<><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></>, cls || 'w-10 h-10');
export const MailIcon    = ({ cls }) => s(<><rect x='2' y='4' width='20' height='16' rx='2'/><path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'/></>, cls || 'w-3.5 h-3.5 shrink-0');
export const PhoneIcon   = ({ cls }) => s(<path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.128.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.572 2.81.7A2 2 0 0 1 22 16.92z'/>, cls || 'w-3.5 h-3.5 shrink-0');
export const CalIcon     = ({ cls }) => s(<><rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></>, cls || 'w-3.5 h-3.5 shrink-0');
export const WalletIcon  = ({ cls }) => s(<><rect x='2' y='5' width='20' height='14' rx='2'/><path d='M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'/><path d='M22 10V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2'/></>, cls || 'w-4 h-4 shrink-0');
export const PlusIcon    = ({ cls }) => s(<><line x1='12' y1='5' x2='12' y2='19'/><line x1='5' y1='12' x2='19' y2='12'/></>, cls || 'w-3 h-3');
export const MinusIcon   = ({ cls }) => s(<line x1='5' y1='12' x2='19' y2='12'/>, cls || 'w-3 h-3');
export const RefreshIcon = ({ cls, spin }) => s(<><polyline points='23 4 23 10 17 10'/><path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10'/></>, `${cls || 'w-4 h-4'} ${spin ? 'animate-spin' : ''}`);

export const EditIcon = ({ cls }) => s(<><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/><path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/></>, cls || 'w-3.5 h-3.5');
