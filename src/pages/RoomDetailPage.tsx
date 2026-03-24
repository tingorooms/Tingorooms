import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import {
    Building2,
    MapPin,
    Bed,
    Maximize,
    Calendar,
    User,
    Phone,
    Mail,
    MessageSquare,
    MessageCircle,
    Loader2,
    Share2,
    Heart,
    ChevronLeft,
    Check,
    Image as ImageIcon,
    ChevronRight,
    Map,
    X,
    UserCheck
} from 'lucide-react';
import { parseImages, getProfileImageUrl, buildWhatsAppUrl } from '@/lib/utils';
import type { Room } from '@/types';
import { getRoomByIdWithOwnerAccess, incrementViewCount } from '@/services/roomService';
import { useChat } from '@/context/ChatContext';

// Alternative facilities parser that handles string format
const parseFacilitiesFromString = (facilities: any): string[] => {
    if (Array.isArray(facilities)) {
        return facilities;
    }
    if (typeof facilities === 'string') {
        try {
            const parsed = JSON.parse(facilities);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const toSlug = (value: string): string => {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
};

const upsertMetaTag = (
    selector: { name?: string; property?: string },
    content: string
) => {
    if (!content) return;
    const key = selector.name ? 'name' : 'property';
    const value = selector.name || selector.property;
    if (!value) return;

    let element = document.head.querySelector(`meta[${key}="${value}"]`) as HTMLMetaElement | null;
    if (!element) {
        element = document.createElement('meta');
        element.setAttribute(key, value);
        document.head.appendChild(element);
    }
    element.setAttribute('content', content);
};

const upsertCanonicalLink = (href: string) => {
    if (!href) return;
    let linkElement = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkElement) {
        linkElement = document.createElement('link');
        linkElement.setAttribute('rel', 'canonical');
        document.head.appendChild(linkElement);
    }
    linkElement.setAttribute('href', href);
};

const RoomDetailPage: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, user } = useAuth();
    const [room, setRoom] = useState<Room | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
    const [isEstablishingChat, setIsEstablishingChat] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const autoChatAttemptRef = useRef<string | null>(null);
    const { openChat } = useChat();

    const isOwner = user && room && user.id === room.user_id;

    const handleShare = async () => {
        const url = window.location.href;
        const title = room?.title ?? 'Room Listing';
        const text = room
            ? `Check out this ${room.room_type} in ${room.area}, ${room.city} — ₹${(room.rent || room.cost || 0).toLocaleString('en-IN')}`
            : '';
        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
            } catch {
                // user cancelled
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                setShareSuccess(true);
                setTimeout(() => setShareSuccess(false), 2000);
            } catch {
                // clipboard unavailable
            }
        }
    };

    const handleChatClick = async () => {
        if (!isAuthenticated) {
            // Pass chat intent through login/register/OTP
            const params = new URLSearchParams(location.search);
            params.set('startChat', '1');
            if (room?.user_id) {
                params.set('receiverId', String(room.user_id));
            }

            navigate('/login', {
                state: {
                    chatIntent: {
                        roomId: room?.id,
                        receiverId: room?.user_id
                    },
                    from: { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }
                }
            });
            return;
        }
        if (!room?.id || !room?.user_id) {
            return;
        }
        try {
            setIsEstablishingChat(true);
            await openChat(room.id, room.user_id, room);

            const params = new URLSearchParams(location.search);
            if (params.has('startChat') || params.has('receiverId')) {
                params.delete('startChat');
                params.delete('receiverId');
                const cleanedSearch = params.toString();
                navigate(
                    {
                        pathname: location.pathname,
                        search: cleanedSearch ? `?${cleanedSearch}` : '',
                    },
                    { replace: true }
                );
            }
        } catch (error) {
        } finally {
            setIsEstablishingChat(false);
        }
    };

    useEffect(() => {
        if (!room || isOwner || isEstablishingChat) return;

        const params = new URLSearchParams(location.search);
        const shouldStartChat = params.get('startChat') === '1';
        const receiverId = params.get('receiverId');
        const matchesReceiver = receiverId ? Number(receiverId) === room.user_id : true;

        if (!shouldStartChat || !matchesReceiver) {
            autoChatAttemptRef.current = null;
            return;
        }

        const intentKey = `${room.id}:${receiverId || ''}:${location.search}`;
        if (autoChatAttemptRef.current === intentKey) return;

        autoChatAttemptRef.current = intentKey;
        void handleChatClick();
    }, [room, isOwner, isEstablishingChat, location.search]);

    useEffect(() => {
        const fetchRoom = async () => {
            try {
                if (roomId) {
                    const data = await getRoomByIdWithOwnerAccess(roomId);
                    setRoom(data);
                    incrementViewCount(roomId);
                }
            } catch (error) {
            } finally {
                setIsLoading(false);
            }
        };

        fetchRoom();
    }, [roomId]);

    useEffect(() => {
        if (!room) return;
        const images = parseImages(room.images);
        if (images.length <= 1) return;

        const interval = setInterval(() => {
            setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
        }, 2000);

        return () => clearInterval(interval);
    }, [room]);

    useEffect(() => {
        if (!room) return;

        const appBaseUrl = window.location.origin;
        const roomSlug = toSlug(`${room.title}-${room.area}-${room.city}`);
        const canonicalUrl = `${appBaseUrl}/room/${room.room_id}/${roomSlug}`;
        const imageList = parseImages(room.images);
        const primaryImage = imageList[0] || '';

        const description = [
            `${room.room_type} ${room.listing_type.toLowerCase()} in ${room.area}, ${room.city}.`,
            room.rent ? `Rent ₹${Number(room.rent).toLocaleString('en-IN')}/month.` : '',
            room.cost ? `Price ₹${Number(room.cost).toLocaleString('en-IN')}.` : '',
            room.furnishing_type ? `Furnishing: ${room.furnishing_type}.` : ''
        ]
            .filter(Boolean)
            .join(' ')
            .trim();

        const title = `${room.title} | ${room.area}, ${room.city} | Room Rental`;

        document.title = title;

        upsertMetaTag({ name: 'description' }, description);
        upsertMetaTag({ property: 'og:title' }, title);
        upsertMetaTag({ property: 'og:description' }, description);
        upsertMetaTag({ property: 'og:type' }, 'product');
        upsertMetaTag({ property: 'og:url' }, canonicalUrl);
        upsertMetaTag({ property: 'og:image' }, primaryImage);
        upsertMetaTag({ name: 'twitter:card' }, 'summary_large_image');
        upsertMetaTag({ name: 'twitter:title' }, title);
        upsertMetaTag({ name: 'twitter:description' }, description);
        upsertMetaTag({ name: 'twitter:image' }, primaryImage);
        upsertCanonicalLink(canonicalUrl);

        const existingStructuredData = document.getElementById('room-seo-jsonld');
        if (existingStructuredData) {
            existingStructuredData.remove();
        }

        const structuredData = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: room.title,
            description,
            image: primaryImage ? [primaryImage] : [],
            sku: room.room_id,
            category: room.listing_type,
            brand: {
                '@type': 'Brand',
                name: 'Room Rental'
            },
            url: canonicalUrl,
            offers: {
                '@type': 'Offer',
                priceCurrency: 'INR',
                price: room.rent || room.cost || 0,
                availability: 'https://schema.org/InStock',
                itemCondition: 'https://schema.org/UsedCondition',
                url: canonicalUrl
            },
            areaServed: room.city,
            location: {
                '@type': 'Place',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: room.area,
                    addressRegion: room.city,
                    postalCode: room.pincode,
                    streetAddress: room.address
                }
            }
        };

        const scriptElement = document.createElement('script');
        scriptElement.id = 'room-seo-jsonld';
        scriptElement.type = 'application/ld+json';
        scriptElement.text = JSON.stringify(structuredData);
        document.head.appendChild(scriptElement);

        return () => {
            const existing = document.getElementById('room-seo-jsonld');
            if (existing) existing.remove();
        };
    }, [room]);

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-96 bg-muted rounded-lg" />
                    <div className="h-8 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                </div>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-bold mb-2">Room Not Found</h2>
                <p className="text-muted-foreground mb-4">The room you're looking for doesn't exist</p>
                <Button onClick={() => navigate('/rooms')}>Browse Rooms</Button>
            </div>
        );
    }

    const images = parseImages(room.images);

    return (
        <>
        <div className="min-h-screen bg-muted/30 pb-[30px] md:pb-[80px] lg:pb-0">
            {/* Back Button */}
            <div className="max-w-screen-2xl mx-auto px-[10px] sm:px-5 lg:px-6 py-0">
                <Button variant="ghost" onClick={() => navigate(-1)}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
            </div>

            <div className="max-w-screen-2xl mx-auto px-[10px] sm:px-5 lg:px-6 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-5 sm:space-y-6">
                        {/* Room Title — above the image */}
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug line-clamp-2">
                            {room.title}
                        </h1>

                        {/* Image Gallery with Slider */}
                        <Card className="overflow-hidden m-0 p-0 gap-0 border-0 shadow-lg rounded-[20px]">
                            <CardContent className="p-0 m-0">
                                <div className="relative m-0">
                                    {/* Main Image */}
                                    <div 
                                        className="h-72 sm:h-[440px] lg:h-[500px] bg-muted relative overflow-hidden cursor-pointer group"
                                        onClick={() => images.length > 0 && setIsFullscreenOpen(true)}
                                    >
                                        {images.length > 0 ? (
                                            <img 
                                                src={images[selectedImage]} 
                                                alt={room.title}
                                                fetchPriority="high"
                                                loading="eager"
                                                decoding="async"
                                                className="w-full h-full object-cover group-hover:brightness-90 transition-all"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.alt = 'Image unavailable';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-300">
                                                <ImageIcon size={80} className="text-gray-500" />
                                            </div>
                                        )}
                                        
                                        {/* Badge */}
                                        <Badge className="absolute top-4 left-4 text-lg px-4 py-1">
                                            {room.listing_type}
                                        </Badge>

                                        {/* Fullscreen Icon */}
                                        {images.length > 0 && (
                                            <div className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Maximize className="w-5 h-5" />
                                            </div>
                                        )}

                                        {/* Bottom overlay: location + View on Map + image counter */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pt-8 pb-3 flex items-end justify-between gap-2">
                                            <div className="flex items-center gap-1.5 text-white text-xs sm:text-sm font-medium min-w-0">
                                                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span className="truncate">{room.area}, {room.city}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 pointer-events-auto">
                                                {room.latitude && room.longitude && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.open(`https://www.google.com/maps?q=${room.latitude},${room.longitude}`, '_blank');
                                                        }}
                                                        className="flex items-center gap-1 bg-white/20 hover:bg-white/40 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full backdrop-blur-sm transition-colors"
                                                    >
                                                        <Map className="w-3.5 h-3.5" />
                                                        View on Map
                                                    </button>
                                                )}
                                                {images.length > 1 && (
                                                    <div className="bg-black/60 text-white px-2.5 py-1 rounded-full text-xs">
                                                        {selectedImage + 1} / {images.length}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Previous Button */}
                                        {images.length > 1 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedImage((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                                                }}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-black rounded-full p-2 transition-all"
                                                aria-label="Previous image"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                        )}

                                        {/* Next Button */}
                                        {images.length > 1 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                                                }}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-black rounded-full p-2 transition-all"
                                                aria-label="Next image"
                                            >
                                                <ChevronRight className="w-6 h-6" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Thumbnail Slider */}
                                    {images.length > 1 && (
                                        <div className="bg-muted border-t p-3 sm:p-4">
                                            <div className="flex gap-3 overflow-x-auto pb-2">
                                                {images.map((img, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => setSelectedImage(index)}
                                                        aria-label={`View image ${index + 1}`}
                                                        className={`w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                                                            selectedImage === index 
                                                                ? 'border-primary ring-2 ring-primary ring-offset-2' 
                                                                : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                                                        }`}
                                                    >
                                                        <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Details Card */}
                        <Card className="border border-slate-200 shadow-sm rounded-2xl">
                            <CardContent className="p-4 sm:p-6 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="w-4 h-4" />
                                            {room.address}, {room.area}, {room.city} - {room.pincode}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 self-start sm:self-auto">
                                        <Button variant="outline" size="icon" className="rounded-xl" onClick={handleShare} title={shareSuccess ? 'Link copied!' : 'Share'}>
                                            {shareSuccess ? <Check className="w-4 h-4 text-blue-500" /> : <Share2 className="w-4 h-4" />}
                                        </Button>
                                        <Button variant="outline" size="icon" className="rounded-xl">
                                            <Heart className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl">
                                        <Bed className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Room Type</p>
                                            <span className="font-semibold text-sm">{room.room_type}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl">
                                        <Building2 className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">House Type</p>
                                            <span className="font-semibold text-sm">{room.house_type}</span>
                                        </div>
                                    </div>
                                    {room.size_sqft && (
                                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl">
                                            <Maximize className="w-5 h-5 text-primary" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Size</p>
                                                <span className="font-semibold text-sm">{room.size_sqft} sqft</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Available</p>
                                            <span className="font-semibold text-sm">{new Date(room.availability_from).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Existing Roommates Section */}
                                {room.existing_roommates && room.existing_roommates.length > 0 && (
                                    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-blue-50 p-4 sm:p-5">
                                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                            <UserCheck className="w-5 h-5 text-blue-600" />
                                            Existing Roommates
                                        </h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {room.existing_roommates.map((mate, index) => (
                                                <div key={index} className="bg-white border border-blue-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                                            {mate.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium text-slate-900 text-sm line-clamp-1">{mate.name}</p>
                                                            <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                                                                <MapPin className="w-3 h-3" />
                                                                {mate.city}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Description Section */}
                                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-2">Description</h2>
                                    <p className="text-muted-foreground leading-relaxed">{room.note || 'No description available'}</p>
                                </div>

                                {/* Facilities Section */}
                                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-3">Facilities</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                        {parseFacilitiesFromString(room.facilities).length > 0 ? (
                                            parseFacilitiesFromString(room.facilities).map((facility, index) => (
                                                <div key={index} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                    <span className="text-sm text-slate-700">{facility}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-muted-foreground">No facilities listed</p>
                                        )}
                                    </div>
                                </div>

                                {/* Location Section */}
                                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-3">Location</h2>
                                    <div className="space-y-4">
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">See this property on map</p>
                                                <p className="font-medium">{room.address}, {room.area}, {room.city}</p>
                                            </div>
                                            <Button 
                                                variant="default" 
                                                size="sm"
                                                className="gap-2 w-full sm:w-auto"
                                                onClick={() => {
                                                    if (room.latitude && room.longitude) {
                                                        const mapsUrl = `https://www.google.com/maps?q=${room.latitude},${room.longitude}`;
                                                        window.open(mapsUrl, '_blank');
                                                    }
                                                }}
                                            >
                                                <Map className="w-4 h-4" />
                                                Visit on Map
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-5 lg:sticky lg:top-24 self-start">
                        {/* Price Card */}
                        <Card className="border border-slate-200 shadow-sm rounded-2xl">
                            <CardContent className="p-6">
                                <div className="text-3xl font-bold text-primary mb-2">
                                    ₹{room.rent?.toLocaleString() || room.cost?.toLocaleString()}
                                    <span className="text-lg text-muted-foreground font-normal">
                                        {room.rent ? '/month' : ''}
                                    </span>
                                </div>
                                {room.deposit && (
                                    <div className="text-sm text-muted-foreground mb-4">
                                        Deposit: ₹{room.deposit.toLocaleString()}
                                    </div>
                                )}
                                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                                    {!isOwner && (
                                        <Button 
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl" 
                                            onClick={handleChatClick}
                                            disabled={isEstablishingChat}
                                        >
                                            {isEstablishingChat ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <MessageSquare className="w-4 h-4 mr-2" />
                                            )}
                                            {isEstablishingChat ? 'Establishing chat with owner...' : 'Chat with Owner'}
                                        </Button>
                                    )}
                                    {room.contact_visibility === 'Public' && room.contact && (
                                        <>
                                            <Button 
                                                className="w-full bg-blue-600 hover:bg-green-700 text-white rounded-xl" 
                                                onClick={() => {
                                                    const whatsappUrl = buildWhatsAppUrl(room.contact);
                                                    if (whatsappUrl) {
                                                        window.open(whatsappUrl, '_blank');
                                                    }
                                                }}
                                            >
                                                <MessageCircle className="w-4 h-4 mr-2" />
                                                WhatsApp
                                            </Button>
                                            <Button 
                                                className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl" 
                                                onClick={() => {
                                                    window.location.href = `tel:${room.contact}`;
                                                }}
                                            >
                                                <Phone className="w-4 h-4 mr-2" />
                                                Call Owner
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Owner Card */}
                        <Card className="border border-slate-200 shadow-sm rounded-2xl">
                            <CardContent className="p-6">
                                <h3 className="font-semibold text-slate-900 mb-4">Posted By</h3>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                                        {room.owner_profile_image ? (
                                            <img 
                                                src={getProfileImageUrl(room.owner_profile_image)} 
                                                alt={room.owner_name}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <User className="w-7 h-7 text-primary" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900">{room.owner_name}</p>
                                    </div>
                                </div>
                                {room.contact_visibility === 'Public' && (
                                    <div className="mt-4 space-y-2 pt-3 border-t border-slate-100">
                                        {room.contact && (
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Phone className="w-4 h-4 text-muted-foreground" />
                                                {room.contact}
                                            </div>
                                        )}
                                        {room.email && (
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Mail className="w-4 h-4 text-muted-foreground" />
                                                {room.email}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {room.contact_visibility === 'Private' && (
                                    <div className="mt-4">
                                        <p className="text-xs text-muted-foreground italic">Contact details are private. Use the chat feature to connect.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Similar Rooms */}
                        {room.similar_rooms && room.similar_rooms.length > 0 && (
                            <Card className="border border-slate-200 shadow-sm rounded-2xl">
                                <CardContent className="p-6">
                                    <h3 className="font-semibold mb-4">Similar Rooms</h3>
                                    <div className="space-y-4">
                                        {room.similar_rooms.map((similar) => (
                                            <div 
                                                key={similar.room_id} 
                                                className="flex gap-3 cursor-pointer hover:bg-muted p-2 rounded-lg transition-colors"
                                                onClick={() => navigate(`/room/${similar.room_id}`)}
                                            >
                                                <div className="w-20 h-20 bg-muted rounded-lg flex-shrink-0">
                                                    {(() => {
                                                        const similarImages = parseImages(similar.images);
                                                        if (similarImages.length > 0) {
                                                            return <img src={similarImages[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover rounded-lg" />;
                                                        }
                                                        return (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div>
                                                    <p className="font-medium line-clamp-1">{similar.title}</p>
                                                                    <p className="text-sm text-muted-foreground">{similar.area}, {similar.city}</p>
                                                                    <p className="text-primary font-semibold">
                                                                        ₹{similar.rent?.toLocaleString() || similar.cost?.toLocaleString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {/* Fullscreen Image Viewer Modal */}
                            <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
                                <DialogContent className="fixed inset-0 z-[9999] max-w-full w-screen h-screen p-0 gap-0 border-0 bg-black/85">
                                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                                        {/* Backdrop blur overlay */}
                                        <div className="absolute inset-0 backdrop-blur-[10px]" />
                                        
                                        {/* Close Button */}
                                        <button
                                            onClick={() => setIsFullscreenOpen(false)}
                                            className="absolute top-4 right-4 z-50 bg-white/40 backdrop-blur-md hover:bg-white/60 text-white p-3 rounded-full transition-all shadow-lg"
                                            aria-label="Close fullscreen"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>

                                        {/* Main Image */}
                                        <div className="relative w-full h-full flex items-center justify-center z-10">
                                            <img 
                                                src={images[selectedImage]} 
                                                alt={room.title}
                                                loading="eager"
                                                decoding="async"
                                                className="max-w-full max-h-full object-contain"
                                            />

                                            {/* Image Counter */}
                                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                                                {selectedImage + 1} / {images.length}
                                            </div>

                                            {/* Previous Button */}
                                            {images.length > 1 && (
                                                <button
                                                    onClick={() => setSelectedImage((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-md hover:bg-white/50 text-white rounded-full p-3 transition-all z-40 shadow-lg"
                                                    aria-label="Previous image"
                                                >
                                                    <ChevronLeft className="w-8 h-8" />
                                                </button>
                                            )}

                                            {/* Next Button */}
                                            {images.length > 1 && (
                                                <button
                                                    onClick={() => setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 backdrop-blur-md hover:bg-white/50 text-white rounded-full p-3 transition-all z-40 shadow-lg"
                                                    aria-label="Next image"
                                                >
                                                    <ChevronRight className="w-8 h-8" />
                                                </button>
                                            )}

                                            {/* Thumbnail Strip */}
                                            {images.length > 1 && (
                                                <div className="absolute bottom-20 left-0 right-0 flex gap-2 justify-center px-4 pb-4 overflow-x-auto">
                                                    {images.map((img, index) => (
                                                        <button
                                                            key={index}
                                                            onClick={() => setSelectedImage(index)}
                                                            aria-label={`View image ${index + 1}`}
                                                            className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                                                                selectedImage === index 
                                                                    ? 'border-primary ring-2 ring-primary' 
                                                                    : 'border-white/30 hover:border-white/60'
                                                            }`}
                                                        >
                                                            <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

            {/* Mobile sticky chat/contact bar */}
            {!isOwner && (
                <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl px-4 py-3">
                    <div className="flex gap-2 max-w-lg mx-auto">
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 text-sm font-semibold shadow-md"
                            onClick={handleChatClick}
                            disabled={isEstablishingChat}
                        >
                            {isEstablishingChat ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <MessageSquare className="w-4 h-4 mr-2" />
                            )}
                            {isEstablishingChat ? 'Connecting...' : 'Chat with Owner'}
                        </Button>
                        {room?.contact_visibility === 'Public' && room?.contact && (
                            <>
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 w-12 flex-shrink-0 shadow-md"
                                    onClick={() => {
                                        const whatsappUrl = buildWhatsAppUrl(room.contact);
                                        if (whatsappUrl) window.open(whatsappUrl, '_blank');
                                    }}
                                    title="WhatsApp"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                </Button>
                                <Button
                                    className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-12 w-12 flex-shrink-0 shadow-md"
                                    onClick={() => { window.location.href = `tel:${room.contact}`; }}
                                    title="Call Owner"
                                >
                                    <Phone className="w-5 h-5" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default RoomDetailPage;
