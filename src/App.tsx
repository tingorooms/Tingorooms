
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';
import { SiteSettingsProvider } from '@/context/SiteSettingsContext';
import MainLayout from '@/components/layouts/MainLayout';
import ScrollToTop from '@/components/ScrollToTop';
import HomePage from '@/pages/HomePage';
import { getNotificationPrefs } from '@/lib/notificationPreferences';
import { subscribeBrowserPush } from '@/services/pushSubscriptionService';

const AuthBusinessLayout = lazy(() => import('@/components/layouts/AuthBusinessLayout'));
const NotificationBanner = lazy(() => import('@/components/NotificationBanner'));
const FloatingChatButton = lazy(() => import('@/components/chat/FloatingChatButton'));

const RoomDetailPage = lazy(() => import('@/pages/RoomDetailPage'));
const RoomsListPage = lazy(() => import('@/pages/RoomsListPage'));
const BrokersPage = lazy(() => import('@/pages/BrokersPage'));
const BrokerProfilePage = lazy(() => import('@/pages/BrokerProfilePage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const TermsAndConditionsPage = lazy(() => import('@/pages/TermsAndConditionsPage'));
const AcceptInvitationPage = lazy(() => import('@/pages/AcceptInvitationPage'));

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const VerifyOTPPage = lazy(() => import('@/pages/auth/VerifyOTPPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

const PostRoomPage = lazy(() => import('@/pages/dashboard/PostRoomPage'));
const DashboardRoutes = lazy(() => import('@/routes/DashboardRoutes'));
const AdminRoutes = lazy(() => import('@/routes/AdminRoutes'));

function App() {
    const [isNonCriticalUiReady, setIsNonCriticalUiReady] = useState(false);

    useEffect(() => {
        const routePrefetchers: Array<{ prefix: string; load: () => Promise<unknown> }> = [
            { prefix: '/rooms', load: () => import('@/pages/RoomsListPage') },
            { prefix: '/room/', load: () => import('@/pages/RoomDetailPage') },
            { prefix: '/brokers', load: () => import('@/pages/BrokersPage') },
            { prefix: '/login', load: () => import('@/pages/auth/LoginPage') },
            { prefix: '/register', load: () => import('@/pages/auth/RegisterPage') }
        ];

        const prefetched = new Set<string>();

        const prefetchForHref = (href: string) => {
            const match = routePrefetchers.find((item) => href === item.prefix || href.startsWith(item.prefix));
            if (!match || prefetched.has(match.prefix)) return;

            prefetched.add(match.prefix);
            void match.load();
        };

        const handleIntentPrefetch = (event: Event) => {
            const target = event.target as Element | null;
            const anchor = target?.closest?.('a[href^="/"]') as HTMLAnchorElement | null;
            if (!anchor) return;

            prefetchForHref(anchor.getAttribute('href') || '');
        };

        document.addEventListener('pointerenter', handleIntentPrefetch, true);
        document.addEventListener('focusin', handleIntentPrefetch, true);
        document.addEventListener('touchstart', handleIntentPrefetch, { passive: true, capture: true });

        return () => {
            document.removeEventListener('pointerenter', handleIntentPrefetch, true);
            document.removeEventListener('focusin', handleIntentPrefetch, true);
            document.removeEventListener('touchstart', handleIntentPrefetch, true);
        };
    }, []);

    // Defer realtime initialization so first paint remains fast.
    useEffect(() => {
        const idleApi = globalThis as typeof globalThis & {
            requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
            cancelIdleCallback?: (handle: number) => void;
        };

        let timeoutId: number | undefined;
        let idleId: number | undefined;

        if (typeof idleApi.requestIdleCallback === 'function') {
            idleId = idleApi.requestIdleCallback(() => setIsNonCriticalUiReady(true), { timeout: 2200 });
        } else {
            timeoutId = globalThis.setTimeout(() => setIsNonCriticalUiReady(true), 1200);
        }

        return () => {
            if (typeof idleId === 'number') {
                idleApi.cancelIdleCallback?.(idleId);
            }
            if (typeof timeoutId === 'number') {
                globalThis.clearTimeout(timeoutId);
            }
        };
    }, []);

    useEffect(() => {
        let shouldCleanup = false;

        const startRealtime = async () => {
            if (!localStorage.getItem('token')) {
                return;
            }

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (supabaseUrl && supabaseAnonKey) {
                const { initializeRealtimeChat } = await import('@/lib/realtimeChatInit');
                const initialized = await initializeRealtimeChat({
                    supabaseUrl,
                    supabaseAnonKey,
                    enableNotifications: true,
                    requestPermissionOnInit: false
                });
                shouldCleanup = Boolean(initialized);
            }
        };

        const idleApi = globalThis as typeof globalThis & {
            requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
            cancelIdleCallback?: (handle: number) => void;
        };

        let timeoutId: number | undefined;
        let idleId: number | undefined;

        if (typeof idleApi.requestIdleCallback === 'function') {
            idleId = idleApi.requestIdleCallback(() => {
                void startRealtime();
            }, { timeout: 2500 });
        } else {
            timeoutId = globalThis.setTimeout(() => {
                void startRealtime();
            }, 1200);
        }

        return () => {
            if (typeof idleId === 'number') {
                idleApi.cancelIdleCallback?.(idleId);
            }
            if (typeof timeoutId === 'number') {
                globalThis.clearTimeout(timeoutId);
            }
            if (shouldCleanup) {
                void import('@/lib/realtimeChatInit').then(({ cleanupRealtimeChat }) => cleanupRealtimeChat());
            }
        };
    }, []);

    useEffect(() => {
        const syncPushSubscription = async () => {
            try {
                if (!localStorage.getItem('token')) {
                    return;
                }

                const prefs = getNotificationPrefs();
                if (!prefs.push || Notification.permission !== 'granted') {
                    return;
                }

                await subscribeBrowserPush();
            } catch (error) {
                // Push registration should never block app boot.
            }
        };

        void syncPushSubscription();
    }, []);

    return (
        <SiteSettingsProvider>
            <AuthProvider>
                <ChatProvider>
                        <Router>
                            <ScrollToTop />
                            {isNonCriticalUiReady ? (
                                <Suspense fallback={null}>
                                    <NotificationBanner />
                                </Suspense>
                            ) : null}
                            <Suspense fallback={null}>
                                <Routes>
                                {/* Public Routes */}
                                <Route path="/" element={<MainLayout />}>
                                <Route index element={<HomePage />} />
                                <Route path="rooms" element={<RoomsListPage />} />
                                <Route path="rooms/add" element={<PostRoomPage />} />
                                <Route path="room/:roomId/:slug?" element={<RoomDetailPage />} />
                                <Route path="brokers" element={<BrokersPage />} />
                                <Route path="broker/:brokerId/:slug?" element={<BrokerProfilePage />} />
                                <Route path="about" element={<AboutPage />} />
                                <Route path="contact" element={<ContactPage />} />
                            </Route>

                            {/* Terms & Conditions Page */}
                            <Route path="/terms-conditions" element={<TermsAndConditionsPage />} />

                            {/* Auth Routes */}
                            <Route element={<AuthBusinessLayout />}>
                                <Route path="/login" element={<LoginPage />} />
                                <Route path="/register" element={<RegisterPage />} />
                                <Route path="/verify-otp" element={<VerifyOTPPage />} />
                                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                                <Route path="/reset-password" element={<ResetPasswordPage />} />
                            </Route>
                            <Route path="/accept-invite" element={<AcceptInvitationPage />} />

                            {/* Dashboard/Admin Routes (Lazy-Gated) */}
                            <Route path="/dashboard/*" element={<DashboardRoutes />} />
                            <Route path="/admin/*" element={<AdminRoutes />} />

                            {/* Catch All */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Suspense>
                            {isNonCriticalUiReady ? (
                                <Suspense fallback={null}>
                                    <FloatingChatButton />
                                </Suspense>
                            ) : null}
                        </Router>
                        <Toaster position="top-right" richColors />
                </ChatProvider>
            </AuthProvider>
        </SiteSettingsProvider>
    );
}

export default App;
