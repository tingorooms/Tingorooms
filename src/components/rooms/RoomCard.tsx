import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
    Phone,
} from 'lucide-react';
import type { Room } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface RoomCardProps {
    room: Room;
    onChat?: (roomId: string) => Promise<void> | void;
    showViews?: boolean;
    viewMode?: 'grid' | 'list';
}

const LISTING_TYPE_STYLES: Record<string, string> = {
    'For Rent': 'bg-blue-600/90 text-white',
    'Required Roommate': 'bg-blue-600/90 text-white',
    'For Sell': 'bg-purple-600/90 text-white',
};

const RoomCard: React.FC<RoomCardProps> = ({ room, onChat, viewMode = 'grid' }) => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const isOwner = user?.id === room.user_id;
    const roomPath = buildRoomPath(room.room_id, room.title, room.area, room.city);
    const images = parseImages(room.images);
    const hasImages = images.length > 0;
    const [selectedImage, setSelectedImage] = useState(0);
    const imageContainerRef = useRef<HTMLDivElement | null>(null);
    const [isInViewport, setIsInViewport] = useState(viewMode === 'list');
    const [isDocumentVisible, setIsDocumentVisible] = useState(
        () => document.visibilityState !== 'hidden'
    );
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
            ([entry]) => setIsInViewport(entry.isIntersecting),
            { rootMargin: '220px 0px 220px 0px', threshold: 0.01 }
        );
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () =>
            setIsDocumentVisible(document.visibilityState !== 'hidden');
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

    useEffect(() => {
        if (
            images.length <= 1 ||
            !isInViewport ||
            !isDocumentVisible ||
            isMobile ||
            prefersReducedMotion
        )
            return;
        const interval = setInterval(() => {
            setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
        }, 3500);
        return () => clearInterval(interval);
    }, [images.length, isInViewport, isDocumentVisible, isMobile, prefersReducedMotion]);

    const displayPrice = (): string => {
        if (room.listing_type === 'For Sell') {
            return `\u20b9${Math.round(room.cost || 0).toLocaleString('en-IN')}`;
        }
        return `\u20b9${Math.round(room.rent || 0).toLocaleString('en-IN')}`;
    };

    const formatAmount = (amount: number | undefined): string => {
        if (!amount) return '0';
        return Math.round(amount).toLocaleString('en-IN');
    };

    const facilitiesArray = useMemo(() => {
        if (Array.isArray(room.facilities)) return room.facilities;
        if (typeof room.facilities === 'string') {
            try {
                const parsed = JSON.parse(room.facilities);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    }, [room.facilities]);

    const mainFacilities = useMemo(() => facilitiesArray.slice(0, 3), [facilitiesArray]);
    const moreFacilities = facilitiesArray.length > 3 ? facilitiesArray.length - 3 : 0;

    const handleChatButtonClick = async () => {
        if (isChatStarting) return;
        if (!isAuthenticated) {
            navigate('/login', { state: { from: { pathname: window.location.pathname, search: window.location.search } } });
            return;
        }
        if (!onChat) return;
        try {
            setIsChatStarting(true);
            await onChat(room.room_id);
        } finally {
            setIsChatStarting(false);
        }
    };

    const listingBadgeClass =
        LISTING_TYPE_STYLES[room.listing_type] ?? 'bg-slate-700/80 text-white';

    const getFacilityBadgeClass = (index: number) => {
        const styles = [
            'border-blue-200 bg-blue-50 text-blue-700',
            'border-purple-200 bg-purple-50 text-purple-700',
            'border-emerald-200 bg-emerald-50 text-emerald-700',
        ];
        return styles[index % styles.length];
    };

    return (
        <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="h-full"
        >
            <Card
                className={`group w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md hover:shadow-xl transition-all duration-300 p-0 gap-0 ${
                    viewMode === 'list'
                        ? 'max-w-none flex flex-col md:flex-row'
                        : 'flex flex-col'
                }`}
            >
                {/* Image Section */}
                <div
                    ref={imageContainerRef}
                    className={`relative overflow-hidden bg-slate-100 cursor-pointer ${
                        viewMode === 'list'
                            ? 'w-full h-52 md:w-72 md:h-auto md:min-h-[240px] flex-shrink-0 rounded-t-2xl md:rounded-t-none md:rounded-l-2xl'
                            : 'w-full aspect-video rounded-t-2xl'
                    }`}
                    onClick={() => navigate(roomPath)}
                >
                    {hasImages ? (
                        <img
                            src={images[selectedImage]}
                            alt={room.title}
                            loading="lazy"
                            decoding="async"
                            className={`w-full object-cover transition-transform duration-700 group-hover:scale-110 ${
                                viewMode === 'list' ? 'h-full min-h-[240px]' : 'h-full'
                            }`}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                            <ImageIcon size={44} className="text-slate-400" />
                        </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />

                    <span
                        className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full shadow backdrop-blur-sm ${listingBadgeClass}`}
                    >
                        {room.listing_type}
                    </span>

                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs shadow max-w-[110px]">
                        <MapPin size={9} className="flex-shrink-0" />
                        <span className="truncate">{room.area}</span>
                    </div>

                    <div className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs shadow">
                        From:{' '}
                        {new Date(room.availability_from).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                        })}
                    </div>

                    <Button
                        className="absolute bottom-3 right-3 rounded-full bg-white/90 text-slate-800 hover:bg-white shadow-md text-xs h-7 px-3 font-semibold backdrop-blur-sm border-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(roomPath);
                        }}
                    >
                        View
                    </Button>
                </div>

                {/* Content Section */}
                <CardContent className={`${viewMode === 'list' ? 'px-[2px] py-4 flex-1' : 'px-[2px] py-4'}`}>
                    <h3
                        className="text-base font-bold truncate mb-1 cursor-pointer text-[#111827] transition-colors hover:text-[#2563EB] leading-snug"
                        onClick={() => navigate(roomPath)}
                    >
                        {room.title}
                    </h3>

                    <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                        <MapPin size={11} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                            {room.area}, {room.city}
                        </span>
                    </p>

                    <div className="flex items-baseline justify-between mb-3">
                        <div>
                            <span className="text-xl font-extrabold text-[#2563EB] leading-none">
                                {displayPrice()}
                            </span>
                            {room.listing_type !== 'For Sell' && (
                                <span className="text-xs text-slate-400 font-medium ml-1">/mo</span>
                            )}
                        </div>
                        {room.deposit && room.listing_type !== 'For Sell' && (
                            <div className="text-right">
                                <span className="text-xs text-slate-400">Deposit </span>
                                <span className="text-xs font-semibold text-indigo-600">
                                    Rs {formatAmount(room.deposit)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-3">
                        <span>Type: {room.room_type}</span>
                        <span className="w-px h-3 bg-slate-200" />
                        <span>Pref: {room.preferred_gender || 'Any'}</span>
                        <span className="w-px h-3 bg-slate-200" />
                        <span>House: {room.house_type}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {mainFacilities.map((facility, idx) => (
                            <Badge
                                key={idx}
                                variant="outline"
                                className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${getFacilityBadgeClass(idx)}`}
                            >
                                {facility}
                            </Badge>
                        ))}
                        {moreFacilities > 0 && (
                            <Badge
                                variant="outline"
                                className="text-xs border-slate-200 bg-slate-50 text-slate-400 rounded-full px-2.5 py-0.5"
                            >
                                +{moreFacilities} more
                            </Badge>
                        )}
                    </div>
                </CardContent>

                {/* Action Buttons */}
                <CardFooter
                    className={`border-t border-slate-100 ${
                        viewMode === 'list'
                            ? 'px-[2px] py-3 flex gap-2 justify-start md:flex-col md:justify-center md:w-44 md:border-t-0 md:border-l'
                            : 'px-[2px] py-3 flex gap-2'
                    }`}
                >
                    {!isOwner ? (
                        <>
                            <Button
                                size="sm"
                                onClick={() => void handleChatButtonClick()}
                                title={isChatStarting ? 'Establishing chat...' : 'Chat with owner'}
                                disabled={isChatStarting}
                                className={`rounded-xl text-xs h-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110 text-white font-semibold shadow-sm transition-all duration-300 hover:scale-[1.03] ${
                                    viewMode === 'list' ? 'flex-1 md:w-full md:flex-none' : 'flex-1'
                                }`}
                            >
                                {isChatStarting ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <MessageSquare size={13} />
                                )}
                                <span className="ml-1">
                                    {isChatStarting ? 'Connecting...' : 'Chat'}
                                </span>
                            </Button>

                            {room.contact_visibility === 'Public' && room.contact && (
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        const url = buildWhatsAppUrl(room.contact);
                                        if (url) window.open(url, '_blank');
                                    }}
                                    title="WhatsApp owner"
                                    className={`rounded-xl text-xs h-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110 text-white font-semibold shadow-sm transition-all duration-300 hover:scale-[1.03] ${
                                        viewMode === 'list' ? 'flex-1 md:w-full md:flex-none' : 'flex-1'
                                    }`}
                                >
                                    <MessageCircle size={13} />
                                    <span className="ml-1">WhatsApp</span>
                                </Button>
                            )}

                            {room.contact_visibility === 'Public' && room.contact && (
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        window.location.href = `tel:${room.contact}`;
                                    }}
                                    title="Call owner"
                                    className="rounded-xl text-xs h-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110 text-white font-semibold shadow-sm px-2.5 transition-all duration-300 hover:scale-[1.03]"
                                >
                                    <Phone size={13} />
                                </Button>
                            )}
                        </>
                    ) : (
                        <span className="text-xs text-slate-400 py-1 font-medium">Your listing</span>
                    )}
                </CardFooter>
            </Card>
        </motion.div>
    );
};

export default React.memo(RoomCard);
