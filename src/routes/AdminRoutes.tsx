import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const AdminLayout = lazy(() => import('@/components/layouts/AdminLayout'));
const AdminRoute = lazy(() => import('@/components/auth/AdminRoute'));

const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminRoomsPage = lazy(() => import('@/pages/admin/AdminRoomsPage'));
const AdminRoomDetailPage = lazy(() => import('@/pages/admin/AdminRoomDetailPage'));
const AdminBrokersPage = lazy(() => import('@/pages/admin/AdminBrokersPage'));
const AdminPlansPage = lazy(() => import('@/pages/admin/AdminPlansPage'));
const AdminAdsPage = lazy(() => import('@/pages/admin/AdminAdsPage'));
const AdminLeadsPage = lazy(() => import('@/pages/admin/AdminLeadsPage'));
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage'));
const AdminSiteSettingsPage = lazy(() => import('@/pages/admin/AdminSiteSettingsPage'));
const AdminUserDetailPage = lazy(() => import('@/pages/admin/AdminUserDetailPage'));

const AdminRoutes: React.FC = () => {
    return (
        <Suspense fallback={null}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <AdminRoute>
                            <AdminLayout />
                        </AdminRoute>
                    }
                >
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="users/:id" element={<AdminUserDetailPage />} />
                    <Route path="rooms" element={<AdminRoomsPage />} />
                    <Route path="rooms/:roomId" element={<AdminRoomDetailPage />} />
                    <Route path="brokers" element={<AdminBrokersPage />} />
                    <Route path="plans" element={<AdminPlansPage />} />
                    <Route path="ads" element={<AdminAdsPage />} />
                    <Route path="leads" element={<AdminLeadsPage />} />
                    <Route path="reports" element={<AdminReportsPage />} />
                    <Route path="site-settings" element={<AdminSiteSettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
        </Suspense>
    );
};

export default AdminRoutes;
