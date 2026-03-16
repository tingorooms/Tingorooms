import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
    LayoutDashboard,
    Users,
    Building2,
    UserCheck,
    Package,
    Megaphone,
    MessageSquare,
    BarChart3,
    LogOut,
    Menu,
    ChevronRight,
    Shield,
    User,
    Settings
} from 'lucide-react';
import { cn, getMediaAssetUrl } from '@/lib/utils';
import NotificationBell from '@/components/layouts/NotificationBell';
import { useSiteSettings } from '@/context/SiteSettingsContext';

const AdminLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const { settings } = useSiteSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const businessName = settings.businessName || 'RoomRental';
    const logoUrl = getMediaAssetUrl(settings.logoUrl);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const sidebarLinks = [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/rooms', label: 'Rooms', icon: Building2 },
        { to: '/admin/brokers', label: 'Brokers', icon: UserCheck },
        { to: '/admin/plans', label: 'Plans', icon: Package },
        { to: '/admin/ads', label: 'Ads', icon: Megaphone },
        { to: '/admin/leads', label: 'Leads', icon: MessageSquare },
        { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
        { to: '/admin/site-settings', label: 'Site Settings', icon: Settings },
    ];

    const isActive = (path: string) => {
        if (path === '/admin') {
            return location.pathname === '/admin';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen flex">
            <aside className="hidden lg:flex w-64 flex-col border-r bg-slate-900 text-white">
                <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-gradient-to-r from-green-600 to-green-500">
                    <Link to="/admin" className="flex items-center gap-3">
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={businessName}
                                className="w-10 h-10 object-cover rounded-xl ring-2 ring-white/30"
                            />
                        ) : (
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center ring-2 ring-white/30">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                        )}
                        <div>
                            <span className="text-xl font-bold text-white">Admin Panel</span>
                            <p className="text-xs text-green-50">{businessName} Manager</p>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-auto">
                    {sidebarLinks.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative group',
                                isActive(link.to)
                                    ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/20'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
                            )}
                        >
                            <link.icon className="w-5 h-5" />
                            {link.label}
                            {isActive(link.to) && (
                                <span className="absolute right-3 w-2 h-2 bg-white rounded-full animate-pulse" />
                            )}
                        </Link>
                    ))}
                </nav>

                <div className="px-4 py-4 border-t border-slate-800 bg-slate-900/50">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-600/20 hover:text-red-400 transition-all duration-200 hover:translate-x-1"
                    >
                        <LogOut className="w-5 h-5" />
                        Logout
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-slate-50 to-green-50/20">
                <header className="sticky top-0 z-30 h-[68px] sm:h-16 bg-white/95 backdrop-blur border-b border-green-100 flex items-center justify-between px-3 sm:px-4 lg:px-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                            <SheetTrigger className="lg:hidden rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                                    <Menu className="h-5 w-5" />
                                </SheetTrigger>
                            <SheetContent side="left" className="w-72 p-0 bg-slate-900 flex flex-col">
                                <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-gradient-to-r from-green-600 to-green-500 shadow-lg">
                                    <Link to="/admin" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                                        {logoUrl ? (
                                            <img
                                                src={logoUrl}
                                                alt={businessName}
                                                className="w-11 h-11 object-cover rounded-xl ring-2 ring-white/30 transition-transform hover:scale-110"
                                            />
                                        ) : (
                                            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center ring-2 ring-white/30 transition-transform hover:scale-110">
                                                <Shield className="w-6 h-6 text-white" />
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-xl font-bold text-white">Admin Panel</span>
                                            <p className="text-xs text-green-50">{businessName}</p>
                                        </div>
                                    </Link>
                                </div>

                                <nav className="flex-1 overflow-y-auto px-4 py-6">
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">Management</p>
                                        {sidebarLinks.map((link) => (
                                            <Link
                                                key={link.to}
                                                to={link.to}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={cn(
                                                    'flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 relative group',
                                                    isActive(link.to)
                                                        ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/20'
                                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
                                                )}
                                            >
                                                <link.icon className="w-5 h-5" />
                                                {link.label}
                                                {isActive(link.to) && (
                                                    <span className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
                                                )}
                                            </Link>
                                        ))}
                                    </div>

                                    <div className="mt-8 space-y-2">
                                        <div className="h-px bg-slate-800 my-6" />
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">Quick Actions</p>
                                        <Link
                                            to="/dashboard"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-300 hover:translate-x-1"
                                        >
                                            <LayoutDashboard className="w-5 h-5" />
                                            User Dashboard
                                        </Link>
                                        <button
                                            onClick={() => {
                                                handleLogout();
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-all duration-300 hover:translate-x-1"
                                        >
                                            <LogOut className="w-5 h-5" />
                                            Logout
                                        </button>
                                    </div>
                                </nav>

                                <div className="border-t border-slate-800 px-4 py-4 bg-slate-900/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md">
                                            <Shield className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                                            <p className="text-xs text-green-400">Administrator</p>
                                        </div>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>

                        <nav className="hidden md:flex items-center gap-2 text-sm text-slate-600">
                            <Link to="/admin" className="hover:text-green-600 font-medium transition-colors">Admin</Link>
                            {location.pathname !== '/admin' && (
                                <>
                                    <ChevronRight className="w-4 h-4 text-green-400" />
                                    <span className="text-green-600 font-semibold capitalize">
                                        {location.pathname.split('/').pop()?.replace('-', ' ')}
                                    </span>
                                </>
                            )}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <NotificationBell
                            className="hover:bg-green-50"
                            iconClassName="text-slate-600"
                            defaultNavigatePath="/admin"
                        />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="hidden sm:inline-flex gap-2 px-2 sm:px-3 hover:bg-green-50">
                                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="hidden sm:flex flex-col items-start">
                                        <span className="text-sm font-semibold text-slate-700">{user?.name}</span>
                                        <span className="text-xs text-green-600">Administrator</span>
                                    </div>
                                </Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                    User Dashboard
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <main className="flex-1 p-3 sm:p-4 lg:p-8 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;