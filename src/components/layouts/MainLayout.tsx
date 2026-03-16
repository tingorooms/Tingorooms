import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Home,
    Building2,
    Users,
    Info,
    Phone,
    Menu,
    User,
    LogOut,
    LayoutDashboard,
    Sparkles,
    ChevronDown,
    Mail,
    MapPin,
    Facebook,
    Twitter,
    Instagram,
    Linkedin,
    Youtube,
    Heart,
} from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import NotificationBell from '@/components/layouts/NotificationBell';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { getMediaAssetUrl } from '@/lib/utils';

const MainLayout: React.FC = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const { settings } = useSiteSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);

    const businessName = settings.businessName || 'RoomRental';
    const businessTagline = settings.businessTagline || 'Find Your Perfect Roommate';
    const logoUrl = getMediaAssetUrl(settings.logoUrl);
    const supportEmail = settings.supportEmail || 'customer@support.com';
    const supportPhone = settings.supportPhone || '+91 99999 99999';
    const supportAddress = settings.supportAddress || 'Pune, Maharashtra';
    const facebookUrl = settings.facebookUrl || '#';
    const twitterUrl = settings.twitterUrl || '#';
    const instagramUrl = settings.instagramUrl || '#';
    const linkedinUrl = settings.linkedinUrl || '#';
    const youtubeUrl = settings.youtubeUrl || '#';
    const supportPhoneHref = `tel:${supportPhone.replace(/\s+/g, '')}`;

    useEffect(() => {
        let ticking = false;

        const updateScrolledState = () => {
            const nextScrolled = window.scrollY > 20;
            setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
            ticking = false;
        };

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(updateScrolledState);
        };

        updateScrolledState();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const navLinks = [
        { to: '/', label: 'Home', icon: Home },
        { to: '/rooms', label: 'Rooms', icon: Building2 },
        { to: '/brokers', label: 'Brokers', icon: Users },
        { to: '/about', label: 'About', icon: Info },
        { to: '/contact', label: 'Contact', icon: Phone },
    ];

    const isActiveLink = (path: string) => location.pathname === path;

    return (
        <div className="min-h-screen flex flex-col">
            <header
                className={`sticky top-0 z-50 w-full transition-all duration-300 ${
                    scrolled
                        ? 'bg-white/95 backdrop-blur-xl shadow-lg border-b border-emerald-100'
                        : 'bg-gradient-to-r from-green-primary via-green-secondary to-green-primary border-b border-white/20'
                }`}
            >
                <div className="container mx-auto px-4 h-[68px] sm:h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3 group">
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={businessName}
                                className="w-[52px] h-[52px] sm:w-12 sm:h-12 object-cover rounded-2xl transition-all duration-300 group-hover:scale-105"
                            />
                        ) : (
                            <div
                                className={`w-[52px] h-[52px] sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                                    scrolled
                                        ? 'bg-gradient-to-br from-green-primary to-green-secondary shadow-lg'
                                        : 'bg-white/20 backdrop-blur border border-white/30'
                                }`}
                            >
                                <Building2 className="w-6 h-6 text-white" />
                            </div>
                        )}
                        <div className="flex min-w-0 flex-col">
                            <span
                                className={`text-base sm:text-2xl font-extrabold tracking-tight leading-tight ${
                                    scrolled
                                        ? 'bg-gradient-to-r from-green-primary to-green-secondary bg-clip-text text-transparent'
                                        : 'text-white'
                                }`}
                            >
                                {businessName}
                            </span>
                            <span className={`text-[9px] sm:text-[10px] font-medium -mt-0.5 max-w-[170px] sm:max-w-none truncate ${scrolled ? 'text-emerald-700/80' : 'text-white/80'}`}>
                                {businessTagline}
                            </span>
                        </div>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-2">
                        {navLinks.map((link) => {
                            const Icon = link.icon;
                            const active = isActiveLink(link.to);

                            return (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                                        scrolled
                                            ? active
                                                ? 'bg-green-primary text-white shadow-md'
                                                : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                                            : active
                                              ? 'bg-white text-green-700 shadow-lg'
                                              : 'text-white/95 hover:bg-white/20 hover:text-white'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-3">
                        {isAuthenticated ? (
                            <>
                                <NotificationBell
                                    className={`transition-all duration-300 ${
                                        scrolled
                                            ? 'hover:bg-emerald-50 text-gray-700 border border-emerald-200'
                                            : 'hover:bg-white/20 text-white border border-white/20'
                                    }`}
                                    iconClassName={scrolled ? 'text-gray-700' : 'text-white'}
                                    defaultNavigatePath="/dashboard"
                                />

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className={`hidden sm:inline-flex gap-3 rounded-xl px-3 h-11 transition-all duration-300 ${
                                                scrolled
                                                    ? 'hover:bg-emerald-50 border border-emerald-200'
                                                    : 'hover:bg-white/20 border border-white/25'
                                            }`}
                                        >
                                            <div className="w-9 h-9 bg-gradient-to-br from-green-primary to-green-secondary rounded-xl flex items-center justify-center shadow-lg">
                                                <User className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="hidden sm:flex flex-col items-start">
                                                <span className={`text-sm font-semibold leading-tight ${scrolled ? 'text-gray-900' : 'text-white'}`}>
                                                    {user?.name}
                                                </span>
                                                <span className={`text-xs leading-tight ${scrolled ? 'text-gray-500' : 'text-white/75'}`}>
                                                    {user?.role}
                                                </span>
                                            </div>
                                            <ChevronDown className={`h-4 w-4 ${scrolled ? 'text-gray-500' : 'text-white/75'}`} />
                                        </Button>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent align="end" className="w-56">
                                        <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                                            <LayoutDashboard className="mr-2 h-4 w-4" />
                                            Dashboard
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => navigate('/dashboard/profile')}>
                                            <User className="mr-2 h-4 w-4" />
                                            Profile
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {user?.role === 'Admin' && (
                                            <>
                                                <DropdownMenuItem onClick={() => navigate('/admin')}>
                                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                                    Admin Panel
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                            </>
                                        )}
                                        <DropdownMenuItem onClick={handleLogout}>
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Logout
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        ) : (
                            <div className="hidden sm:flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => navigate('/login')}
                                    className={`rounded-xl font-semibold ${
                                        scrolled
                                            ? 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                                            : 'text-white hover:bg-white/20'
                                    }`}
                                >
                                    Login
                                </Button>
                                <Button
                                    onClick={() => navigate('/register')}
                                    className={`rounded-xl font-semibold shadow-lg transition-all duration-300 hover:scale-105 ${
                                        scrolled
                                            ? 'bg-gradient-to-r from-green-primary to-green-secondary hover:from-green-secondary hover:to-green-primary text-white'
                                            : 'bg-white text-green-700 hover:bg-white/95'
                                    }`}
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Register
                                </Button>
                            </div>
                        )}

                        <Sheet>
                            <SheetTrigger
                                className={`lg:hidden rounded-xl p-2 transition-all duration-300 ${
                                    scrolled
                                        ? 'hover:bg-emerald-50 text-gray-700'
                                        : 'hover:bg-white/20 text-white'
                                }`}
                                aria-label="Open menu"
                            >
                                <Menu className="h-6 w-6" />
                            </SheetTrigger>

                            <SheetContent side="right" className="w-80 p-0 flex flex-col">
                                <div className="h-16 flex items-center px-6 border-b bg-gradient-to-r from-green-primary to-green-secondary">
                                    <SheetClose asChild>
                                        <Link to="/" className="flex items-center gap-3">
                                            {logoUrl ? (
                                                <img
                                                    src={logoUrl}
                                                    alt={businessName}
                                                    className="w-11 h-11 object-cover rounded-2xl ring-2 ring-white/30"
                                                />
                                            ) : (
                                                <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center ring-2 ring-white/30">
                                                    <Building2 className="w-6 h-6 text-white" />
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-xl font-extrabold text-white">{businessName}</span>
                                                <span className="text-xs text-white/80 line-clamp-1">{businessTagline}</span>
                                            </div>
                                        </Link>
                                    </SheetClose>
                                </div>

                                <nav className="flex-1 overflow-y-auto px-4 py-6">
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">Navigation</p>
                                        {navLinks.map((link) => {
                                            const Icon = link.icon;
                                            const active = isActiveLink(link.to);

                                            return (
                                                <SheetClose asChild key={link.to}>
                                                    <Link
                                                        to={link.to}
                                                        className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300 group ${
                                                            active
                                                                ? 'bg-gradient-to-r from-green-primary to-green-secondary text-white shadow-lg shadow-green-primary/30'
                                                                : 'text-gray-700 hover:bg-green-50 hover:text-green-primary hover:translate-x-1'
                                                        }`}
                                                    >
                                                        <Icon className="w-5 h-5" />
                                                        {link.label}
                                                        {active && <span className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />}
                                                    </Link>
                                                </SheetClose>
                                            );
                                        })}
                                    </div>

                                    {!isAuthenticated && (
                                        <div className="mt-8 space-y-2">
                                            <div className="h-px bg-gray-200 my-6" />
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">Account</p>
                                            <SheetClose asChild>
                                                <Link
                                                    to="/login"
                                                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all duration-300 hover:translate-x-1"
                                                >
                                                    <User className="w-5 h-5" />
                                                    Login
                                                </Link>
                                            </SheetClose>
                                            <SheetClose asChild>
                                                <Link
                                                    to="/register"
                                                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-green-primary to-green-secondary text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                                                >
                                                    <Sparkles className="w-5 h-5" />
                                                    Register Now
                                                </Link>
                                            </SheetClose>
                                        </div>
                                    )}

                                    {isAuthenticated && (
                                        <div className="mt-8 space-y-2">
                                            <div className="h-px bg-gray-200 my-6" />
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">Account</p>
                                            <SheetClose asChild>
                                                <Link
                                                    to="/dashboard"
                                                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-green-50 hover:text-green-primary transition-all duration-300 hover:translate-x-1"
                                                >
                                                    <LayoutDashboard className="w-5 h-5" />
                                                    Dashboard
                                                </Link>
                                            </SheetClose>
                                            <SheetClose asChild>
                                                <Link
                                                    to="/dashboard/profile"
                                                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-green-50 hover:text-green-primary transition-all duration-300 hover:translate-x-1"
                                                >
                                                    <User className="w-5 h-5" />
                                                    Profile
                                                </Link>
                                            </SheetClose>
                                            {user?.role === 'Admin' && (
                                                <SheetClose asChild>
                                                    <Link
                                                        to="/admin"
                                                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-green-50 hover:text-green-primary transition-all duration-300 hover:translate-x-1"
                                                    >
                                                        <LayoutDashboard className="w-5 h-5" />
                                                        Admin Panel
                                                    </Link>
                                                </SheetClose>
                                            )}
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all duration-300 hover:translate-x-1"
                                            >
                                                <LogOut className="w-5 h-5" />
                                                Logout
                                            </button>
                                        </div>
                                    )}
                                </nav>

                                <div className="border-t px-4 py-4 bg-gray-50">
                                    <p className="text-xs text-center text-gray-500">© {new Date().getFullYear()} {businessName}</p>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <Outlet />
            </main>

            <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-green-900 text-white">
                <div className="container mx-auto px-4 py-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                {logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt={businessName}
                                        className="w-12 h-12 object-cover rounded-xl shadow-lg"
                                    />
                                ) : (
                                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                                        <Building2 className="w-7 h-7 text-white" />
                                    </div>
                                )}
                                <div>
                                    <span className="text-2xl font-bold bg-gradient-to-r from-green-400 to-green-200 bg-clip-text text-transparent">
                                        {businessName}
                                    </span>
                                    <p className="text-xs text-green-300">Your Home Awaits</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Find your perfect room, roommate, or property. The most trusted platform for room rentals in Maharashtra.
                            </p>
                            <div className="flex gap-3 pt-2">
                                {facebookUrl && facebookUrl !== '#' && (
                                    <a
                                        href={facebookUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Facebook"
                                        aria-label="Facebook"
                                        className="w-10 h-10 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-green-500 hover:text-white hover:scale-110 transition-all duration-300"
                                    >
                                        <Facebook className="w-5 h-5" />
                                    </a>
                                )}
                                {twitterUrl && twitterUrl !== '#' && (
                                    <a
                                        href={twitterUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Twitter"
                                        aria-label="Twitter"
                                        className="w-10 h-10 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-green-500 hover:text-white hover:scale-110 transition-all duration-300"
                                    >
                                        <Twitter className="w-5 h-5" />
                                    </a>
                                )}
                                {instagramUrl && instagramUrl !== '#' && (
                                    <a
                                        href={instagramUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Instagram"
                                        aria-label="Instagram"
                                        className="w-10 h-10 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-green-500 hover:text-white hover:scale-110 transition-all duration-300"
                                    >
                                        <Instagram className="w-5 h-5" />
                                    </a>
                                )}
                                {linkedinUrl && linkedinUrl !== '#' && (
                                    <a
                                        href={linkedinUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="LinkedIn"
                                        aria-label="LinkedIn"
                                        className="w-10 h-10 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-green-500 hover:text-white hover:scale-110 transition-all duration-300"
                                    >
                                        <Linkedin className="w-5 h-5" />
                                    </a>
                                )}
                                {youtubeUrl && youtubeUrl !== '#' && (
                                    <a
                                        href={youtubeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="YouTube"
                                        aria-label="YouTube"
                                        className="w-10 h-10 bg-white/10 text-white rounded-lg flex items-center justify-center hover:bg-green-500 hover:text-white hover:scale-110 transition-all duration-300"
                                    >
                                        <Youtube className="w-5 h-5" />
                                    </a>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-lg font-bold mb-6 text-green-300 flex items-center gap-2">
                                <span className="w-1 h-6 bg-green-400 rounded-full"></span>
                                Quick Links
                            </h4>
                            <ul className="space-y-3">
                                <li>
                                    <Link to="/" className="text-slate-300 hover:text-green-400 inline-flex items-center gap-2 transition-colors duration-200">
                                        <Home className="w-4 h-4" />
                                        Home
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/rooms" className="text-slate-300 hover:text-green-400 inline-flex items-center gap-2 transition-colors duration-200">
                                        <Building2 className="w-4 h-4" />
                                        Browse Rooms
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/brokers" className="text-slate-300 hover:text-green-400 inline-flex items-center gap-2 transition-colors duration-200">
                                        <Users className="w-4 h-4" />
                                        Top Brokers
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/about" className="text-slate-300 hover:text-green-400 inline-flex items-center gap-2 transition-colors duration-200">
                                        <Info className="w-4 h-4" />
                                        About Us
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-lg font-bold mb-6 text-green-300 flex items-center gap-2">
                                <span className="w-1 h-6 bg-green-400 rounded-full"></span>
                                Support
                            </h4>
                            <ul className="space-y-3">
                                <li>
                                    <Link to="/contact" className="text-slate-300 hover:text-green-400 inline-flex items-center gap-2 transition-colors duration-200">
                                        Contact Us
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/terms-conditions" className="text-slate-300 hover:text-green-400 inline-flex items-center gap-2 transition-colors duration-200">
                                        Terms and Conditions
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/rooms" className="text-slate-300 hover:text-green-400 inline-flex items-center gap-2 transition-colors duration-200">
                                        Room Listings
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/brokers" className="text-slate-300 hover:text-green-400 inline-flex items-center gap-2 transition-colors duration-200">
                                        Broker Directory
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-lg font-bold mb-6 text-green-300 flex items-center gap-2">
                                <span className="w-1 h-6 bg-green-400 rounded-full"></span>
                                Contact Us
                            </h4>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3 text-slate-300">
                                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Mail className="w-4 h-4 text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 mb-0.5">Email</p>
                                        <a href={`mailto:${supportEmail}`} className="hover:text-green-400 transition-colors">
                                            {supportEmail}
                                        </a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3 text-slate-300">
                                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Phone className="w-4 h-4 text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 mb-0.5">Phone</p>
                                        <a href={supportPhoneHref} className="hover:text-green-400 transition-colors">
                                            {supportPhone}
                                        </a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3 text-slate-300">
                                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <MapPin className="w-4 h-4 text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 mb-0.5">Location</p>
                                        <p>{supportAddress}</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-slate-400">© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                            Made with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> in Maharashtra
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MainLayout;
