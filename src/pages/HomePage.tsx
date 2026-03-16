import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Building2,
    MapPin,
    Search,
    ArrowRight,
    Wallet,
    CheckCircle,
    MessageCircle,
    Home,
    ChevronLeft,
    ChevronRight,
    Users,
    TrendingUp,
    Shield,
    Sparkles,
    Clock,
    Star,
    SlidersHorizontal,
    X,
    DollarSign,
    BedDouble,
    Sofa,
    UserCheck
} from 'lucide-react';
import type { Room } from '@/types';
import { getRooms, getActiveAds, getRoomById, type PublicAd } from '@/services/roomService';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import RoomCard from '@/components/rooms/RoomCard';
// Removed default ad card image logic

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

// Maharashtra Districts
const MAHARASHTRA_DISTRICTS = [
    'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara',
    'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli',
    'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban',
    'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad', 'Palghar',
    'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara',
    'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'
];

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { openChat } = useChat();
    const { isAuthenticated } = useAuth();
    const [featuredRooms, setFeaturedRooms] = useState<Room[]>([]);
    const [recentRooms, setRecentRooms] = useState<Room[]>([]);
    const [stats, setStats] = useState<HomeStats>({
        total_rooms: 0,
        total_members: 0,
        total_roommates: 0
    });
    const [activeAds, setActiveAds] = useState<PublicAd[]>([]);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [searchCity, setSearchCity] = useState('Pune');
    const [searchType, setSearchType] = useState('all');
    const [searchDetails, setSearchDetails] = useState('');
    const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [minRent, setMinRent] = useState('');
    const [maxRent, setMaxRent] = useState('');
    const [roomType, setRoomType] = useState('all');
    const [furnishingType, setFurnishingType] = useState('all');
    const [gender, setGender] = useState('all');
    const deferredSearchDetails = useDeferredValue(searchDetails);
    const searchCardRef = useRef<HTMLDivElement | null>(null);

    const searchControlHeightClass = 'h-14 min-h-[56px] max-h-[56px]';

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
                writeCachedHomeData({
                    featuredRooms: nextFeaturedRooms,
                    recentRooms: nextRecentRooms,
                    activeAds: adsData || [],
                });

                // Mock stats - in production these should come from API
                setStats({
                    total_rooms: Math.floor(Math.random() * 2000) + 1000,
                    total_members: Math.floor(Math.random() * 10000) + 5000,
                    total_roommates: Math.floor(Math.random() * 500) + 200
                });
            } catch (error) {
            }
        };

        void fetchData();
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            searchCardRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    const handleSearch = () => {
        const params = new URLSearchParams();

        const trimmedSearch = searchDetails.trim();
        const searchParts = trimmedSearch
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);

        const areaLikeSearch = searchParts.length >= 2 ? searchParts[0] : trimmedSearch;
        const typedCityCandidate = searchParts.length >= 2 ? searchParts[searchParts.length - 1] : '';

        const matchedCity = MAHARASHTRA_DISTRICTS.find((district) => {
            const districtName = district.toLowerCase();
            return (
                districtName === trimmedSearch.toLowerCase() ||
                (typedCityCandidate && districtName === typedCityCandidate.toLowerCase())
            );
        });

        const effectiveCity =
            (searchCity && searchCity !== 'all' ? searchCity : '') || matchedCity || '';

        if (effectiveCity) params.append('city', effectiveCity);
        if (searchType && searchType !== 'all') params.append('listingType', searchType);
        if (areaLikeSearch) params.append('search', areaLikeSearch);
        if (minRent) params.append('minRent', minRent);
        if (maxRent) params.append('maxRent', maxRent);
        if (roomType && roomType !== 'all') params.append('roomType', roomType);
        if (furnishingType && furnishingType !== 'all') params.append('furnishingType', furnishingType);
        if (gender && gender !== 'all') params.append('gender', gender);
        navigate(`/rooms?${params}`);
    };

    const clearAdvancedFilters = () => {
        setMinRent('');
        setMaxRent('');
        setRoomType('all');
        setFurnishingType('all');
        setGender('all');
    };

    const hasActiveAdvancedFilters = minRent || maxRent || (roomType !== 'all') || (furnishingType !== 'all') || (gender !== 'all');

    const locationSuggestions = useMemo(() => {
        const keyword = deferredSearchDetails.trim().toLowerCase();
        if (!keyword) {
            return [];
        }

        const uniqueLocations = new Map<string, { label: string; city: string; subtitle: string }>();

        [...featuredRooms, ...recentRooms].forEach((room) => {
            const area = room.area?.trim();
            const city = room.city?.trim();
            const addressStart = room.address?.split(',')?.[0]?.trim();

            if (area && city) {
                const key = `${area.toLowerCase()}|${city.toLowerCase()}`;
                if (!uniqueLocations.has(key)) {
                    uniqueLocations.set(key, {
                        label: area,
                        city,
                        subtitle: `${city} • Area`
                    });
                }
            }

            if (addressStart && city) {
                const key = `${addressStart.toLowerCase()}|${city.toLowerCase()}`;
                if (!uniqueLocations.has(key)) {
                    uniqueLocations.set(key, {
                        label: addressStart,
                        city,
                        subtitle: `${city} • Landmark`
                    });
                }
            }
        });

        MAHARASHTRA_DISTRICTS.forEach((district) => {
            const key = `district|${district.toLowerCase()}`;
            if (!uniqueLocations.has(key)) {
                uniqueLocations.set(key, {
                    label: district,
                    city: district,
                    subtitle: 'District'
                });
            }
        });

        return Array.from(uniqueLocations.values())
            .filter((location) =>
                `${location.label} ${location.city} ${location.subtitle}`.toLowerCase().includes(keyword)
            )
            .slice(0, 8);
    }, [deferredSearchDetails, featuredRooms, recentRooms]);

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

    const adSlides = useMemo(() => {
        // Filter ads for search bar placement (MP_Search)
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

    const currentSlide = adSlides[activeSlideIndex] || null;
    const currentPostRoomAd = postRoomAdSlides[postRoomAdIndex] || null;

    const goToPreviousSlide = () => {
        if (adSlides.length === 0) return;
        setActiveSlideIndex((prev) => (prev - 1 + adSlides.length) % adSlides.length);
    };

    const goToNextSlide = () => {
        if (adSlides.length === 0) return;
        setActiveSlideIndex((prev) => (prev + 1) % adSlides.length);
    };

    const handleChatClick = async (roomId: string) => {
        try {
            if (!isAuthenticated) {
                navigate('/login');
                return;
            }

            // Find the room from either featured or recent rooms
            let room = [...featuredRooms, ...recentRooms].find(r => r.room_id === roomId);
            
            if (!room) {
                return;
            }

            // If room.id is missing, fetch full room details
            if (!room.id) {
                try {
                    room = await getRoomById(room.room_id);
                } catch (error) {
                    return;
                }
            }

            if (!room.id || !room.user_id) {
                return;
            }
            
            await openChat(room.id, room.user_id, room);
        } catch (error) {
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-bg via-white to-green-bg">
            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-green-primary via-green-secondary to-green-primary text-white pt-10 pb-[50px] lg:pt-10 lg:pb-[50px]">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse [animation-delay:1s]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-white/5 blur-3xl" />
                </div>

                <div className="max-w-screen-2xl mx-auto px-[20px] relative z-10 space-y-8">
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
                                    Discover thousands of verified rooms, find compatible roommates,
                                    and manage expenses—all in one platform.
                                </p>
                            </div>

                            {/* Features Grid Below Text */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                                {[
                                    {
                                        icon: CheckCircle,
                                        title: 'Instant Verification',
                                        desc: 'Get verified in minutes',
                                        color: 'from-emerald-500/40 via-green-500/25 to-lime-400/10',
                                        border: 'border-emerald-400/70',
                                        iconBg: 'bg-emerald-400/30',
                                        iconColor: 'text-emerald-200',
                                        delayClass: '[animation-delay:100ms]',
                                        gradient: 'from-emerald-400 via-green-400 to-lime-300',
                                        glow: 'group-hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]'
                                    },
                                    {
                                        icon: MessageCircle,
                                        title: 'Direct Communication',
                                        desc: 'Built-in chat system',
                                        color: 'from-blue-500/40 via-sky-500/25 to-indigo-400/10',
                                        border: 'border-blue-400/70',
                                        iconBg: 'bg-blue-400/30',
                                        iconColor: 'text-blue-200',
                                        delayClass: '[animation-delay:200ms]',
                                        gradient: 'from-blue-400 via-sky-400 to-indigo-300',
                                        glow: 'group-hover:shadow-[0_0_24px_rgba(59,130,246,0.35)]'
                                    },
                                    {
                                        icon: TrendingUp,
                                        title: 'Increased Visibility',
                                        desc: 'Featured in search results',
                                        color: 'from-cyan-500/40 via-teal-500/25 to-sky-400/10',
                                        border: 'border-cyan-400/70',
                                        iconBg: 'bg-cyan-400/30',
                                        iconColor: 'text-cyan-200',
                                        delayClass: '[animation-delay:300ms]',
                                        gradient: 'from-cyan-400 via-teal-400 to-sky-300',
                                        glow: 'group-hover:shadow-[0_0_24px_rgba(34,211,238,0.35)]'
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
                                        <div className="relative z-10 p-4 space-y-3 h-full flex flex-col">
                                            {/* Icon Container */}
                                            <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${item.iconBg} transition-transform duration-300 backdrop-blur-sm border border-white/20 group-hover:scale-105`}>
                                                <item.icon className={`w-5 h-5 md:w-5 md:h-5 ${item.iconColor}`} />
                                            </div>

                                            {/* Title and Description */}
                                            <div className="flex-1 space-y-1.5">
                                                <h3 className="text-sm md:text-base font-semibold text-white leading-tight">
                                                    {item.title}
                                                </h3>
                                                <p className="text-white/75 text-xs md:text-sm leading-relaxed font-medium">
                                                    {item.desc}
                                                </p>
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column - Post Room Feature Card */}
                        <div className="lg:mt-0 group">
                            <Card className="relative border border-emerald-300/35 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-emerald-950/70 backdrop-blur-xl rounded-3xl overflow-hidden transition-all duration-500 shadow-[0_24px_60px_rgba(2,6,23,0.55)] hover:shadow-[0_24px_70px_rgba(16,185,129,0.35)] animate-in fade-in slide-in-from-right-8 duration-700 h-full border-image-[linear-gradient(140deg,rgba(52,211,153,0.7)_0%,rgba(45,212,191,0.7)_45%,rgba(34,211,238,0.7)_100%)_1]">
                                
                                {/* MP_Post1 Ad Background (if exists) */}
                                {currentPostRoomAd && currentPostRoomAd.imageUrl && (
                                    <div className="absolute inset-0 w-full h-full">
                                        <img
                                            src={currentPostRoomAd.imageUrl}
                                            alt={currentPostRoomAd.adTitle}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/85 to-emerald-950/80" />
                                    </div>
                                )}
                                
                                {/* Animated gradient background */}
                                <div className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 blur-3xl"></div>
                                </div>
                                
                                {/* Overlay gradient */}
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.20),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.14),transparent_40%)] pointer-events-none"></div>
                                
                                <CardContent className="pt-2.5 pb-5 px-6 md:px-8 space-y-6 relative z-10">
                                    {/* Header Section with Ad Info Card in Top Right */}
                                    <div className="flex flex-col lg:flex-row justify-between items-start w-full gap-4 relative">
                                        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-emerald-500/85 via-teal-500/85 to-cyan-500/85 backdrop-blur-sm shadow-lg transition-all duration-300 border border-white/25">
                                            <Home className="w-5 h-5 text-white animate-bounce [animation-delay:200ms]" />
                                            <span className="text-sm font-bold text-white">For Property Owners</span>
                                        </div>
                                        {/* Ad Info Card in Top Right - Only show for non-default ads */}
                                        {currentPostRoomAd && currentPostRoomAd.adTitle && currentPostRoomAd.adTitle.trim() !== '' && (
                                            <div className="hidden lg:block absolute right-0 -top-2.5 ml-[30px] z-20">
                                                <div className="bg-transparent border border-emerald-400 rounded-lg shadow-md px-3 py-2 min-w-[210px] max-w-[290px] break-words">
                                                    <h4 className="text-white font-semibold text-sm mb-1 w-full truncate drop-shadow tracking-[0.01em]" title={currentPostRoomAd.adTitle}>{currentPostRoomAd.adTitle}</h4>
                                                    {currentPostRoomAd.adDescription && (
                                                        <p className="text-emerald-100 text-xs leading-snug w-full whitespace-pre-line break-words drop-shadow-sm font-medium" title={currentPostRoomAd.adDescription}>{currentPostRoomAd.adDescription}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* Mobile Ad Info Card - Show on mobile below the header */}
                                    {currentPostRoomAd && currentPostRoomAd.adTitle && currentPostRoomAd.adTitle.trim() !== '' && (
                                        <div className="lg:hidden bg-transparent border border-emerald-400 rounded-lg shadow-md px-3 py-2 break-words">
                                            <h4 className="text-white font-semibold text-sm mb-1 w-full drop-shadow tracking-[0.01em]">{currentPostRoomAd.adTitle}</h4>
                                            {currentPostRoomAd.adDescription && (
                                                <p className="text-emerald-100 text-xs leading-snug w-full whitespace-pre-line break-words drop-shadow-sm font-medium">{currentPostRoomAd.adDescription}</p>
                                            )}
                                        </div>
                                    )}
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700 [animation-delay:100ms]">
                                        <h2 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 bg-clip-text text-transparent leading-tight">
                                            List Your Room
                                        </h2>
                                        <p className="text-white/90 text-base md:text-lg leading-relaxed font-medium">
                                            Share your property with thousands of verified renters and find the perfect tenants
                                        </p>
                                    </div>

                                    {/* Features Grid with Animations */}
                                    <div className="hidden"></div>

                                    {/* CTA Button with Enhanced Animations */}
                                    <Button
                                        onClick={() => navigate('/rooms/add')}
                                        className="w-full h-12 md:h-13 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-white font-bold text-base rounded-2xl shadow-[0_12px_30px_rgba(20,184,166,0.45)] hover:shadow-[0_16px_36px_rgba(34,211,238,0.5)] transition-all duration-300 group/btn hover:scale-[1.03] active:scale-95 border border-white/35 hover:border-white/60 relative overflow-hidden"
                                    >
                                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></span>
                                        <div className="flex items-center justify-center gap-2 relative z-10">
                                            <Home className="w-5 h-5 transition-all duration-300 group-hover/btn:scale-125 group-hover/btn:rotate-12" />
                                            <span className="hidden xs:inline">Post Your Room Now</span>
                                            <span className="inline xs:hidden">Post Room</span>
                                            <ArrowRight className="w-4 h-4 transition-all duration-300 group-hover/btn:translate-x-2 group-hover/btn:scale-125" />
                                        </div>
                                    </Button>

                                    {/* Footer Text */}
                                    <div className="text-center space-y-2 animate-in fade-in duration-700 [animation-delay:500ms]">
                                        <p className="text-white/80 text-xs md:text-sm font-medium">
                                            ✨ Free listing • Quick setup • Premium features available
                                        </p>
                                        <div className="flex items-center justify-center gap-1 text-white/60 text-xs">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></div>
                                            <span>Join 5000+ Active Property Owners</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse [animation-delay:300ms]"></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* Integrated Search Card with Ad Background */}
                    <Card ref={searchCardRef} className="shadow-2xl border border-white/10 overflow-hidden rounded-3xl relative group -mt-6 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
                        {/* Always-on themed fallback background */}
                        <div className="absolute inset-0 w-full h-full pointer-events-none">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.16),transparent_40%),linear-gradient(125deg,rgba(2,6,23,0.95),rgba(30,41,59,0.9),rgba(15,23,42,0.95))]" />
                        </div>

                        {/* Ad Background Image */}
                        {currentSlide && currentSlide.imageUrl && (
                            <div className="absolute inset-0 w-full h-full">
                                <img
                                    src={currentSlide.imageUrl}
                                    alt={currentSlide.adTitle}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/40" />
                            </div>
                        )}

                        <CardContent className="p-0 relative z-10">
                            <div className="px-6 md:px-9 pt-0 md:pt-0 pb-[25px]">
                                {/* Ad Badge and Title Section */}
                                {currentSlide && (
                                    <div className="mb-8 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-3 flex-1 pr-4">
                                                <h3 className="text-3xl md:text-4xl font-extrabold text-white leading-tight drop-shadow-lg">
                                                    {currentSlide.adTitle}
                                                </h3>
                                                {currentSlide.adDescription && (
                                                    <p className="text-lg text-white/90 leading-relaxed font-medium drop-shadow-md max-w-2xl">
                                                        {currentSlide.adDescription}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Carousel Controls */}
                                            {adSlides.length > 1 && (
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg hover:scale-110 transition-all border border-white/30"
                                                        onClick={goToPreviousSlide}
                                                        aria-label="Previous slide"
                                                    >
                                                        <ChevronLeft className="h-5 w-5 text-white" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="h-10 w-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center shadow-lg hover:scale-110 transition-all border border-white/30"
                                                        onClick={goToNextSlide}
                                                        aria-label="Next slide"
                                                    >
                                                        <ChevronRight className="h-5 w-5 text-white" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Carousel Dots */}
                                        {adSlides.length > 1 && (
                                            <div className="flex items-center gap-2">
                                                {adSlides.slice(0, 8).map((_, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        aria-label={`Go to slide ${index + 1}`}
                                                        className={`rounded-full transition-all duration-300 ${
                                                            index === activeSlideIndex 
                                                                ? 'w-8 h-2.5 bg-white shadow-lg' 
                                                                : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/70'
                                                        }`}
                                                        onClick={() => setActiveSlideIndex(index)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Search Filters */}
                                <div className="grid gap-[15px] sm:grid-cols-2 lg:[grid-template-columns:minmax(0,calc(40%-15px))_minmax(0,15%)_minmax(0,15%)_minmax(0,15%)_minmax(0,calc(15%+15px))] lg:items-end">
                                    <div className="lg:col-[1] min-w-0 relative group">
                                        <label className="block text-sm font-bold text-white mb-2 ml-2 drop-shadow-sm">🔎 Search Details</label>
                                        <div className="absolute left-4 top-11 w-5 h-5 text-primary z-[11] pointer-events-none flex items-center justify-center">
                                            <Search className="w-5 h-5" />
                                        </div>
                                        <Input
                                            value={searchDetails}
                                            onChange={(event) => setSearchDetails(event.target.value)}
                                            onFocus={() => setShowLocationSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 150)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    handleSearch();
                                                }
                                            }}
                                            placeholder="Area, landmark, budget, amenities..."
                                            className={`pl-12 pr-4 min-w-0 ${searchControlHeightClass} text-base font-semibold border-2 border-white/30 hover:border-white/60 focus:ring-2 focus:ring-white/30 focus:border-white/60 bg-white/95 backdrop-blur rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-slate-900 placeholder:text-slate-500`}
                                        />

                                        {showLocationSuggestions && searchDetails.trim() && (
                                            <div className="absolute top-full mt-2 w-full rounded-2xl border border-white/30 bg-white/95 backdrop-blur shadow-2xl overflow-hidden z-30">
                                                {locationSuggestions.length > 0 ? (
                                                    locationSuggestions.map((location, index) => (
                                                        <button
                                                            key={`${location.label}-${location.city}-${index}`}
                                                            type="button"
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-100/80 border-b border-slate-100 last:border-b-0 transition-colors"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => {
                                                                setSearchDetails(location.label);
                                                                setSearchCity(location.city);
                                                                setShowLocationSuggestions(false);
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <MapPin className="w-4 h-4 text-primary shrink-0" />
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900">{location.label}</p>
                                                                    <p className="text-xs text-slate-500">{location.subtitle}</p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <>
                                                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                                                            <p className="text-sm font-semibold text-slate-800">No exact location found</p>
                                                            <p className="text-xs text-slate-500">Use this as area or city search</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-100/80 border-b border-slate-100 transition-colors"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => {
                                                                setShowLocationSuggestions(false);
                                                                handleSearch();
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <MapPin className="w-4 h-4 text-primary shrink-0" />
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900">Search area: {searchDetails.trim()}</p>
                                                                    <p className="text-xs text-slate-500">Area / landmark</p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-100/80 transition-colors"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => {
                                                                const typedValue = searchDetails.trim();
                                                                setSearchCity(typedValue);
                                                                setShowLocationSuggestions(false);
                                                                handleSearch();
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <MapPin className="w-4 h-4 text-primary shrink-0" />
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900">Search city: {searchDetails.trim()}</p>
                                                                    <p className="text-xs text-slate-500">City based results</p>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="lg:col-[2] min-w-0 relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary z-[11] pointer-events-none flex items-center justify-center">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <Select value={searchCity} onValueChange={setSearchCity}>
                                            <SelectTrigger className={`!w-full pl-12 pr-4 min-w-0 max-w-full [&>span]:truncate ${searchControlHeightClass} text-base font-semibold border-2 border-white/30 hover:border-cyan-300 focus:ring-2 focus:ring-cyan-200 focus:border-cyan-300 bg-gradient-to-r from-white/95 to-cyan-50/90 backdrop-blur rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 relative z-10`}>
                                                <SelectValue placeholder="Choose district" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-2 border-cyan-100 shadow-2xl">
                                                <SelectItem value="all" className="text-base py-3 font-semibold">🌍 All city</SelectItem>
                                                {MAHARASHTRA_DISTRICTS.map((district) => (
                                                    <SelectItem key={district} value={district} className="text-base py-3 font-medium">
                                                        {district}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="lg:col-[3] min-w-0 relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary z-[11] pointer-events-none flex items-center justify-center">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <Select value={searchType} onValueChange={setSearchType}>
                                            <SelectTrigger className={`!w-full pl-12 pr-4 min-w-0 max-w-full [&>span]:truncate ${searchControlHeightClass} text-base font-semibold border-2 border-white/30 hover:border-violet-300 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 bg-gradient-to-r from-white/95 to-violet-50/90 backdrop-blur rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 relative z-10`}>
                                                <SelectValue placeholder="Choose type" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-2 border-violet-100 shadow-2xl">
                                                <SelectItem value="all" className="text-base py-3 font-semibold">📦 All Types</SelectItem>
                                                <SelectItem value="For Rent" className="text-base py-3 font-medium">🏡 For Rent</SelectItem>
                                                <SelectItem value="Required Roommate" className="text-base py-3 font-medium">👥 Required Roommate</SelectItem>
                                                <SelectItem value="For Sell" className="text-base py-3 font-medium">💰 For Sale</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="lg:col-[4] min-w-0 space-y-2">
                                        <label className="block text-sm font-bold text-transparent mb-2 ml-2 select-none">Filters</label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                            className={`w-full ${searchControlHeightClass} text-white hover:text-white hover:bg-white/20 backdrop-blur font-semibold border border-white/30 rounded-2xl`}
                                        >
                                            <SlidersHorizontal className="w-5 h-5 mr-2" />
                                            Filters
                                            {hasActiveAdvancedFilters && (
                                                <Badge className="ml-2 bg-yellow-500 text-black hover:bg-yellow-400">
                                                    {[minRent && 'Price', roomType !== 'all' && 'Type', furnishingType !== 'all' && 'Furnishing', gender !== 'all' && 'Gender'].filter(Boolean).length}
                                                </Badge>
                                            )}
                                        </Button>
                                    </div>

                                    <div className="lg:col-[5] min-w-0 space-y-2">
                                        <label className="block text-sm font-bold text-transparent mb-2 ml-2 select-none">Search</label>
                                        <Button
                                            size="lg"
                                            onClick={handleSearch}
                                            className={`group w-full ${searchControlHeightClass} px-5 text-base font-bold shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-400 hover:scale-105 active:scale-95 text-white border border-white/30`}
                                        >
                                            <Search className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:scale-110" />
                                            Search
                                            <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                                        </Button>
                                    </div>

                                    <div className="lg:col-[1/-1]">
                                        {hasActiveAdvancedFilters && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={clearAdvancedFilters}
                                                className="w-full sm:w-auto text-white/80 hover:text-white hover:bg-white/20 backdrop-blur text-sm"
                                            >
                                                <X className="w-4 h-4 mr-1" />
                                                Clear Filters
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Advanced Filters Panel */}
                                {showAdvancedFilters && (
                                    <div className="mt-4 p-6 rounded-2xl bg-white/95 backdrop-blur shadow-2xl border-2 border-white/40 animate-in slide-in-from-top-4 duration-300">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <SlidersHorizontal className="w-5 h-5 text-primary" />
                                            Refine Your Search
                                        </h3>
                                        
                                        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                                            {/* Price Range */}
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                                    <DollarSign className="w-4 h-4 text-green-600" />
                                                    Price Range
                                                </label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="number"
                                                        placeholder="Min ₹"
                                                        value={minRent}
                                                        onChange={(e) => setMinRent(e.target.value)}
                                                        className="h-11 border-2 focus:border-primary"
                                                    />
                                                    <Input
                                                        type="number"
                                                        placeholder="Max ₹"
                                                        value={maxRent}
                                                        onChange={(e) => setMaxRent(e.target.value)}
                                                        className="h-11 border-2 focus:border-primary"
                                                    />
                                                </div>
                                            </div>

                                            {/* Room Type */}
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                                    <BedDouble className="w-4 h-4 text-green-primary" />
                                                    Room Type
                                                </label>
                                                <Select value={roomType} onValueChange={setRoomType}>
                                                    <SelectTrigger className="h-11 border-2 focus:border-primary">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Types</SelectItem>
                                                        <SelectItem value="1RK">1RK</SelectItem>
                                                        <SelectItem value="1BHK">1BHK</SelectItem>
                                                        <SelectItem value="2BHK">2BHK</SelectItem>
                                                        <SelectItem value="3BHK">3BHK</SelectItem>
                                                        <SelectItem value="4BHK">4BHK</SelectItem>
                                                        <SelectItem value="PG">PG</SelectItem>
                                                        <SelectItem value="Studio">Studio</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Furnishing Type */}
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                                    <Sofa className="w-4 h-4 text-purple-600" />
                                                    Furnishing
                                                </label>
                                                <Select value={furnishingType} onValueChange={setFurnishingType}>
                                                    <SelectTrigger className="h-11 border-2 focus:border-primary">
                                                        <SelectValue placeholder="Select furnishing" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Types</SelectItem>
                                                        <SelectItem value="Furnished">Furnished</SelectItem>
                                                        <SelectItem value="Semi-furnished">Semi-furnished</SelectItem>
                                                        <SelectItem value="Unfurnished">Unfurnished</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Gender Preference */}
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                                    <UserCheck className="w-4 h-4 text-pink-600" />
                                                    Gender Preference
                                                </label>
                                                <Select value={gender} onValueChange={setGender}>
                                                    <SelectTrigger className="h-11 border-2 focus:border-primary">
                                                        <SelectValue placeholder="Select preference" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Any Gender</SelectItem>
                                                        <SelectItem value="Male">Male</SelectItem>
                                                        <SelectItem value="Female">Female</SelectItem>
                                                        <SelectItem value="Any">Any</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Active Filters Display */}
                                        {hasActiveAdvancedFilters && (
                                            <div className="mt-4 pt-4 border-t border-slate-200">
                                                <p className="text-xs font-semibold text-slate-600 mb-2">Active Filters:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {minRent && (
                                                        <Badge variant="secondary" className="gap-1">
                                                            Min: ₹{minRent}
                                                            <X className="w-3 h-3 cursor-pointer hover:text-red-600" onClick={() => setMinRent('')} />
                                                        </Badge>
                                                    )}
                                                    {maxRent && (
                                                        <Badge variant="secondary" className="gap-1">
                                                            Max: ₹{maxRent}
                                                            <X className="w-3 h-3 cursor-pointer hover:text-red-600" onClick={() => setMaxRent('')} />
                                                        </Badge>
                                                    )}
                                                    {roomType !== 'all' && (
                                                        <Badge variant="secondary" className="gap-1">
                                                            {roomType}
                                                            <X className="w-3 h-3 cursor-pointer hover:text-red-600" onClick={() => setRoomType('all')} />
                                                        </Badge>
                                                    )}
                                                    {furnishingType !== 'all' && (
                                                        <Badge variant="secondary" className="gap-1">
                                                            {furnishingType}
                                                            <X className="w-3 h-3 cursor-pointer hover:text-red-600" onClick={() => setFurnishingType('all')} />
                                                        </Badge>
                                                    )}
                                                    {gender !== 'all' && (
                                                        <Badge variant="secondary" className="gap-1">
                                                            {gender} preferred
                                                            <X className="w-3 h-3 cursor-pointer hover:text-red-600" onClick={() => setGender('all')} />
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Quick Tips */}
                                <div className="mt-7 pt-6 border-t border-white/20 flex flex-wrap gap-4">
                                    <span className="text-sm font-semibold text-white/90 flex items-center gap-2 drop-shadow-sm">
                                        <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                                        Filter by location
                                    </span>
                                    <span className="text-sm font-semibold text-white/90 flex items-center gap-2 drop-shadow-sm">
                                        <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                                        Choose property type
                                    </span>
                                    <span className="text-sm font-semibold text-white/90 flex items-center gap-2 drop-shadow-sm">
                                        <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                                        View verified listings
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center shadow-xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5" />
                            <Home className="w-8 h-8 mx-auto mb-3 text-yellow-300" />
                            <div className="text-4xl font-extrabold mb-2">{stats.total_rooms || 0}+</div>
                            <div className="text-sm text-white/90 font-medium">Verified Rooms</div>
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center shadow-xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5" />
                            <Users className="w-8 h-8 mx-auto mb-3 text-green-300" />
                            <div className="text-4xl font-extrabold mb-2">{stats.total_members || 0}+</div>
                            <div className="text-sm text-white/90 font-medium">Happy Members</div>
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center shadow-xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5" />
                            <MessageCircle className="w-8 h-8 mx-auto mb-3 text-green-300" />
                            <div className="text-4xl font-extrabold mb-2">{stats.total_roommates || 0}+</div>
                            <div className="text-sm text-white/90 font-medium">Active Chats</div>
                        </div>
                        <div className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-center shadow-xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5" />
                            <MapPin className="w-8 h-8 mx-auto mb-3 text-pink-300" />
                            <div className="text-4xl font-extrabold mb-2">15+</div>
                            <div className="text-sm text-white/90 font-medium">Cities Covered</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Rooms Section */}
            <section className="pt-[30px] pb-20 bg-white relative deferred-render-section">
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-green-primary to-transparent opacity-5" />
                
                <div className="max-w-screen-2xl mx-auto px-[20px] relative z-10">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
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

                    {featuredRooms.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
            <section className="pt-[20px] pb-20 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden deferred-render-section">
                {/* Decorative Elements */}
                <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
                
                <div className="max-w-screen-2xl mx-auto px-[20px] relative z-10">
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
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

                    {recentRooms.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

            {/* Features Section */}
            <section className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden deferred-render-section">
                {/* Animated Background Elements */}
                <div className="absolute inset-0">
                    <div className="absolute top-10 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
                </div>

                <div className="max-w-screen-2xl mx-auto px-[20px] relative z-10">
                    <div className="text-center mb-16 max-w-3xl mx-auto">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <section className="py-24 bg-gradient-to-r from-green-primary via-green-secondary to-green-primary text-white relative overflow-hidden deferred-render-section">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse [animation-delay:1.5s]" />
                </div>

                <div className="max-w-screen-2xl mx-auto px-[20px] text-center relative z-10">
                    <div className="max-w-4xl mx-auto space-y-8">
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12 max-w-3xl mx-auto">
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
