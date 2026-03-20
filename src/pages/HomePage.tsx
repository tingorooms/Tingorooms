import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Building2,
    MapPin,
    Search,
    ArrowRight,
    Wallet,
    CheckCircle,
    MessageCircle,
    Home,
    Users,
    TrendingUp,
    Shield,
    Sparkles,
    Clock,
    Star
} from 'lucide-react';
import type { Room } from '@/types';
import { getRooms, getActiveAds, type PublicAd } from '@/services/roomService';
import { getPublicBrokers } from '@/services/brokerService';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import RoomCard from '@/components/rooms/RoomCard';
import { WARM_BROKERS_LIST_KEY, WARM_ROOMS_LIST_KEY, writeWarmCache } from '@/lib/pageWarmCache';

const HOME_CACHE_KEY = 'home-page-cache-v1';
const HOME_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

type HomeStats = {
    total_rooms: number;
    total_members: number;
    total_roommates: number;
};

type HomeCachePayload = {
    createdAt: number;
    featuredRooms: Room[];
    recentRooms: Room[];
    activeAds: PublicAd[];
};

const useCountUp = (target: number, start: boolean, duration = 900): number => {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!start) return;
        const finalValue = Math.max(0, Math.floor(target || 0));
        if (finalValue === 0) {
            setValue(0);
            return;
        }

        let rafId = 0;
        const startAt = performance.now();

        const tick = (now: number) => {
            const progress = Math.min((now - startAt) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.floor(finalValue * eased));

            if (progress < 1) {
                rafId = requestAnimationFrame(tick);
            } else {
                setValue(finalValue);
            }
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [target, start, duration]);

    return value;
};

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { openChat } = useChat();
    const { isAuthenticated } = useAuth();
    const [featuredRooms, setFeaturedRooms] = useState<Room[]>([]);
    const [recentRooms, setRecentRooms] = useState<Room[]>([]);
    // true while the first API fetch is in flight — prevents flash of empty state
    const [isRoomsLoading, setIsRoomsLoading] = useState(true);
    const [stats, setStats] = useState<HomeStats>({
        total_rooms: 0,
        total_members: 0,
        total_roommates: 0
    });
    const [activeAds, setActiveAds] = useState<PublicAd[]>([]);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [searchDetails, setSearchDetails] = useState('');
    const [searchPlaceholderIndex, setSearchPlaceholderIndex] = useState(0);
    const searchCardRef = useRef<HTMLDivElement | null>(null);
    const statsRef = useRef<HTMLDivElement | null>(null);
    const [statsVisible, setStatsVisible] = useState(false);

    const searchControlHeightClass = 'h-14 min-h-[56px] max-h-[56px]';

    const animatedTotalRooms = useCountUp(stats.total_rooms || 0, statsVisible);
    const animatedTotalMembers = useCountUp(stats.total_members || 0, statsVisible);
    const animatedTotalChats = useCountUp(stats.total_roommates || 0, statsVisible);
    const animatedCoveredCities = useCountUp(15, statsVisible);

    useEffect(() => {
        const readCachedHomeData = (): HomeCachePayload | null => {
            try {
                const raw = window.sessionStorage.getItem(HOME_CACHE_KEY);
                if (!raw) return null;

                const parsed = JSON.parse(raw) as HomeCachePayload;
                if (!parsed?.createdAt) return null;
                if (Date.now() - parsed.createdAt > HOME_CACHE_MAX_AGE_MS) return null;

                return parsed;
            } catch {
                return null;
            }
        };

        const writeCachedHomeData = (payload: Omit<HomeCachePayload, 'createdAt'>) => {
            try {
                const cachePayload: HomeCachePayload = {
                    createdAt: Date.now(),
                    ...payload
                };
                window.sessionStorage.setItem(HOME_CACHE_KEY, JSON.stringify(cachePayload));
            } catch {
            }
        };

        const cached = readCachedHomeData();
        if (cached) {
            setFeaturedRooms(cached.featuredRooms || []);
            setRecentRooms(cached.recentRooms || []);
            setActiveAds(cached.activeAds || []);
            // Cache hit → no loading flash
            setIsRoomsLoading(false);
        }

        const fetchData = async () => {
            try {
                // Pull one room payload and derive both sections to avoid duplicate network and parse cost.
                const [roomsData, adsData] = await Promise.all([
                    getRooms({ limit: 12, page: 1 }),
                    getActiveAds()
                ]);

                const nextFeaturedRooms = roomsData.data.slice(0, 6);
                const nextRecentRooms = roomsData.data;

                setFeaturedRooms(nextFeaturedRooms);
                setRecentRooms(nextRecentRooms);
                setActiveAds(adsData || []);
                setIsRoomsLoading(false);
                writeCachedHomeData({
                    featuredRooms: nextFeaturedRooms,
                    recentRooms: nextRecentRooms,
                    activeAds: adsData || [],
                });

                // Stable stats seeded from total rooms count (no random flicker)
                const total = roomsData.pagination?.totalItems || nextRecentRooms.length || 0;
                setStats({
                    total_rooms: Math.max(total, 150),
                    total_members: Math.max(total * 8, 1200),
                    total_roommates: Math.max(Math.floor(total * 0.4), 80)
                });

                // Warm up Rooms/Brokers pages after Home is ready so navigation feels instant.
                const runWarmPrefetch = async () => {
                    try {
                        const [roomsWarm, brokersWarm] = await Promise.all([
                            getRooms({ page: 1, limit: 3 }),
                            getPublicBrokers({ page: 1, limit: 3, sort: 'top_listed' })
                        ]);

                        writeWarmCache(WARM_ROOMS_LIST_KEY, {
                            rooms: roomsWarm.data,
                            pagination: roomsWarm.pagination,
                        });

                        writeWarmCache(WARM_BROKERS_LIST_KEY, {
                            brokers: brokersWarm.data,
                            pagination: brokersWarm.pagination,
                        });
                    } catch {
                        // Silently ignore warmup errors.
                    }
                };

                const idleHost = window as Window & {
                    requestIdleCallback?: (cb: () => void) => number;
                };

                if (typeof idleHost.requestIdleCallback === 'function') {
                    idleHost.requestIdleCallback(() => {
                        void runWarmPrefetch();
                    });
                } else {
                    globalThis.setTimeout(() => {
                        void runWarmPrefetch();
                    }, 400);
                }
            } catch {
                setIsRoomsLoading(false);
            }
        };

        void fetchData();
    }, []);

    // Auto-scroll to search bar only on mobile (not needed on desktop where it's already visible)
    useEffect(() => {
        if (window.innerWidth >= 1024) return;
        const timer = window.setTimeout(() => {
            searchCardRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        const element = statsRef.current;
        if (!element || typeof IntersectionObserver === 'undefined') {
            setStatsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setStatsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.25 }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const features = [
        {
            icon: Home,
            title: 'Easy Search',
            description: 'Find rooms with powerful filters by location, price, type, and amenities'
        },
        {
            icon: CheckCircle,
            title: 'Verified Listings',
            description: 'All properties are verified by our admin team for authenticity'
        },
        {
            icon: MessageCircle,
            title: 'Live Chat',
            description: 'Connect directly with property owners through our chat system'
        },
        {
            icon: Wallet,
            title: 'Expense Management',
            description: 'Split bills and track expenses easily with your roommates'
        }
    ];

    // Slides for search card placement (MP_Search)
    const adSlides = useMemo(() => {
        const searchBarAds = activeAds.filter((ad) => !ad.card_placement || ad.card_placement === 'MP_Search');

        return searchBarAds.flatMap((ad) => {
            const adImages = ad.images && ad.images.length > 0 ? ad.images : [null];

            return adImages.map((imageUrl, imageIndex) => ({
                adId: ad.id,
                adTitle: ad.banner_title,
                adDescription: ad.description,
                adPriority: ad.priority || 0,
                imageUrl,
                imageIndex
            }));
        });
    }, [activeAds]);

    // Separate slides for Post Room Card placement (MP_Post1)
    const postRoomAdSlides = useMemo(() => {
        const postRoomAds = activeAds.filter((ad) => ad.card_placement === 'MP_Post1');

        return postRoomAds.flatMap((ad) => {
            const adImages = ad.images && ad.images.length > 0 ? ad.images : [null];

            return adImages.map((imageUrl, imageIndex) => ({
                adId: ad.id,
                adTitle: ad.banner_title,
                adDescription: ad.description,
                adPriority: ad.priority || 0,
                imageUrl,
                imageIndex
            }));
        });
    }, [activeAds]);

    const [postRoomAdIndex, setPostRoomAdIndex] = useState(0);

    useEffect(() => {
        if (adSlides.length <= 1) {
            return;
        }

        const timer = window.setInterval(() => {
            setActiveSlideIndex((prev) => (prev + 1) % adSlides.length);
        }, 4000);

        return () => window.clearInterval(timer);
    }, [adSlides.length]);

    useEffect(() => {
        if (postRoomAdSlides.length <= 1) {
            return;
        }

        const timer = window.setInterval(() => {
            setPostRoomAdIndex((prev) => (prev + 1) % postRoomAdSlides.length);
        }, 4000);

        return () => window.clearInterval(timer);
    }, [postRoomAdSlides.length]);

    useEffect(() => {
        setActiveSlideIndex(0);
    }, [adSlides.length]);

    useEffect(() => {
        setPostRoomAdIndex(0);
    }, [postRoomAdSlides.length]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setSearchPlaceholderIndex((prev) => (prev + 1) % 3);
        }, 1600);

        return () => window.clearInterval(timer);
    }, []);

    const placeholderTerms = ['Area', 'City', 'Landmark'];
    const currentSlide = adSlides[activeSlideIndex] || null;

    const currentPostRoomAd = postRoomAdSlides[postRoomAdIndex] || null;

    const handleChatClick = async (roomId: string) => {
        try {
            if (!isAuthenticated) {
                navigate('/login', { state: { from: { pathname: window.location.pathname, search: window.location.search } } });
                return;
            }

            const room = [...featuredRooms, ...recentRooms].find((item) => item.room_id === roomId);
            const chatRoomId = room?.id ?? (room?.room_id ? Number(room.room_id) : undefined);

            if (!room?.room_id || !room?.user_id || !chatRoomId || Number.isNaN(chatRoomId)) {
                return;
            }

            await openChat(chatRoomId, room.user_id, room);
        } catch (error) {
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-bg via-white to-green-bg">
            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-green-primary via-green-secondary to-green-primary text-white pt-[20px] pb-[20px] md:pt-[30px] md:pb-[30px]">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse [animation-delay:1s]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-white/5 blur-3xl" />
                </div>

                <div className="max-w-screen-2xl mx-auto px-[10px] sm:px-5 lg:px-6 relative z-10 space-y-[10px] md:space-y-[30px]">
                    {/* Main Heading and Post Room Section - Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        {/* Left Column - Badges & Find Perfect Room */}
                        <div className="space-y-3">
                            {/* Top Badges */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <Badge className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white font-medium text-sm shadow-lg">
                                    <Sparkles className="w-4 h-4 mr-2 inline" />
                                    #1 Room Rental Platform in Maharashtra
                                </Badge>
                                <Badge className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white font-medium text-sm shadow-lg">
                                    <TrendingUp className="w-4 h-4 mr-2 inline" />
                                    5000+ Active Users
                                </Badge>
                            </div>

                            {/* Heading */}
                            <div className="space-y-5">
                                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl font-extrabold leading-tight drop-shadow-xl">
                                    Find Your Perfect
                                    <span className="block mt-2 bg-gradient-to-r from-yellow-200 via-pink-200 to-yellow-200 bg-clip-text text-transparent">
                                        Room & Roommate
                                    </span>
                                </h1>
                                <p className="text-lg sm:text-xl md:text-2xl text-white/90 leading-relaxed font-light">
                                    Find your space, connect with the right people, and live smarter effortlessly.
                                </p>
                            </div>

                            {/* Features Grid Below Text */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-[4px] md:gap-4">
                                {[
                                    {
                                        icon: CheckCircle,
                                        title: 'Instant Verification',
                                        desc: 'Quick profile check',
                                        label: 'Fast',
                                        color: 'from-emerald-500/40 via-green-500/25 to-lime-400/10',
                                        border: 'border-emerald-400/70',
                                        iconBg: 'bg-emerald-400/30',
                                        iconColor: 'text-emerald-200',
                                        delayClass: '[animation-delay:100ms]',
                                        gradient: 'from-emerald-400 via-green-400 to-lime-300',
                                        glow: 'group-hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]',
                                        labelClass: 'bg-emerald-300/20 text-emerald-100 border-emerald-200/40'
                                    },
                                    {
                                        icon: MessageCircle,
                                        title: 'Direct Communication',
                                        desc: 'Chat with owners directly',
                                        label: 'Live',
                                        color: 'from-blue-500/40 via-sky-500/25 to-indigo-400/10',
                                        border: 'border-blue-400/70',
                                        iconBg: 'bg-blue-400/30',
                                        iconColor: 'text-blue-200',
                                        delayClass: '[animation-delay:200ms]',
                                        gradient: 'from-blue-400 via-sky-400 to-indigo-300',
                                        glow: 'group-hover:shadow-[0_0_24px_rgba(59,130,246,0.35)]',
                                        labelClass: 'bg-blue-300/20 text-blue-100 border-blue-200/40'
                                    },
                                    {
                                        icon: TrendingUp,
                                        title: 'Increased Visibility',
                                        desc: 'Boosted listing reach',
                                        label: 'Boost',
                                        color: 'from-cyan-500/40 via-teal-500/25 to-sky-400/10',
                                        border: 'border-cyan-400/70',
                                        iconBg: 'bg-cyan-400/30',
                                        iconColor: 'text-cyan-200',
                                        delayClass: '[animation-delay:300ms]',
                                        gradient: 'from-cyan-400 via-teal-400 to-sky-300',
                                        glow: 'group-hover:shadow-[0_0_24px_rgba(34,211,238,0.35)]',
                                        labelClass: 'bg-cyan-300/20 text-cyan-100 border-cyan-200/40'
                                    }
                                ].map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`group relative overflow-hidden rounded-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${item.glow} ${item.delayClass} animate-in fade-in slide-in-from-bottom-8 duration-700`}>
                                        
                                        {/* Background Gradient */}
                                        <div className={`absolute inset-0 bg-slate-900/55 border ${item.border}`}></div>
                                        <div className={`absolute inset-0 bg-gradient-to-br ${item.color}`}></div>
                                        
                                        {/* Animated hover overlay */}
                                        <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                                        <div className={`absolute -inset-px bg-gradient-to-r ${item.gradient} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300`}></div>
                                        
                                        {/* Content */}
                                        <div className="relative z-10 p-3 md:p-3.5 h-full flex items-start gap-2.5">
                                            <div className={`flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg ${item.iconBg} transition-transform duration-300 backdrop-blur-sm border border-white/20 group-hover:scale-105 flex-shrink-0`}>
                                                <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                                            </div>

                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="text-[13px] md:text-sm font-semibold text-white leading-tight">
                                                        {item.title}
                                                    </h3>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${item.labelClass}`}>
                                                        {item.label}
                                                    </span>
                                                </div>
                                                <p className="text-white/75 text-[11px] md:text-xs leading-snug font-medium">
                                                    {item.desc}
                                                </p>
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column - Simple Search Card */}
                        <div className="lg:mt-0 group">
                            <Card ref={searchCardRef} className="shadow-[0_18px_44px_rgba(14,116,144,0.35)] border border-cyan-100/40 ring-1 ring-white/15 overflow-hidden rounded-2xl relative group bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/85">
                                <div className="absolute inset-0 w-full h-full pointer-events-none">
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.16),transparent_40%),linear-gradient(125deg,rgba(2,6,23,0.95),rgba(30,41,59,0.9),rgba(15,23,42,0.95))]" />
                                    <div className="absolute -top-28 -right-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
                                    <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
                                </div>

                                {currentSlide && currentSlide.imageUrl && (
                                    <div className="absolute inset-0 w-full h-full">
                                        <img
                                            src={currentSlide.imageUrl}
                                            alt={currentSlide.adTitle || 'Search ad'}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/40" />
                                    </div>
                                )}

                                <CardContent className="relative z-10 p-4 sm:p-5 space-y-4">
                                    <div className="space-y-2.5">
                                        <Badge className="px-4 py-2 bg-gradient-to-r from-cyan-500/85 to-blue-500/85 backdrop-blur-sm border-white/30 text-white font-semibold shadow-lg">
                                            <Search className="w-4 h-4 mr-2" />
                                            Quick Room Search
                                        </Badge>
                                        <h3 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-cyan-200 via-sky-100 to-emerald-200 bg-clip-text text-transparent leading-tight">
                                            Discover Rooms Near You
                                        </h3>
                                        <p className="text-white/85 text-sm md:text-base leading-relaxed">
                                            Instantly explore affordable, verified spaces tailored to your needs.
                                        </p>
                                    </div>

                                    {currentSlide && (currentSlide.adTitle || currentSlide.adDescription) && (
                                        <div className="space-y-1">
                                            {currentSlide.adTitle && (
                                                <p className="text-white text-xl md:text-2xl font-extrabold leading-tight drop-shadow-lg">
                                                    {currentSlide.adTitle}
                                                </p>
                                            )}
                                            {currentSlide.adDescription && (
                                                <p className="text-white/90 text-sm md:text-base leading-relaxed">
                                                    {currentSlide.adDescription}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <Input
                                            value={searchDetails}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setSearchDetails(value);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    const query = searchDetails.trim();
                                                    navigate(query ? `/rooms?search=${encodeURIComponent(query)}&focusSearch=1` : '/rooms?focusSearch=1');
                                                }
                                            }}
                                            onFocus={() => {
                                                // Direct users to the full search experience on Rooms page
                                                const query = searchDetails.trim();
                                                navigate(query ? `/rooms?search=${encodeURIComponent(query)}&focusSearch=1` : '/rooms?focusSearch=1');
                                            }}
                                            placeholder={`Search ${placeholderTerms[searchPlaceholderIndex]}`}
                                            className={`pl-4 pr-4 ${searchControlHeightClass} text-base font-semibold border-2 border-cyan-200/70 hover:border-cyan-300 focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 bg-white/95 backdrop-blur rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 text-slate-900 placeholder:text-slate-500`}
                                        />
                                        {adSlides.length > 1 && (
                                            <div className="flex items-center gap-2 pt-1">
                                                {adSlides.slice(0, 6).map((_, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        aria-label={`Go to search ad ${index + 1}`}
                                                        className={`rounded-full transition-all duration-300 ${
                                                            index === activeSlideIndex
                                                                ? 'w-7 h-2.5 bg-white shadow-lg'
                                                                : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/70'
                                                        }`}
                                                        onClick={() => setActiveSlideIndex(index)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Post Room Card (moved below search card) */}
                    <Card className="mt-[10px] md:mt-5 relative border border-emerald-200/45 ring-1 ring-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-emerald-950/70 backdrop-blur-xl rounded-2xl overflow-hidden transition-all duration-500 shadow-[0_16px_40px_rgba(2,6,23,0.45)] hover:shadow-[0_20px_48px_rgba(16,185,129,0.30)]">
                        {currentPostRoomAd && currentPostRoomAd.imageUrl && (
                            <div className="absolute inset-0 w-full h-full">
                                <img
                                    src={currentPostRoomAd.imageUrl}
                                    alt={currentPostRoomAd.adTitle}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/85 to-emerald-950/80" />
                            </div>
                        )}

                        <CardContent className="relative z-10 p-4 sm:p-5 space-y-4">
                            <Badge className="px-4 py-2 bg-emerald-500/85 backdrop-blur-sm border-white/25 text-white font-semibold">
                                <Home className="w-4 h-4 mr-2" />
                                For Property Owners
                            </Badge>

                            <h3 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 bg-clip-text text-transparent leading-tight">
                                List Your Room
                            </h3>
                            <p className="text-white/90 text-sm md:text-base leading-relaxed font-medium">
                                Share your property with verified renters and get quality leads fast.
                            </p>

                            <Button
                                onClick={() => navigate('/rooms/add')}
                                className="w-full md:w-auto h-12 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-white font-bold text-base rounded-2xl shadow-[0_12px_30px_rgba(20,184,166,0.45)] hover:shadow-[0_16px_36px_rgba(34,211,238,0.5)] transition-all duration-300"
                            >
                                <Home className="w-5 h-5 mr-2" />
                                Post Your Room Now
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Stats Grid */}
                    <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-[8px] md:gap-6">
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center shadow-xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5" />
                            <Home className="w-8 h-8 mx-auto mb-3 text-yellow-300" />
                            <div className="text-4xl font-extrabold mb-2">{animatedTotalRooms.toLocaleString('en-IN')}+</div>
                            <div className="text-sm text-white/90 font-medium">Verified Rooms</div>
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center shadow-xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5" />
                            <Users className="w-8 h-8 mx-auto mb-3 text-green-300" />
                            <div className="text-4xl font-extrabold mb-2">{animatedTotalMembers.toLocaleString('en-IN')}+</div>
                            <div className="text-sm text-white/90 font-medium">Happy Members</div>
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center shadow-xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5" />
                            <MessageCircle className="w-8 h-8 mx-auto mb-3 text-green-300" />
                            <div className="text-4xl font-extrabold mb-2">{animatedTotalChats.toLocaleString('en-IN')}+</div>
                            <div className="text-sm text-white/90 font-medium">Active Chats</div>
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center shadow-xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5" />
                            <MapPin className="w-8 h-8 mx-auto mb-3 text-pink-300" />
                            <div className="text-4xl font-extrabold mb-2">{animatedCoveredCities}+</div>
                            <div className="text-sm text-white/90 font-medium">Cities Covered</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Rooms Section */}
            <section className="pt-[20px] pb-[20px] bg-white relative deferred-render-section md:pt-[30px] md:pb-[30px]">
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-green-primary to-transparent opacity-5" />
                
                <div className="max-w-screen-2xl mx-auto px-[10px] sm:px-5 lg:px-6 relative z-10">
                    <div className="flex flex-wrap items-end justify-between gap-[10px] mb-[10px] md:gap-[30px] md:mb-[30px]">
                        <div className="space-y-3">
                            <Badge className="px-3 py-1.5 bg-green-50 text-green-primary border-green-200 font-semibold">
                                <Star className="w-3.5 h-3.5 mr-1.5 inline fill-current" />
                                Featured
                            </Badge>
                            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900">
                                Premium Listings
                            </h2>
                            <p className="text-lg text-slate-600 max-w-xl">
                                Handpicked verified rooms perfect for your needs
                            </p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="lg"
                            onClick={() => navigate('/rooms')} 
                            className="gap-2 rounded-full px-6 border-2 hover:bg-slate-900 hover:text-white transition-all shadow-md hover:shadow-xl"
                        >
                            View All Rooms
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>

                    {isRoomsLoading ? (
                        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 lg:grid-cols-4">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden animate-pulse">
                                    <div className="h-44 bg-slate-200" />
                                    <div className="p-4 space-y-3">
                                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                                        <div className="h-5 bg-slate-200 rounded w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : featuredRooms.length > 0 ? (
                        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 lg:grid-cols-4">
                            {featuredRooms.slice(0, 6).map((room) => (
                                <RoomCard 
                                    key={room.room_id} 
                                    room={room}
                                    onChat={handleChatClick}
                                    showViews={false}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card className="border-2 border-dashed bg-slate-50">
                            <CardContent className="p-16 text-center">
                                <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Building2 className="w-10 h-10 text-slate-400" />
                                </div>
                                <p className="text-slate-500 font-medium">No featured rooms available at the moment</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </section>

            {/* Recently Added Section */}
            <section className="pt-[20px] pb-[20px] bg-gradient-to-b from-slate-50 to-white relative overflow-hidden deferred-render-section md:pt-[30px] md:pb-[30px]">
                {/* Decorative Elements */}
                <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
                
                <div className="max-w-screen-2xl mx-auto px-[10px] sm:px-5 lg:px-6 relative z-10">
                    <div className="flex flex-wrap items-end justify-between gap-[10px] mb-[10px] md:gap-[30px] md:mb-[30px]">
                        <div className="space-y-3">
                            <Badge className="px-3 py-1.5 bg-green-100 text-green-700 border-green-200 font-semibold">
                                <Clock className="w-3.5 h-3.5 mr-1.5 inline" />
                                Fresh Listings
                            </Badge>
                            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900">
                                Recently Added
                            </h2>
                            <p className="text-lg text-slate-600 max-w-xl">
                                Latest properties in your area
                            </p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="lg"
                            onClick={() => navigate('/rooms')} 
                            className="gap-2 rounded-full px-6 border-2 hover:bg-slate-900 hover:text-white transition-all shadow-md hover:shadow-xl"
                        >
                            Explore More
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>

                    {isRoomsLoading ? (
                        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 lg:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden animate-pulse">
                                    <div className="h-44 bg-slate-200" />
                                    <div className="p-4 space-y-3">
                                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                                        <div className="h-5 bg-slate-200 rounded w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : recentRooms.length > 0 ? (
                        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 lg:grid-cols-4">
                            {recentRooms.slice(0, 8).map((room) => (
                                <RoomCard 
                                    key={room.room_id} 
                                    room={room}
                                    onChat={handleChatClick}
                                    showViews={false}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card className="border-2 border-dashed bg-white">
                            <CardContent className="p-16 text-center">
                                <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Building2 className="w-10 h-10 text-slate-400" />
                                </div>
                                <p className="text-slate-500 font-medium">No recent listings available</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </section>

            {/* Trust Verification Section */}
            <section className="py-[20px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden deferred-render-section md:py-[30px]">
                <div className="absolute inset-0">
                    <div className="absolute top-10 right-10 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
                </div>

                <div className="max-w-screen-2xl mx-auto px-[10px] sm:px-5 lg:px-6 relative z-10">
                    <div className="text-center mb-[10px] max-w-3xl mx-auto md:mb-[30px]">
                        <Badge className="px-4 py-2 mb-6 bg-white/10 backdrop-blur-sm border-white/20 text-white font-semibold">
                            <Shield className="w-4 h-4 mr-2 inline" />
                            Verified Before Approval
                        </Badge>

                        <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
                            Built on Trust, Not Just{' '}
                            <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                                Listings
                            </span>
                        </h2>

                        <p className="text-xl text-white/80 leading-relaxed">
                            Every property goes through a strict verification process before it reaches you.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-[4px] md:gap-6">
                        <Card className="group relative overflow-hidden border border-white/15 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CardContent className="p-8 relative z-10">
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-xl">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Image Reality Check</h3>
                                <p className="text-white/75 text-sm leading-relaxed mb-4">
                                    Every uploaded image is reviewed to ensure clarity, authenticity, and relevance.
                                </p>
                                <p className="text-xs font-semibold text-blue-100 bg-blue-500/20 border border-blue-300/30 rounded-lg px-3 py-2 inline-block">
                                    Clear and authentic visuals
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="group relative overflow-hidden border border-white/15 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CardContent className="p-8 relative z-10">
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center shadow-xl">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">2</span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Detail Accuracy Review</h3>
                                <p className="text-white/75 text-sm leading-relaxed mb-4">
                                    We verify rent, deposit, and location details to ensure accuracy and consistency.
                                </p>
                                <p className="text-xs font-semibold text-orange-100 bg-orange-500/20 border border-orange-300/30 rounded-lg px-3 py-2 inline-block">
                                    Accurate listing data
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="group relative overflow-hidden border border-white/15 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CardContent className="p-8 relative z-10">
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-xl">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Approval and Publish</h3>
                                <p className="text-white/75 text-sm leading-relaxed mb-4">
                                    Only verified listings go live, ensuring a safe and trusted experience.
                                </p>
                                <p className="text-xs font-semibold text-emerald-100 bg-emerald-500/20 border border-emerald-300/30 rounded-lg px-3 py-2 inline-block">
                                    Trusted and live listings
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-[20px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden deferred-render-section md:py-[30px]">
                {/* Animated Background Elements */}
                <div className="absolute inset-0">
                    <div className="absolute top-10 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
                </div>

                <div className="max-w-screen-2xl mx-auto px-[10px] sm:px-5 lg:px-6 relative z-10">
                    <div className="text-center mb-[10px] max-w-3xl mx-auto md:mb-[30px]">
                        <Badge className="px-4 py-2 mb-6 bg-white/10 backdrop-blur-sm border-white/20 text-white font-semibold">
                            <Shield className="w-4 h-4 mr-2 inline" />
                            Why Choose Us
                        </Badge>
                        <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
                            Everything You Need in{' '}
                            <span className="bg-gradient-to-r from-green-300 to-green-accent bg-clip-text text-transparent">
                                One Platform
                            </span>
                        </h2>
                        <p className="text-xl text-white/80 leading-relaxed">
                            Complete solution for all your room rental and roommate finding needs
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[4px] md:gap-6">
                        {features.map((feature, index) => (
                            <Card 
                                key={index} 
                                className="group relative overflow-hidden border-0 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <CardContent className="p-8 text-center relative z-10">
                                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 transition-transform duration-300">
                                        <feature.icon className="w-10 h-10 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                                    <p className="text-white/70 leading-relaxed">{feature.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            {/* CTA Section */}
            <section className="py-[20px] bg-gradient-to-r from-green-primary via-green-secondary to-green-primary text-white relative overflow-hidden deferred-render-section md:py-[30px]">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse [animation-delay:1.5s]" />
                </div>

                <div className="max-w-screen-2xl mx-auto px-[10px] sm:px-5 lg:px-6 text-center relative z-10">
                    <div className="max-w-4xl mx-auto space-y-[10px] md:space-y-[30px]">
                        <Badge className="px-4 py-2 bg-white/20 backdrop-blur-sm border-white/30 text-white font-semibold text-base">
                            <Sparkles className="w-4 h-4 mr-2 inline" />
                            Get Started Today
                        </Badge>
                        
                        <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
                            Ready to Find Your
                            <span className="block mt-2 bg-gradient-to-r from-yellow-200 to-pink-200 bg-clip-text text-transparent">
                                Perfect Room?
                            </span>
                        </h2>
                        
                        <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                            Join thousands of happy members who found their ideal accommodation through our platform
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-5 justify-center pt-4">
                            <Button 
                                size="lg" 
                                onClick={() => navigate('/rooms')}
                                className="px-12 py-7 text-lg font-bold shadow-2xl hover:shadow-3xl hover:scale-110 transition-all bg-white text-primary hover:bg-white/95 rounded-2xl border-4 border-white"
                            >
                                <Search className="w-6 h-6 mr-2" />
                                Browse Rooms
                            </Button>
                            <Button 
                                size="lg" 
                                onClick={() => navigate('/rooms/add')}
                                className="px-12 py-7 text-lg font-bold border-4 border-white bg-white/20 backdrop-blur-sm text-white hover:bg-white hover:text-primary shadow-2xl hover:shadow-3xl hover:scale-110 transition-all rounded-2xl"
                            >
                                <Home className="w-6 h-6 mr-2" />
                                Post Your Room
                            </Button>
                        </div>

                        {/* Trust Indicators */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-[8px] pt-[10px] md:gap-6 md:pt-[30px] max-w-3xl mx-auto">
                            <div className="text-center">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-300" />
                                <p className="text-sm text-white/90 font-medium">100% Verified</p>
                            </div>
                            <div className="text-center">
                                <Shield className="w-8 h-8 mx-auto mb-2 text-green-300" />
                                <p className="text-sm text-white/90 font-medium">Secure Platform</p>
                            </div>
                            <div className="text-center">
                                <Users className="w-8 h-8 mx-auto mb-2 text-green-300" />
                                <p className="text-sm text-white/90 font-medium">Active Community</p>
                            </div>
                            <div className="text-center">
                                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-yellow-300" />
                                <p className="text-sm text-white/90 font-medium">24/7 Support</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
