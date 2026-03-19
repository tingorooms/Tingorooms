import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2, MapPin, Search, SlidersHorizontal, X, ChevronDown, ChevronUp, DollarSign, UserCheck, Filter, Grid3x3, List, ArrowUpDown, Sparkles, TrendingUp } from 'lucide-react';
import type { Room, RoomFilters } from '@/types';
import { getRooms } from '@/services/roomService';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import RoomCard from '@/components/rooms/RoomCard';

// Maharashtra Districts List
const MAHARASHTRA_DISTRICTS = [
    'Mumbai City',
    'Mumbai Suburban',
    'Thane',
    'Pune',
    'Nashik',
    'Nagpur',
    'Ahmednagar',
    'Akola',
    'Amravati',
    'Aurangabad',
    'Beed',
    'Bhandara',
    'Buldhana',
    'Chandrapur',
    'Dhule',
    'Gadchiroli',
    'Gondia',
    'Hingoli',
    'Jalgaon',
    'Jalna',
    'Kolhapur',
    'Latur',
    'Nanded',
    'Nandurbar',
    'Osmanabad',
    'Palghar',
    'Parbhani',
    'Raigad',
    'Ratnagiri',
    'Sangli',
    'Satara',
    'Sindhudurg',
    'Solapur',
    'Wardha',
    'Washim',
    'Yavatmal'
];

const RoomsListPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<string>('newest');
    
    const [rooms, setRooms] = useState<Room[]>([]);
    const [similarRooms, setSimilarRooms] = useState<Room[]>([]);
    const [filters, setFilters] = useState<RoomFilters>({
        city: searchParams.get('city') || '',
        listingType: searchParams.get('listingType') || '',
        search: searchParams.get('search') || searchParams.get('q') || '',
        minRent: searchParams.get('minRent') ? parseFloat(searchParams.get('minRent')!) : undefined,
        maxRent: searchParams.get('maxRent') ? parseFloat(searchParams.get('maxRent')!) : undefined,
        roomType: searchParams.get('roomType') || undefined,
        furnishingType: searchParams.get('furnishingType') || undefined,
        gender: searchParams.get('gender') || undefined,
        userId: searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined
    });
    const [showMobileAdvancedFilters, setShowMobileAdvancedFilters] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        location: true,
        price: true,
        property: true,
        preferences: true
    });
    const { openChat } = useChat();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0
    });
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const searchInputContainerRef = useRef<HTMLDivElement | null>(null);
    const roomsSearchInputRef = useRef<HTMLInputElement | null>(null);
    const [locationDetected, setLocationDetected] = useState(false);
    const [debouncedFilters, setDebouncedFilters] = useState(filters);
    const roomsRequestCacheRef = useRef<Map<string, { createdAt: number; data: Room[]; pagination: typeof pagination }>>(new Map());
    const roomsRequestSequenceRef = useRef(0);
    const similarRoomsRequestSequenceRef = useRef(0);
    const CACHE_MAX_AGE_MS = 60_000;
    // true until first successful fetch completes — prevents false "no results" flash
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedFilters(filters);
        }, 180);

        return () => window.clearTimeout(timer);
    }, [filters]);

    useEffect(() => {
        const abortController = new AbortController();
        const requestId = ++roomsRequestSequenceRef.current;
        let isEffectActive = true;

        const fetchData = async () => {
            setIsFetching(true);
            try {
                // Convert 'all' values back to empty strings for API
                const apiFilters = { ...debouncedFilters };
                if (apiFilters.city === 'all') apiFilters.city = '';
                if (apiFilters.listingType === 'all') apiFilters.listingType = '';

                const cacheKey = JSON.stringify({
                    ...apiFilters,
                    page: pagination.currentPage,
                    limit: 12,
                });

                // Cache hit → instant display
                const cached = roomsRequestCacheRef.current.get(cacheKey);
                if (cached && Date.now() - cached.createdAt < CACHE_MAX_AGE_MS) {
                    if (!isEffectActive || requestId !== roomsRequestSequenceRef.current) {
                        return;
                    }
                    setRooms(cached.data);
                    setPagination(cached.pagination);
                    setIsFetching(false);
                    return;
                }

                // Wave 1 — fetch first 4 rooms to show something fast
                const wave1 = await getRooms(
                    { ...apiFilters, page: pagination.currentPage, limit: 4 },
                    { signal: abortController.signal }
                );

                if (!isEffectActive || requestId !== roomsRequestSequenceRef.current || abortController.signal.aborted) {
                    return;
                }

                // Show the first 4 rooms immediately — skeleton disappears
                setRooms(wave1.data);
                setIsFetching(false);

                // Wave 2 — fetch the full page in the background; new cards animate in
                const wave2 = await getRooms(
                    { ...apiFilters, page: pagination.currentPage, limit: 12 },
                    { signal: abortController.signal }
                );

                if (!isEffectActive || requestId !== roomsRequestSequenceRef.current || abortController.signal.aborted) {
                    return;
                }

                setRooms(wave2.data);
                setPagination(wave2.pagination);

                roomsRequestCacheRef.current.set(cacheKey, {
                    createdAt: Date.now(),
                    data: wave2.data,
                    pagination: wave2.pagination,
                });

                if (roomsRequestCacheRef.current.size > 24) {
                    const firstKey = roomsRequestCacheRef.current.keys().next().value;
                    if (firstKey) {
                        roomsRequestCacheRef.current.delete(firstKey);
                    }
                }
            } catch (error) {
                const err = error as { name?: string; code?: string };
                if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || abortController.signal.aborted) {
                    return;
                }
                setIsFetching(false);
            }
        };

        void fetchData();

        return () => {
            isEffectActive = false;
            abortController.abort();
        };
    }, [debouncedFilters, pagination.currentPage]);

    // Auto-detect user location and set district
    useEffect(() => {
        // Only auto-detect if:
        // 1. No district is already selected
        // 2. Location hasn't been detected yet
        // 3. No city param in URL
        if (!filters.city && !locationDetected && !searchParams.get('city')) {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        
                        try {
                            // Use OpenStreetMap Nominatim for reverse geocoding (free, no API key needed)
                            const response = await fetch(
                                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
                                {
                                    headers: {
                                        'User-Agent': 'RoomRentalApp/1.0'
                                    }
                                }
                            );
                            
                            if (response.ok) {
                                const data = await response.json();
                                // Extract district from location - prioritize state_district
                                const detectedDistrict = data.address?.state_district || 
                                                        data.address?.county || 
                                                        data.address?.city ||
                                                        data.address?.town;
                                
                                if (detectedDistrict) {
                                    // Find exact match or closest match in Maharashtra districts list
                                    const districtMatch = MAHARASHTRA_DISTRICTS.find(
                                        district => district.toLowerCase() === detectedDistrict.toLowerCase()
                                    );
                                    
                                    if (districtMatch) {
                                        // Auto-select the detected district
                                        handleFilterChange('city', districtMatch);
                                        setLocationDetected(true);
                                    } else {
                                        // Try partial match
                                        const partialMatch = MAHARASHTRA_DISTRICTS.find(
                                            district => district.toLowerCase().includes(detectedDistrict.toLowerCase()) ||
                                                       detectedDistrict.toLowerCase().includes(district.toLowerCase())
                                        );
                                        
                                        if (partialMatch) {
                                            handleFilterChange('city', partialMatch);
                                            setLocationDetected(true);
                                        }
                                    }
                                }
                            }
                        } catch (error) {
                            // Silent error handling
                        }
                    },
                    () => {
                        // User denied location or error occurred
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 600000 // Cache for 10 minutes
                    }
                );
            }
        }
    }, [filters.city, locationDetected, searchParams]);

    // Fetch similar rooms from same city when no results found
    useEffect(() => {
        const abortController = new AbortController();
        const requestId = ++similarRoomsRequestSequenceRef.current;
        let isEffectActive = true;

        const fetchSimilarRooms = async () => {
            // Only fetch similar rooms if:
            // 1. We have no results from the main search
            // 2. User has applied some filters (search, price, etc.)
            // 3. A city is selected
            const hasFiltersApplied = filters.search || filters.minRent || filters.maxRent || 
                                     (filters.listingType && filters.listingType !== 'all') ||
                                     (filters.roomType && filters.roomType !== 'all') ||
                                     (filters.furnishingType && filters.furnishingType !== 'all') ||
                                     (filters.gender && filters.gender !== 'all');
            
            if (rooms.length === 0 && hasFiltersApplied && filters.city && filters.city !== 'all') {
                try {
                    // Fetch rooms with only city filter
                    const cityOnlyFilters: RoomFilters = {
                        city: filters.city,
                        listingType: '',
                        search: '',
                        minRent: undefined,
                        maxRent: undefined,
                        roomType: undefined,
                        furnishingType: undefined,
                        gender: undefined
                    };
                    const similarData = await getRooms(
                        { ...cityOnlyFilters, page: 1, limit: 6 },
                        { signal: abortController.signal }
                    );

                    if (!isEffectActive || requestId !== similarRoomsRequestSequenceRef.current || abortController.signal.aborted) {
                        return;
                    }

                    setSimilarRooms(similarData.data);
                } catch (error) {
                    const err = error as { name?: string; code?: string };
                    if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || abortController.signal.aborted) {
                        return;
                    }
                    setSimilarRooms([]);
                }
            } else {
                setSimilarRooms([]);
            }
        };

        void fetchSimilarRooms();

        return () => {
            isEffectActive = false;
            abortController.abort();
        };
    }, [rooms.length, filters]);

    useEffect(() => {
        const nextFilters: RoomFilters = {
            city: searchParams.get('city') || '',
            listingType: searchParams.get('listingType') || '',
            search: searchParams.get('search') || searchParams.get('q') || '',
            minRent: searchParams.get('minRent') ? parseFloat(searchParams.get('minRent')!) : undefined,
            maxRent: searchParams.get('maxRent') ? parseFloat(searchParams.get('maxRent')!) : undefined,
            roomType: searchParams.get('roomType') || undefined,
            furnishingType: searchParams.get('furnishingType') || undefined,
            gender: searchParams.get('gender') || undefined
        };

        setFilters((prev) => {
            if (
                prev.city === nextFilters.city &&
                prev.listingType === nextFilters.listingType &&
                prev.search === nextFilters.search &&
                prev.minRent === nextFilters.minRent &&
                prev.maxRent === nextFilters.maxRent &&
                prev.roomType === nextFilters.roomType &&
                prev.furnishingType === nextFilters.furnishingType &&
                prev.gender === nextFilters.gender
            ) {
                return prev;
            }
            return nextFilters;
        });
        setPagination((prev) => ({ ...prev, currentPage: 1 }));
    }, [searchParams]);

    const handleFilterChange = (key: keyof RoomFilters, value: string) => {
        const normalizedValue = value === 'all' ? '' : value;
        const newFilters = { ...filters, [key]: normalizedValue };

        if (String(filters[key] ?? '') === String(normalizedValue ?? '')) {
            return;
        }

        setFilters(newFilters);
        setPagination(prev => ({ ...prev, currentPage: 1 }));
        
        // Update URL params - convert 'all' values to empty strings
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
            const filterValue = v === 'all' ? '' : v;
            if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
                params.set(k, String(filterValue));
            }
        });
        setSearchParams(params);
    };

    const clearAllFilters = () => {
        const clearedFilters: RoomFilters = {
            city: '',
            listingType: '',
            search: '',
            minRent: undefined,
            maxRent: undefined,
            roomType: undefined,
            furnishingType: undefined,
            gender: undefined
        };
        setFilters(clearedFilters);
        setSearchParams(new URLSearchParams());
    };

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleApplyMobileFilters = () => {
        setShowMobileAdvancedFilters(false);
    };

    const hasActiveFilters = 
        filters.search || 
        (filters.city && filters.city !== 'all') || 
        (filters.listingType && filters.listingType !== 'all') ||
        filters.minRent ||
        filters.maxRent ||
        (filters.roomType && filters.roomType !== 'all') ||
        (filters.furnishingType && filters.furnishingType !== 'all') ||
        (filters.gender && filters.gender !== 'all');

    const handleChatClick = async (roomId: string) => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: { pathname: window.location.pathname, search: window.location.search } } });
            return;
        }
        const room = rooms.find((item) => item.room_id === roomId);
        const chatRoomId = room?.id ?? (room?.room_id ? Number(room.room_id) : undefined);

        if (!room?.room_id || !room?.user_id || !chatRoomId || Number.isNaN(chatRoomId)) {
            return;
        }

        try {
            await openChat(chatRoomId, room.user_id, room);
        } catch (error) {
        }
    };

    const displayedRooms = useMemo(() => {
        const sorted = [...rooms];

        const getPrice = (room: Room) => room.rent ?? room.cost ?? 0;

        switch (sortBy) {
            case 'price-low':
                return sorted.sort((a, b) => getPrice(a) - getPrice(b));
            case 'price-high':
                return sorted.sort((a, b) => getPrice(b) - getPrice(a));
            case 'featured':
                return sorted.sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0));
            case 'newest':
            default:
                return sorted.sort((a, b) => {
                    const aDate = new Date(a.post_date || 0).getTime();
                    const bDate = new Date(b.post_date || 0).getTime();
                    return bDate - aDate;
                });
        }
    }, [rooms, sortBy]);

    const searchSuggestions = useMemo(() => {
        const query = (filters.search || '').trim().toLowerCase();
        if (!query) return [];

        const districtMatches = MAHARASHTRA_DISTRICTS
            .filter((district) => district.toLowerCase().includes(query))
            .map((value) => ({ value, type: 'district' as const }));

        const roomMatches = rooms
            .flatMap((room) => [room.title, room.area])
            .filter((value): value is string => Boolean(value))
            .filter((value) => value.toLowerCase().includes(query))
            .map((value) => ({ value, type: 'room' as const }));

        const merged = [...districtMatches, ...roomMatches];
        const unique = merged.filter((item, index, arr) => arr.findIndex((entry) => entry.value.toLowerCase() === item.value.toLowerCase()) === index);

        return unique.slice(0, 6);
    }, [filters.search, rooms]);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (!searchInputContainerRef.current) return;
            if (!searchInputContainerRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
                setActiveSuggestionIndex(-1);
            }
        };

        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (searchParams.get('focusSearch') !== '1') return;

        const timer = window.setTimeout(() => {
            roomsSearchInputRef.current?.focus();
            roomsSearchInputRef.current?.setSelectionRange(
                roomsSearchInputRef.current.value.length,
                roomsSearchInputRef.current.value.length
            );
        }, 0);

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('focusSearch');
        setSearchParams(nextParams, { replace: true });

        return () => window.clearTimeout(timer);
    }, [searchParams, setSearchParams]);

    const applySearchSuggestion = (value: string) => {
        handleFilterChange('search', value);
        setIsSearchFocused(false);
        setActiveSuggestionIndex(-1);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-bg via-white to-slate-100">
            {/* Premium Header Section */}
            <div className="relative overflow-hidden bg-gradient-to-r from-green-primary via-green-secondary to-green-primary text-white">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
                </div>
                
                <div className="relative w-full px-[2px] pt-10 sm:pt-12 pb-[10px]">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur border border-white/30 rounded-full text-sm font-semibold">
                                    <Sparkles className="w-4 h-4" />
                                    Premium Room Rentals
                                </span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
                                Find Your Perfect Room
                            </h1>
                            <p className="text-base sm:text-lg text-white/90 mb-[10px] max-w-2xl">
                                Discover available listings from verified landlords with secure and transparent booking experience.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-white/90 text-sm">
                                    <TrendingUp className="w-4 h-4" />
                                    <span>Trending Areas</span>
                                </div>
                            </div>
                            <div className="mt-[10px] bg-white/10 backdrop-blur border border-white/20 rounded-xl px-[2px] py-3 sm:px-[2px] sm:py-4">
                                <div className="flex items-center gap-2 w-full overflow-x-auto pb-1">
                                    <div className="relative flex-1 min-w-[220px] z-50" ref={searchInputContainerRef}>
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <Input
                                            ref={roomsSearchInputRef}
                                            placeholder="Search by area, title..."
                                            className="pl-9 h-10 border-white/30 bg-white/90 text-slate-900 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm"
                                            value={filters.search || ''}
                                            onFocus={() => setIsSearchFocused(true)}
                                            onChange={(e) => {
                                                handleFilterChange('search', e.target.value);
                                                setIsSearchFocused(true);
                                                setActiveSuggestionIndex(-1);
                                            }}
                                            onKeyDown={(e) => {
                                                if (!searchSuggestions.length) return;

                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setActiveSuggestionIndex((prev) => (prev + 1) % searchSuggestions.length);
                                                }

                                                if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    setActiveSuggestionIndex((prev) => (prev <= 0 ? searchSuggestions.length - 1 : prev - 1));
                                                }

                                                if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
                                                    e.preventDefault();
                                                    applySearchSuggestion(searchSuggestions[activeSuggestionIndex].value);
                                                }

                                                if (e.key === 'Escape') {
                                                    setIsSearchFocused(false);
                                                    setActiveSuggestionIndex(-1);
                                                }
                                            }}
                                        />

                                        {isSearchFocused && (filters.search || '').trim().length > 0 && searchSuggestions.length > 0 && (
                                            <div className="absolute z-50 top-full mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                                                <ul className="max-h-56 overflow-y-auto py-1">
                                                    {searchSuggestions.map((suggestion, index) => (
                                                        <li key={`${suggestion.type}-${suggestion.value}-${index}`}>
                                                            <button
                                                                type="button"
                                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between ${index === activeSuggestionIndex ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                                                                onMouseDown={(event) => {
                                                                    event.preventDefault();
                                                                    applySearchSuggestion(suggestion.value);
                                                                }}
                                                            >
                                                                <span className="truncate">{suggestion.value}</span>
                                                                <span className="text-xs text-slate-500 ml-2 uppercase">{suggestion.type}</span>
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    <Select value={sortBy} onValueChange={setSortBy}>
                                        <SelectTrigger className="w-[170px] sm:w-52 lg:w-56 h-10 border-white/30 bg-white/90 text-slate-900 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm shrink-0">
                                            <div className="flex items-center gap-2">
                                                <ArrowUpDown className="w-4 h-4 text-slate-500" />
                                                <SelectValue placeholder="Sort by" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="newest">Newest First</SelectItem>
                                            <SelectItem value="price-low">Price: Low to High</SelectItem>
                                            <SelectItem value="price-high">Price: High to Low</SelectItem>
                                            <SelectItem value="featured">Featured</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <div className="flex gap-2 border border-white/30 bg-white/90 rounded-lg p-1 w-auto shrink-0">
                                        <Button
                                            variant={viewType === 'grid' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewType('grid')}
                                            className={`${viewType === 'grid' ? 'bg-blue-600 text-white hover:bg-purple-600' : 'text-slate-600 hover:text-slate-900'}`}
                                            title="Grid view"
                                        >
                                            <Grid3x3 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant={viewType === 'list' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewType('list')}
                                            className={`${viewType === 'list' ? 'bg-blue-600 text-white hover:bg-purple-600' : 'text-slate-600 hover:text-slate-900'}`}
                                            title="List view"
                                        >
                                            <List className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full px-[2px] pt-[10px] pb-6 sm:pb-8">

                {/* Faceted Search Filters */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                {/* Filter Sidebar */}
                <div className="lg:col-span-1 w-full">
                    <Card className="w-full lg:sticky top-4 shadow-lg border-0 rounded-xl overflow-hidden mb-0 lg:mb-0">
                        <CardContent className="px-[2px] py-2 sm:px-[2px] sm:py-4">
                            {/* Filter Header */}
                            <div className="flex items-center justify-between mb-3 sm:mb-6 pb-3 sm:pb-4 border-b border-slate-200">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Filter className="w-5 h-5 text-blue-600" />
                                    Filters
                                    {hasActiveFilters && (
                                        <Badge className="ml-2 bg-blue-600">
                                            Active
                                        </Badge>
                                    )}
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowMobileAdvancedFilters((prev) => !prev)}
                                    className="lg:hidden"
                                >
                                    <SlidersHorizontal className="w-4 h-4" />
                                    <span className="ml-2">More Filters</span>
                                </Button>
                            </div>

                            {/* Clear All Filters */}
                            {hasActiveFilters && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearAllFilters}
                                    className="w-full mb-4 text-blue-600 border-slate-300 hover:bg-blue-50 hover:border-blue-500 font-medium"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Clear All
                                </Button>
                            )}

                            {/* Active Filters Badges */}
                            {hasActiveFilters && (
                                <div className="mb-6 pb-6 border-b border-slate-200 space-y-3">
                                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Active Filters</p>
                                    <div className="flex flex-wrap gap-2">
                                        {filters.search && (
                                            <Badge className="gap-1 cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors border-0" onClick={() => handleFilterChange('search', '')}>
                                                🔍 {filters.search}
                                                <X className="w-3 h-3" />
                                            </Badge>
                                        )}
                                        {filters.city && filters.city !== 'all' && (
                                            <Badge className="gap-1 cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors border-0" onClick={() => handleFilterChange('city', '')}>
                                                📍 {filters.city}
                                                <X className="w-3 h-3" />
                                            </Badge>
                                        )}
                                        {filters.listingType && filters.listingType !== 'all' && (
                                            <Badge className="gap-1 cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors border-0" onClick={() => handleFilterChange('listingType', '')}>
                                                {filters.listingType}
                                                <X className="w-3 h-3" />
                                            </Badge>
                                        )}
                                        {filters.minRent && (
                                            <Badge className="gap-1 cursor-pointer bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors border-0" onClick={() => handleFilterChange('minRent', '')}>
                                                ₹{filters.minRent}+
                                                <X className="w-3 h-3" />
                                            </Badge>
                                        )}
                                        {filters.maxRent && (
                                            <Badge className="gap-1 cursor-pointer bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors border-0" onClick={() => handleFilterChange('maxRent', '')}>
                                                ₹{filters.maxRent} Max
                                                <X className="w-3 h-3" />
                                            </Badge>
                                        )}
                                        {filters.roomType && filters.roomType !== 'all' && (
                                            <Badge className="gap-1 cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white transition-colors border-0" onClick={() => handleFilterChange('roomType', '')}>
                                                {filters.roomType}
                                                <X className="w-3 h-3" />
                                            </Badge>
                                        )}
                                        {filters.furnishingType && filters.furnishingType !== 'all' && (
                                            <Badge className="gap-1 cursor-pointer bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white transition-colors border-0" onClick={() => handleFilterChange('furnishingType', '')}>
                                                {filters.furnishingType}
                                                <X className="w-3 h-3" />
                                            </Badge>
                                        )}
                                        {filters.gender && filters.gender !== 'all' && (
                                            <Badge className="gap-1 cursor-pointer bg-pink-100 text-pink-700 hover:bg-pink-600 hover:text-white transition-colors border-0" onClick={() => handleFilterChange('gender', '')}>
                                                {filters.gender}
                                                <X className="w-3 h-3" />
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Filter Sections */}
                            <div className="space-y-6">
                                {/* District Section (mobile: shown after tapping More Filters) */}
                                <div className={showMobileAdvancedFilters ? 'block' : 'hidden lg:block'}>
                                    <div className="flex items-center justify-between mb-3 cursor-pointer hover:opacity-75 transition-opacity" onClick={() => toggleSection('location')}>
                                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-blue-600" />
                                            District
                                        </h3>
                                        {expandedSections.location ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                    </div>
                                    {expandedSections.location && (
                                        <div className="space-y-3 pl-0 border-l-2 border-blue-200 pl-4">
                                            <Select value={filters.city || 'all'} onValueChange={(value) => handleFilterChange('city', value)}>
                                                <SelectTrigger className="h-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm">
                                                    <SelectValue placeholder="Select district" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All city</SelectItem>
                                                    {MAHARASHTRA_DISTRICTS.map((district) => (
                                                        <SelectItem key={district} value={district}>
                                                            {district}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div className={showMobileAdvancedFilters ? 'block' : 'hidden lg:block space-y-6'}>
                                        {/* Price Range Section */}
                                        <div className="pt-6 border-t border-slate-200">
                                            <div className="flex items-center justify-between mb-3 cursor-pointer hover:opacity-75 transition-opacity" onClick={() => toggleSection('price')}>
                                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4 text-blue-600" />
                                                    Price Range
                                                </h3>
                                                {expandedSections.price ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                            </div>
                                            {expandedSections.price && (
                                                <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                                                    <Input
                                                        type="number"
                                                        placeholder="Min price (₹)"
                                                        className="h-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm"
                                                        value={filters.minRent || ''}
                                                        onChange={(e) => handleFilterChange('minRent', e.target.value)}
                                                    />
                                                    <Input
                                                        type="number"
                                                        placeholder="Max price (₹)"
                                                        className="h-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm"
                                                        value={filters.maxRent || ''}
                                                        onChange={(e) => handleFilterChange('maxRent', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Property Details Section */}
                                        <div className="pt-6 border-t border-slate-200">
                                            <div className="flex items-center justify-between mb-3 cursor-pointer hover:opacity-75 transition-opacity" onClick={() => toggleSection('property')}>
                                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-blue-600" />
                                                    Property Details
                                                </h3>
                                                {expandedSections.property ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                            </div>
                                            {expandedSections.property && (
                                                <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-700 mb-2 block uppercase tracking-wide">Listing Type</label>
                                                        <Select value={filters.listingType || 'all'} onValueChange={(value) => handleFilterChange('listingType', value)}>
                                                            <SelectTrigger className="h-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="all">All Types</SelectItem>
                                                                <SelectItem value="For Rent">For Rent</SelectItem>
                                                                <SelectItem value="Required Roommate">Required Roommate</SelectItem>
                                                                <SelectItem value="For Sell">For Sell</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-700 mb-2 block uppercase tracking-wide">Room Type</label>
                                                        <Select value={filters.roomType || 'all'} onValueChange={(value) => handleFilterChange('roomType', value)}>
                                                            <SelectTrigger className="h-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm">
                                                                <SelectValue placeholder="Select room type" />
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
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-700 mb-2 block uppercase tracking-wide">Furnishing</label>
                                                        <Select value={filters.furnishingType || 'all'} onValueChange={(value) => handleFilterChange('furnishingType', value)}>
                                                            <SelectTrigger className="h-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-lg text-sm">
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
                                                </div>
                                            )}
                                        </div>

                                        {/* Preferences Section */}
                                        <div className="pt-6 border-t border-slate-200">
                                            <div className="flex items-center justify-between mb-3 cursor-pointer hover:opacity-75 transition-opacity" onClick={() => toggleSection('preferences')}>
                                                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                    <UserCheck className="w-4 h-4 text-pink-600" />
                                                    Preferences
                                                </h3>
                                                {expandedSections.preferences ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                                            </div>
                                            {expandedSections.preferences && (
                                                <div className="space-y-3 pl-4 border-l-2 border-pink-200">
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-700 mb-2 block uppercase tracking-wide">Gender Preference</label>
                                                        <Select value={filters.gender || 'all'} onValueChange={(value) => handleFilterChange('gender', value)}>
                                                            <SelectTrigger className="h-10 border-slate-200 focus:border-pink-500 focus:ring-pink-500 rounded-lg text-sm">
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
                                            )}
                                        </div>

                                        <Button
                                            className="w-full lg:hidden mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 h-10 rounded-lg"
                                            onClick={handleApplyMobileFilters}
                                        >
                                            Apply Filters
                                        </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Results Area */}
                <div className="lg:col-span-3">

            {/* Results */}
            {isFetching ? (
                <div className="grid gap-6 lg:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-slate-200/80 bg-white shadow-md overflow-hidden animate-pulse">
                            <div className="h-44 bg-slate-200" />
                            <div className="p-4 space-y-3">
                                <div className="h-4 bg-slate-200 rounded w-3/4" />
                                <div className="h-3 bg-slate-100 rounded w-1/2" />
                                <div className="h-5 bg-slate-200 rounded w-1/3" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : displayedRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="text-center max-w-2xl mx-auto w-full">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm">
                            <Building2 className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">No Exact Match Found</h3>
                        <p className="text-slate-600 mb-4 text-sm">
                            {filters.search
                                ? `No listings match "${filters.search}".`
                                : filters.city && filters.city !== 'all'
                                    ? `No listings found with your current filters in ${filters.city} district.`
                                    : 'No listings found with your current filters.'}
                        </p>
                        {hasActiveFilters && (
                            <Button onClick={clearAllFilters} className="bg-blue-600 hover:bg-blue-700 mb-6 text-sm py-1 px-3">
                                Clear All Filters
                            </Button>
                        )}

                        {/* Similar Listings Section */}
                        {similarRooms.length > 0 && (
                            <div className="mt-8 w-full">
                                <div className="mb-4 pb-2 border-b border-slate-200">
                                    <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">You Can See Similar Listings</h4>
                                    <p className="text-slate-600 text-xs">Available rooms in <span className="font-semibold text-blue-600">{filters.city}</span> district</p>
                                </div>
                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {similarRooms.map((room) => (
                                        <RoomCard
                                            key={room.room_id}
                                            room={room}
                                            onChat={handleChatClick}
                                            showViews={false}
                                            viewMode="grid"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : displayedRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="text-center max-w-2xl mx-auto w-full">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm">
                            <Building2 className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">No Exact Match Found</h3>
                        <p className="text-slate-600 mb-4 text-sm">
                            {filters.search
                                ? `No listings match "${filters.search}".`
                                : filters.city && filters.city !== 'all'
                                    ? `No listings found with your current filters in ${filters.city} district.`
                                    : 'No listings found with your current filters.'}
                        </p>
                        {hasActiveFilters && (
                            <Button onClick={clearAllFilters} className="bg-blue-600 hover:bg-blue-700 mb-6 text-sm py-1 px-3">
                                Clear All Filters
                            </Button>
                        )}

                        {/* Similar Listings Section */}
                        {similarRooms.length > 0 && (
                            <div className="mt-8 w-full">
                                <div className="mb-4 pb-2 border-b border-slate-200">
                                    <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">You Can See Similar Listings</h4>
                                    <p className="text-slate-600 text-xs">Available rooms in <span className="font-semibold text-blue-600">{filters.city}</span> district</p>
                                </div>
                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {similarRooms.map((room) => (
                                        <RoomCard
                                            key={room.room_id}
                                            room={room}
                                            onChat={handleChatClick}
                                            showViews={false}
                                            viewMode="grid"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className={`grid gap-6 lg:gap-8 ${viewType === 'list' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                    {displayedRooms.map((room, index) => (
                        <div
                            key={room.room_id}
                            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                            style={{ animationDelay: `${Math.min(index, 11) * 55}ms`, animationFillMode: 'both' }}
                        >
                            <RoomCard
                                room={room}
                                onChat={handleChatClick}
                                showViews={false}
                                viewMode={viewType}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 pt-8 border-t border-slate-200">
                    <Button 
                        variant="outline" 
                        disabled={pagination.currentPage === 1}
                        onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                        className="w-full sm:w-auto px-6 border-slate-300 hover:bg-slate-50"
                    >
                        ← Previous
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">
                            Page <span className="text-blue-600 font-bold">{pagination.currentPage}</span> of <span className="text-blue-600 font-bold">{pagination.totalPages}</span>
                        </span>
                    </div>
                    <Button 
                        variant="outline"
                        disabled={pagination.currentPage === pagination.totalPages}
                        onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                        className="w-full sm:w-auto px-6 border-slate-300 hover:bg-slate-50"
                    >
                        Next →
                    </Button>
                </div>
            )}
                </div>
            </div>
            </div>

        </div>
    );
};

export default RoomsListPage;
