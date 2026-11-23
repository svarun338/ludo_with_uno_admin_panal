import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PanelAuthProvider, usePanelAuth } from './context/AuthContext';
import ErrorBoundary  from './components/ErrorBoundary';
import PageLoader     from './components/PageLoader';
import ToastContainer from './components/ToastContainer';

/* Lazy-loaded pages */
const Login                = lazy(() => import('./pages/Login/Login'));
const PromoterLogin        = lazy(() => import('./pages/PromoterLogin/PromoterLogin'));
const PromoterSignup       = lazy(() => import('./pages/PromoterLogin/PromoterSignup'));
const ForgotPassword       = lazy(() => import('./pages/PromoterLogin/ForgotPassword'));
const ResetPassword        = lazy(() => import('./pages/PromoterLogin/ResetPassword'));
const DashboardLayout      = lazy(() => import('./pages/Dashboard/DashboardLayout'));
const Users                = lazy(() => import('./pages/Users/Users'));
const UserDetail           = lazy(() => import('./pages/Users/UserDetail'));
const UserTransactions     = lazy(() => import('./pages/Users/UserTransactions'));
const SubAdmins            = lazy(() => import('./pages/SubAdmins/SubAdmins'));
const Promoters            = lazy(() => import('./pages/Promoters/Promoters'));
const PromoterDetail       = lazy(() => import('./pages/Promoters/PromoterDetail'));
const PromoterTransactions = lazy(() => import('./pages/Users/UserTransactions'));   // reuse
const Boats                = lazy(() => import('./pages/Boats/Boats'));
const BoatDetail           = lazy(() => import('./pages/Boats/BoatDetail'));
const BoatTransactions     = lazy(() => import('./pages/Users/UserTransactions'));   // reuse
const AllTransactions      = lazy(() => import('./pages/Transactions/AllTransactions'));
const Pools                = lazy(() => import('./pages/Pools/Pools'));
const MatchRecovery        = lazy(() => import('./pages/MatchRecovery/MatchRecovery'));
const Matches              = lazy(() => import('./pages/Matches/Matches'));
const Overview             = lazy(() => import('./pages/Overview/Overview'));
const Reports              = lazy(() => import('./pages/Reports/Reports'));
const BotAnalytics         = lazy(() => import('./pages/BotAnalytics/BotAnalytics'));
const TestMode             = lazy(() => import('./pages/TestMode/TestMode'));
const PromoterHome         = lazy(() => import('./pages/PromoterHome/PromoterHome'));
const PromoterWallet       = lazy(() => import('./pages/PromoterWallet/PromoterWallet'));

/* ── Protect dashboard routes ── */
function Guard({ children }) {
    const { user } = usePanelAuth();
    return user ? children : <Navigate to='/login' replace />;
}

/* ── Admin-only route: redirect promoters to /dashboard/home ── */
function AdminOnly({ children }) {
    const { role } = usePanelAuth();
    return role === 'a' ? children : <Navigate to='/dashboard/home' replace />;
}

/* ── Index redirect: admin → /users, promoter → /home ── */
function RoleIndex() {
    const { role } = usePanelAuth();
    return role === 'a'
        ? <Navigate to='users' replace />
        : <Navigate to='home' replace />;
}

/* ── Redirect already-logged-in users away from login pages ── */
function PublicGuard({ children }) {
    const { user } = usePanelAuth();
    return user ? <Navigate to='/dashboard' replace /> : children;
}

function AppRoutes() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* ── Auth pages ── */}
                <Route path='/login'            element={<PublicGuard><Login /></PublicGuard>} />
                <Route path='/promoter-login'        element={<PublicGuard><PromoterLogin /></PublicGuard>} />
                <Route path='/promoter-signup'       element={<PublicGuard><PromoterSignup /></PublicGuard>} />
                <Route path='/promoter-login/forgot' element={<PublicGuard><ForgotPassword /></PublicGuard>} />
                <Route path='/promoter-login/reset'  element={<PublicGuard><ResetPassword /></PublicGuard>} />

                {/* ── Dashboard (admin + promoter) ── */}
                <Route path='/dashboard' element={<Guard><DashboardLayout /></Guard>}>
                    <Route index element={<RoleIndex />} />
                    {/* Shared pages */}
                    <Route path='users'      element={<Users />} />
                    <Route path='users/:userId'               element={<UserDetail />} />
                    <Route path='users/:userId/transactions'  element={<UserTransactions />} />
                    {/* Admin-only pages */}
                    <Route path='sub-admins' element={<AdminOnly><SubAdmins /></AdminOnly>} />
                    <Route path='promoters'  element={<AdminOnly><Promoters /></AdminOnly>} />
                    <Route path='promoters/:promoterId'              element={<AdminOnly><PromoterDetail /></AdminOnly>} />
                    <Route path='promoters/:promoterId/transactions' element={<AdminOnly><PromoterTransactions /></AdminOnly>} />
                    <Route path='boats'      element={<AdminOnly><Boats /></AdminOnly>} />
                    <Route path='boats/:boatId'              element={<AdminOnly><BoatDetail /></AdminOnly>} />
                    <Route path='boats/:userId/transactions' element={<AdminOnly><BoatTransactions /></AdminOnly>} />
                    <Route path='transactions'               element={<AdminOnly><AllTransactions /></AdminOnly>} />
                    <Route path='pools'                      element={<AdminOnly><Pools /></AdminOnly>} />
                    <Route path='overview'                   element={<AdminOnly><Overview /></AdminOnly>} />
                    <Route path='reports'                    element={<AdminOnly><Reports /></AdminOnly>} />
                    <Route path='matches'                    element={<AdminOnly><Matches /></AdminOnly>} />
                    <Route path='match-recovery'             element={<AdminOnly><MatchRecovery /></AdminOnly>} />
                    <Route path='bot-analytics'              element={<AdminOnly><BotAnalytics /></AdminOnly>} />
                    <Route path='test-mode'                  element={<AdminOnly><TestMode /></AdminOnly>} />
                    {/* Promoter-only pages */}
                    <Route path='home'   element={<PromoterHome />} />
                    <Route path='wallet' element={<PromoterWallet />} />
                </Route>

                <Route path='*' element={<Navigate to='/login' replace />} />
            </Routes>
        </Suspense>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <PanelAuthProvider>
                <BrowserRouter>
                    <AppRoutes />
                    <ToastContainer />
                </BrowserRouter>
            </PanelAuthProvider>
        </ErrorBoundary>
    );
}
