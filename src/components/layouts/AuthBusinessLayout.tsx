import { Link, Outlet, useLocation } from 'react-router-dom';
import { Building2, CheckCircle2, Shield, Sparkles, Users } from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { Button } from '@/components/ui/button';
import { getMediaAssetUrl } from '@/lib/utils';

const AuthBusinessLayout: React.FC = () => {
    const { settings } = useSiteSettings();
    const location = useLocation();

    const businessName = settings.businessName || 'RoomRental';
    const tagline = settings.businessTagline || 'Find your perfect room and trusted roommate';
    const logoUrl = getMediaAssetUrl(settings.logoUrl);
    const isAuthRoute = ['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password'].includes(location.pathname);

    const navItems = [
        { label: 'Home', to: '/' },
        { label: 'Rooms', to: '/rooms' },
        { label: 'Brokers', to: '/brokers' },
        { label: 'About', to: '/about' },
        { label: 'Contact', to: '/contact' },
    ];

    const highlights = [
        {
            icon: CheckCircle2,
            title: 'Verified Listings',
            description: 'Every property goes through authenticity checks.',
        },
        {
            icon: Users,
            title: 'Trusted Community',
            description: 'Connect with real owners, brokers, and members.',
        },
        {
            icon: Shield,
            title: 'Secure Platform',
            description: 'Strong security standards for account and data protection.',
        },
    ];

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_40%),linear-gradient(135deg,#f7fdf9,#effbf3,#f5fbff)]">
            <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur-xl shadow-sm">
                <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between px-4 sm:px-6">
                    <Link to="/" className="inline-flex items-center gap-2.5">
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={businessName}
                                className="h-9 w-9 rounded-lg object-cover"
                            />
                        ) : (
                            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-green-primary to-green-secondary flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-white" />
                            </div>
                        )}
                        <div>
                            <p className="text-base font-extrabold text-slate-900 leading-tight">{businessName}</p>
                            <p className="text-[10px] text-slate-500 leading-tight">Business Ready Platform</p>
                        </div>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1.5">
                        {navItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${location.pathname === item.to ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                            <Link to="/login">Login</Link>
                        </Button>
                        <Button asChild size="sm" className="bg-gradient-to-r from-green-primary to-green-secondary hover:from-green-secondary hover:to-green-primary text-white">
                            <Link to="/register">Register</Link>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-[1500px] grid-cols-1 lg:grid-cols-2">
                <section className="hidden lg:flex flex-col justify-between border-r border-emerald-100/80 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 p-10 text-white">
                    <div className="space-y-8">
                        <Link to="/" className="inline-flex items-center gap-3">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt={businessName}
                                    className="h-12 w-12 rounded-xl object-cover ring-2 ring-white/30"
                                />
                            ) : (
                                <div className="h-12 w-12 rounded-xl bg-white/15 ring-2 ring-white/30 flex items-center justify-center">
                                    <Building2 className="h-7 w-7 text-white" />
                                </div>
                            )}
                            <div>
                                <p className="text-2xl font-extrabold leading-tight">{businessName}</p>
                                <p className="text-xs text-emerald-100/90">Business Ready Rental Platform</p>
                            </div>
                        </Link>

                        <div className="space-y-4">
                            <p className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
                                <Sparkles className="mr-2 h-3.5 w-3.5" />
                                Trusted by renters and owners across Maharashtra
                            </p>
                            <h1 className="text-4xl font-extrabold leading-tight">
                                One platform for rooms, roommates, and smarter rental growth.
                            </h1>
                            <p className="max-w-xl text-base text-emerald-100/95 leading-relaxed">{tagline}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {highlights.map((item) => (
                            <div key={item.title} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <p className="text-sm font-semibold">{item.title}</p>
                                <p className="text-sm text-emerald-100/90">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="flex items-center justify-center p-4 sm:p-8 lg:p-10">
                    <div className="w-full max-w-2xl rounded-3xl border border-emerald-100 bg-white/95 p-4 sm:p-6 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur">
                        <div className="mb-5 border-b border-emerald-100 pb-4 lg:hidden">
                            <Link to="/" className="inline-flex items-center gap-3">
                                {logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt={businessName}
                                        className="h-10 w-10 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-primary to-green-secondary flex items-center justify-center">
                                        <Building2 className="h-5 w-5 text-white" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-lg font-bold text-slate-900">{businessName}</p>
                                    <p className="text-xs text-slate-500">Secure access portal</p>
                                </div>
                            </Link>
                        </div>
                        {!isAuthRoute && (
                            <p className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                                Secure access area
                            </p>
                        )}
                        <Outlet />
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AuthBusinessLayout;
