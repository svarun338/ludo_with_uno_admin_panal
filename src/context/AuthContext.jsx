import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Unified auth context for both Admin and Promoter panel users.
 * Role is stored in the user object and validated server-side on every API request.
 * localStorage key changed from 'admin_*' to 'panel_*' for the renamed panel.
 */
const AuthContext = createContext(null);

const readStored = () => {
    try { return JSON.parse(localStorage.getItem('panel_user')) || null; }
    catch { return null; }
};

export function PanelAuthProvider({ children }) {
    const [user, setUser] = useState(readStored);

    const login = useCallback((userData, token) => {
        setUser(userData);
        localStorage.setItem('panel_user',  JSON.stringify(userData));
        localStorage.setItem('panel_token', token);
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('panel_user');
        localStorage.removeItem('panel_token');
        localStorage.removeItem('panel_refresh_token');
    }, []);

    const token = useCallback(() => localStorage.getItem('panel_token') || null, []);

    /*
     * role: 'a' = admin/super_admin, 'p' = promoter, 'u' = regular user
     * Supports both old {role:'a'} shape and new {roles:['admin',...]} shape
     * from the backend_client API.
     */
    const role = (() => {
        if (!user) return null;
        if (user.role) return user.role; // already set by login handler
        if (Array.isArray(user.roles)) {
            if (user.roles.includes('admin') || user.roles.includes('super_admin')) return 'a';
            if (user.roles.includes('promoter')) return 'p';
            return 'u';
        }
        return null;
    })();

    return (
        <AuthContext.Provider value={{ user, role, login, logout, token }}>
            {children}
        </AuthContext.Provider>
    );
}

export const usePanelAuth = () => useContext(AuthContext);

/* ── Backward-compat alias (existing code uses useAdminAuth) ── */
export const useAdminAuth = usePanelAuth;
