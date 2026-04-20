import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, AuthState, LoginFormData, RegisterFormData } from '@/types';
import * as authService from '@/services/authService';

interface AuthContextType extends AuthState {
    login: (data: LoginFormData) => Promise<{ user: User; token: string }>;
    register: (data: RegisterFormData) => Promise<{ requiresVerification: boolean; email: string }>;
    verifyOTP: (email: string, otp: string, options?: { isShortcutRegistration?: boolean; tempPassword?: string }) => Promise<void>;
    resendOTP: (email: string) => Promise<void>;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
    forgotPassword: (email: string) => Promise<void>;
    resetPassword: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: localStorage.getItem('token'),
        isAuthenticated: false,
        isLoading: true
    });

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const user = await authService.getCurrentUser();
                    setState({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false
                    });
                } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
                    localStorage.removeItem('token');
                    setState({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isLoading: false
                    });
                }
            } else {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        };

        initAuth();
    }, []);

    // ── Cross-tab auth sync ────────────────────────────────────────────────
    // When another browser tab logs out or logs in as a different user,
    // the 'storage' event fires here so every open tab stays in sync.
    useEffect(() => {
        const handleStorageChange = async (event: StorageEvent) => {
            if (event.key !== 'token') return;

            if (!event.newValue) {
                // Token was removed in another tab → force-logout this tab
                setState({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isLoading: false
                });
            } else {
                // A new/different token was set in another tab → re-validate
                try {
                    const user = await authService.getCurrentUser();
                    setState({
                        user,
                        token: event.newValue,
                        isAuthenticated: true,
                        isLoading: false
                    });
                } catch {
                    localStorage.removeItem('token');
                    setState({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isLoading: false
                    });
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const login = async (data: LoginFormData) => {
        const response = await authService.login(data);
        localStorage.setItem('token', response.token);
        setState({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false
        });
        return response;
    };

    const register = async (data: RegisterFormData) => {
        const response = await authService.register(data);
        return {
            requiresVerification: response.requiresVerification,
            email: response.email
        };
    };

    const verifyOTP = async (email: string, otp: string, options?: { isShortcutRegistration?: boolean; tempPassword?: string }) => {
        await authService.verifyOTP(email, otp, options);
    };

    const resendOTP = async (email: string) => {
        await authService.resendOTP(email);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
        });
    };

    const updateUser = (userData: Partial<User>) => {
        setState(prev => ({
            ...prev,
            user: prev.user ? { ...prev.user, ...userData } : null
        }));
    };

    const forgotPassword = async (email: string) => {
        await authService.forgotPassword(email);
    };

    const resetPassword = async (token: string, password: string) => {
        await authService.resetPassword(token, password);
    };

    return (
        <AuthContext.Provider value={{
            ...state,
            login,
            register,
            verifyOTP,
            resendOTP,
            logout,
            updateUser,
            forgotPassword,
            resetPassword
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
