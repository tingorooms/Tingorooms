import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, MapPin, Search, Phone, Mail, Filter, BriefcaseBusiness, MessageCircle } from 'lucide-react';
import { getPublicBrokers, type PublicBroker } from '@/services/brokerService';
import { getCities } from '@/services/roomService';
import { buildBrokerPath, buildWhatsAppUrl, getProfileImageUrl, normalizePhoneForWhatsApp } from '@/lib/utils';
import { readWarmCache, WARM_BROKERS_LIST_KEY } from '@/lib/pageWarmCache';

const BrokersPage: React.FC = () => {
    const navigate = useNavigate();
    const [brokers, setBrokers] = useState<PublicBroker[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchInput, setSearchInput] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [cityFilter, setCityFilter] = useState('all');
    const [minListingsFilter, setMinListingsFilter] = useState('0');
    const [sortBy, setSortBy] = useState<'top_listed' | 'newest' | 'name_asc' | 'name_desc'>('top_listed');
    const [hasWarmStartData, setHasWarmStartData] = useState(false);

    const loadBrokers = async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) {
                setLoading(true);
            }
            setError('');

            const brokersResponse = await getPublicBrokers({
                search: appliedSearch || undefined,
                city: cityFilter === 'all' ? undefined : cityFilter,
                minListings: parseInt(minListingsFilter, 10),
                sort: sortBy,
                page: 1,
                limit: 100
            });

            setBrokers(brokersResponse.data);
        } catch (loadError) {
            setError('Unable to load brokers right now. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const warm = readWarmCache<{ brokers: PublicBroker[] }>(WARM_BROKERS_LIST_KEY);
        if (!warm?.brokers?.length) return;

        setBrokers(warm.brokers);
        setLoading(false);
        setHasWarmStartData(true);
    }, []);

    useEffect(() => {
        void loadBrokers({ silent: hasWarmStartData });
    }, [appliedSearch, cityFilter, minListingsFilter, sortBy]);

    useEffect(() => {
        const loadCities = async () => {
            try {
                const citiesResponse = await getCities();
                setCities(
                    (citiesResponse || [])
                        .map((city) => city.city_name)
                        .filter(Boolean)
                        .slice(0, 60)
                );
            } catch {
                setCities([]);
            }
        };

        void loadCities();
    }, []);

    const displayedBrokers = useMemo(() => brokers, [brokers]);

    const handleSearch = () => {
        setAppliedSearch(searchInput.trim());
    };

    const clearFilters = () => {
        setSearchInput('');
        setAppliedSearch('');
        setCityFilter('all');
        setMinListingsFilter('0');
        setSortBy('top_listed');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-bg via-white to-slate-100 py-0 md:py-6">
            <div className="max-w-screen-2xl mx-auto px-4 space-y-6">
                <div className="text-center space-y-3">
                    <Badge className="px-3 py-1.5 bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                        <BriefcaseBusiness className="w-3.5 h-3.5 mr-1.5 inline" />
                        Verified Professionals
                    </Badge>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">Find Trusted Brokers</h1>
                    <p className="text-slate-600 max-w-3xl mx-auto">
                        Connect with approved brokers across Maharashtra and find the right room faster.
                    </p>
                </div>

                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4 md:p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            <div className="lg:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by broker name, city or email"
                                        className="pl-9"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSearch();
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <Select value={cityFilter} onValueChange={setCityFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Cities" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Cities</SelectItem>
                                    {cities.map((city) => (
                                        <SelectItem key={city} value={city}>
                                            {city}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={minListingsFilter} onValueChange={setMinListingsFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Min Listings" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Any Listings</SelectItem>
                                    <SelectItem value="5">5+ Listings</SelectItem>
                                    <SelectItem value="10">10+ Listings</SelectItem>
                                    <SelectItem value="20">20+ Listings</SelectItem>
                                    <SelectItem value="30">30+ Listings</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sort" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="top_listed">Top Listed</SelectItem>
                                    <SelectItem value="newest">Newest</SelectItem>
                                    <SelectItem value="name_asc">Name A-Z</SelectItem>
                                    <SelectItem value="name_desc">Name Z-A</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Filter className="w-4 h-4" />
                                {loading ? 'Loading brokers...' : `${displayedBrokers.length} broker(s) found`}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={clearFilters}>Reset</Button>
                                <Button onClick={handleSearch}>Search</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {error ? (
                    <Card className="border-red-200 bg-red-50/60">
                        <CardContent className="p-5 flex items-center justify-between gap-4">
                            <p className="text-sm text-red-700">{error}</p>
                            <Button variant="outline" onClick={loadBrokers}>Retry</Button>
                        </CardContent>
                    </Card>
                ) : null}

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Card key={index}>
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-12 w-12 rounded-full" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="h-3 w-28" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-9 w-28" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-3/4" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : displayedBrokers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                        {displayedBrokers.map((broker) => {
                            const brokerPath = buildBrokerPath(broker.unique_id || broker.id, broker.name);
                            return (
                            <Card
                                key={broker.id}
                                className="h-full border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all cursor-pointer"
                                onClick={() => navigate(brokerPath)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        navigate(brokerPath);
                                    }
                                }}
                            >
                                <CardContent className="p-5 flex flex-col h-full">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-12 w-12 border border-slate-200">
                                            <AvatarImage src={getProfileImageUrl(broker.profile_image)} alt={broker.name} />
                                            <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold">
                                                {broker.name?.slice(0, 2).toUpperCase() || 'BR'}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="font-semibold text-lg text-slate-900 truncate">{broker.name}</h3>
                                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                                    Member since{' '}
                                                    {new Date(broker.registration_date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                                                <MapPin className="w-4 h-4" />
                                                <span className="truncate">{broker.broker_area || 'Area not specified'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-100">
                                            <Building2 className="w-3.5 h-3.5 mr-1" />
                                            {broker.room_count || 0} Approved Listings
                                        </Badge>
                                    </div>

                                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4" />
                                            <span>{broker.contact || 'Contact not available'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 break-all">
                                            <Mail className="w-4 h-4" />
                                            <span>{broker.email || 'Email not available'}</span>
                                        </div>
                                    </div>

                                    {(() => {
                                        const phone = normalizePhoneForWhatsApp(broker.contact);
                                        const hasPhone = phone.length >= 10;
                                        const whatsappUrl = buildWhatsAppUrl(broker.contact);

                                        return (
                                            <div className="mt-auto pt-4 space-y-2">
                                                <Button 
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        navigate(brokerPath);
                                                    }}
                                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110"
                                                    size="sm"
                                                >
                                                    <BriefcaseBusiness className="w-4 h-4 mr-2" />
                                                    View {broker.room_count || 0} Listings
                                                </Button>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {hasPhone ? (
                                                        <Button asChild size="sm" variant="outline">
                                                            <a href={`tel:${phone}`} onClick={(event) => event.stopPropagation()}>
                                                                <Phone className="w-4 h-4 mr-1" />
                                                                Call
                                                            </a>
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" variant="outline" disabled>
                                                            <Phone className="w-4 h-4 mr-1" />
                                                            Call
                                                        </Button>
                                                    )}
                                                    {hasPhone ? (
                                                        <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110">
                                                            <a href={whatsappUrl || '#'} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
                                                                <MessageCircle className="w-4 h-4 mr-1" />
                                                                WhatsApp
                                                            </a>
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110" disabled>
                                                            <MessageCircle className="w-4 h-4 mr-1" />
                                                            WhatsApp
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                            );
                        })}
                    </div>
                ) : (
                    <Card className="border-slate-200">
                        <CardContent className="p-8 text-center space-y-2">
                            <h3 className="text-lg font-semibold text-slate-900">No brokers found</h3>
                            <p className="text-sm text-slate-600">
                                Try changing your search text or filters to see more results.
                            </p>
                            <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default BrokersPage;
