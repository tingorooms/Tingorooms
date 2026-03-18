import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
// Removed default ad card image logic
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { parseImages, buildRoomPath, buildWhatsAppUrl } from '@/lib/utils';
import {
    MapPin,
    MessageSquare,
    MessageCircle,
    Image as ImageIcon,
    Loader2,
    Phone
} from 'lucide-react';
import type { Room } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface RoomCardProps {
    room: Room;
    onChat?: (roomId: string) => Promise<void> | void;
    showViews?: boolean;
    viewMode?: 'grid' | 'list';
}

const getListingTypeBadgeColor = (type: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (type) {
        case 'For Rent':
            return 'default';
        case 'For Sell':
            return 'secondary';
        case 'Required Roommate':
            return 'outline';
        default:
            return 'default';
    }
};

const RoomCard: React.FC<RoomCardProps> = ({
    room,
    onChat,
    viewMode = 'grid'
}) => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const isOwner = user?.id === room.user_id;
    const roomPath = buildRoomPath(room.room_id, room.title, room.area, room.city);
    const images = parseImages(room.images);
    const hasImages = images.length > 0;
    const [selectedImage, setSelectedImage] = useState(0);
    const imageContainerRef = useRef<HTMLDivElement | null>(null);
    const [isInViewport, setIsInViewport] = useState(viewMode === 'list');
    const [isDocumentVisible, setIsDocumentVisible] = useState(() => document.visibilityState !== 'hidden');
    const isMobile = useIsMobile();
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [isChatStarting, setIsChatStarting] = useState(false);

    useEffect(() => {
        const container = imageContainerRef.current;
        if (!container || typeof IntersectionObserver === 'undefined') {
            setIsInViewport(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsInViewport(entry.isIntersecting);
            },
            {
                rootMargin: '220px 0px 220px 0px',
                threshold: 0.01,
            }
        );

        observer.observe(container);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsDocumentVisible(document.visibilityState !== 'hidden');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => setPrefersReducedMotion(media.matches);

        onChange();
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    // Auto-rotate images every 2 seconds if there are multiple images
    useEffect(() => {
        if (images.length <= 1 || !isInViewport || !isDocumentVisible || isMobile || prefersReducedMotion) return;

        const interval = setInterval(() => {
            setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
        }, 3500);

        return () => clearInterval(interval);
    }, [images.length, isInViewport, isDocumentVisible, isMobile, prefersReducedMotion]);

    const displayPrice = (): string => {
        if (room.listing_type === 'For Sell') {
            return `₹${Math.round(room.cost || 0).toLocaleString('en-IN')}`;
        }
        return `₹${Math.round(room.rent || 0).toLocaleString('en-IN')}`;
    };

    const formatAmount = (amount: number | undefined): string => {
        if (!amount) return '0';
        return Math.round(amount).toLocaleString('en-IN');
    };

    // Ensure facilities is an array (handle both array and JSON string formats)
    const facilitiesArray = Array.isArray(room.facilities) 
        ? room.facilities 
        : typeof room.facilities === 'string' 
            ? (() => {
                try {
                    const parsed = JSON.parse(room.facilities);
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            })()
            : [];

    const mainFacilities = useMemo(() => facilitiesArray.slice(0, 3), [facilitiesArray]);
    const moreFacilities = facilitiesArray.length > 3 ? facilitiesArray.length - 3 : 0;

    const handleChatButtonClick = async () => {
        if (isChatStarting) {
            return;
        }

        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        if (!onChat) {
            return;
        }

        try {
            setIsChatStarting(true);
            await onChat(room.room_id);
        } finally {
            setIsChatStarting(false);
        }
    };

    return (
        <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="h-full"
        >
        <Card className={`group w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md p-0 gap-0 ${viewMode === 'list' ? 'max-w-none flex flex-col md:flex-row' : 'sm:min-w-[312px] sm:max-w-[360px] flex flex-col'}`}>
            {/* Image Section */}
            <div
                ref={imageContainerRef}
                className={`group relative overflow-hidden bg-slate-200 cursor-pointer ${viewMode === 'list' ? 'w-full h-44 md:w-72 md:h-auto md:min-h-[220px] flex-shrink-0' : 'w-full h-44'}`}
                onClick={() => navigate(roomPath)}
            >
                {hasImages ? (
                    <img
                        src={images[selectedImage]}
                        alt={room.title}
                        loading="lazy"
                        decoding="async"
                        className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${viewMode === 'list' ? 'h-full min-h-[220px]' : 'h-44'}`}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-300">
                        <ImageIcon size={40} className="text-slate-500" />
                    </div>
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                {/* Left Top - Listing Type */}
                <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                    <Badge variant={getListingTypeBadgeColor(room.listing_type)} className="text-xs bg-black/70 text-white shadow-sm">
                        {room.listing_type}
                    </Badge>
                </div>

                {/* Right Top - Area */}
                <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs shadow-sm max-w-[100px] truncate">
                    <MapPin size={12} className="inline mr-1" />
                    {room.area}
                </div>

                {/* Left Bottom - Available From */}
                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs shadow-sm">
                   From: {new Date(room.availability_from).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </div>

                {/* Right Bottom - View Details Button */}
                <Button
                    className="absolute bottom-2 right-2 rounded-md bg-black/70 text-white shadow-sm hover:bg-black/80 text-xs h-7 px-2"
                    onClick={(event) => {
                        event.stopPropagation();
                        navigate(roomPath);
                    }}
                >
                    View
                </Button>
            </div>

            {/* Content Section */}
            <CardContent className={`${viewMode === 'list' ? 'p-3 flex-1' : 'p-2'}`}>
                {/* Title */}
                <h3
                    className="text-sm font-semibold truncate mb-2 cursor-pointer text-slate-900 transition-colors hover:text-green-primary"
                    onClick={() => navigate(roomPath)}
                >
                    {room.title}
                </h3>

                {/* Details Row - Type | Rent | Deposit with Emojis */}
                <div className="flex items-center gap-1 text-xs mb-2 pb-2 border-b border-slate-200 overflow-x-auto">
                    <div className="flex items-center gap-0.5 whitespace-nowrap">
                        <span className="text-sm">🏡</span>
                        <span className="font-medium">Type:</span>
                        <span className="text-slate-700">{room.room_type}</span>
                    </div>
                    <div className="w-px h-3 bg-slate-300 mx-1" />
                    <div className="flex items-center gap-0.5 whitespace-nowrap">
                        <span className="text-sm">💰</span>
                        <span className="font-medium">Rent:</span>
                        <span className="text-green-primary font-medium">
                            {displayPrice()}
                        </span>
                    </div>
                    <div className="w-px h-3 bg-slate-300 mx-1" />
                    <div className="flex items-center gap-0.5 whitespace-nowrap">
                        <span className="text-sm">🔒</span>
                        <span className="font-medium">Deposit:</span>
                        <span className="text-indigo-600 font-medium">
                            {room.deposit && room.listing_type !== 'For Sell'
                                ? formatAmount(room.deposit)
                                : 'NA'}
                        </span>
                    </div>
                </div>

                {/* Preferred Gender | House Type */}
                <div className="flex items-center justify-between gap-2 text-xs mb-2 text-slate-600">
                    <div>
                        <span className="font-semibold text-slate-900">Pref.: </span>
                        <span className="text-slate-700">{room.preferred_gender || 'Any'}</span>
                    </div>
                    <div>
                        <span className="font-semibold text-slate-900">Type: </span>
                        <span className="text-slate-700">{room.house_type}</span>
                    </div>
                </div>

                {/* Facilities Preview */}
                <div className="flex flex-wrap gap-1">
                    {mainFacilities.map((facility, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-slate-200 bg-slate-50">
                            {facility}
                        </Badge>
                    ))}
                    {moreFacilities > 0 && (
                        <Badge variant="outline" className="text-xs border-slate-200 bg-slate-50">
                            +{moreFacilities}
                        </Badge>
                    )}
                </div>
            </CardContent>

            {/* Action Buttons */}
            <CardFooter className={`${viewMode === 'list' ? 'p-3 pt-0 md:pt-3 flex gap-2 justify-start md:flex-col md:justify-center md:w-44 border-t md:border-t-0 md:border-l border-slate-200' : 'p-1.5 flex gap-1 justify-between'}`}>
                {!isOwner ? (
                    <>
                        {/* Chat Button */}
                        <Button
                            size="sm"
                            onClick={() => {
                                void handleChatButtonClick();
                            }}
                            title={isChatStarting ? 'Establishing chat with owner...' : 'Chat with owner'}
                            disabled={isChatStarting}
                            className={`rounded-md text-xs h-7 bg-blue-600 hover:bg-blue-700 text-white ${viewMode === 'list' ? 'flex-1 md:w-full md:flex-none' : 'flex-1'}`}
                        >
                            {isChatStarting ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                            <span className="ml-1">{isChatStarting ? 'Establishing...' : 'Chat'}</span>
                        </Button>

                        {/* WhatsApp Button - Only show when contact_visibility is 'Public' */}
                        {room.contact_visibility === 'Public' && room.contact && (
                            <Button
                                size="sm"
                                onClick={() => {
                                    const whatsappUrl = buildWhatsAppUrl(room.contact);
                                    if (whatsappUrl) {
                                        window.open(whatsappUrl, '_blank');
                                    }
                                }}
                                title="WhatsApp owner"
                                className={`rounded-md text-xs h-7 bg-green-600 hover:bg-green-700 text-white ${viewMode === 'list' ? 'flex-1 md:w-full md:flex-none' : 'flex-1'}`}
                            >
                                <MessageCircle size={14} />
                                <span className="ml-1">WhatsApp</span>
                            </Button>
                        )}

                        {/* Call Button - Only show when contact_visibility is 'Public' */}
                        {room.contact_visibility === 'Public' && room.contact && (
                            <Button
                                size="sm"
                                onClick={() => {
                                    window.location.href = `tel:${room.contact}`;
                                }}
                                title="Call owner"
                                className="rounded-md text-xs h-7 bg-orange-600 hover:bg-orange-700 text-white"
                            >
                                <Phone size={14} />
                            </Button>
                        )}
                    </>
                ) : (
                    <span className="text-xs text-slate-500 py-2">Your listing</span>
                )}
            </CardFooter>
        </Card>
        </motion.div>
    );
};

export default React.memo(RoomCard);
