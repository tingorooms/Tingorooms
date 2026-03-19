import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    MapPin,
    Navigation2,
    Loader2,
    Building2,
    Users,
    DollarSign,
    Home,
    AlertCircle,
} from 'lucide-react';
import { getRooms } from '@/services/roomService';
import type { Room } from '@/types';
import { buildRoomPath, parseImages } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type FilterType = 'all' | 'For Rent' | 'Required Roommate' | 'For Sell';

const FILTER_ACTIVE_CLASS: Record<FilterType, string> = {
    all: 'bg-slate-600 text-white shadow-md border-transparent scale-105',
    'For Rent': 'bg-green-primary text-white shadow-md border-transparent scale-105',
    'Required Roommate': 'bg-blue-600 text-white shadow-md border-transparent scale-105',
    'For Sell': 'bg-amber-500 text-white shadow-md border-transparent scale-105',
};

const FILTER_DOT_CLASS: Record<FilterType, string> = {
    all: 'bg-slate-500',
    'For Rent': 'bg-green-primary',
    'Required Roommate': 'bg-blue-600',
    'For Sell': 'bg-amber-500',
};

const LEGEND_DOT_CLASS: Record<'For Rent' | 'Required Roommate' | 'For Sell', string> = {
    'For Rent': 'bg-green-primary',
    'Required Roommate': 'bg-blue-600',
    'For Sell': 'bg-amber-500',
};

interface PinConfig {
    color: string;
    label: string;
    emoji: string;
}

const PIN_CONFIGS: Record<string, PinConfig> = {
    'For Rent': { color: '#16A34A', label: 'For Rent', emoji: '🏠' },
    'Required Roommate': { color: '#3B82F6', label: 'Need Roommate', emoji: '👥' },
    'For Sell': { color: '#F59E0B', label: 'For Sale', emoji: '🏷️' },
};

const DEFAULT_CENTER: [number, number] = [18.5204, 73.8567]; // Pune
const DEFAULT_ZOOM = 12;
const USER_LOCATION_ZOOM = 13;

// Inject Leaflet popup override styles once
let stylesInjected = false;
function injectMapStyles() {
    if (stylesInjected || typeof document === 'undefined') return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.id = 'map-section-styles';
    style.textContent = `
        .map-room-popup .leaflet-popup-content-wrapper {
            padding: 0 !important;
            border-radius: 14px !important;
            overflow: hidden !important;
            box-shadow: 0 12px 32px rgba(0,0,0,0.18) !important;
            border: none !important;
        }
        .map-room-popup .leaflet-popup-content {
            margin: 0 !important;
            width: 210px !important;
        }
        .map-room-popup .leaflet-popup-tip-container {
            display: none;
        }
        .map-custom-pin {
            background: none !important;
            border: none !important;
        }
        .map-user-dot {
            background: none !important;
            border: none !important;
        }
        @keyframes map-pulse-ring {
            0%   { transform: scale(1);   opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

let _pinSvgSeq = 0;
const createPinSvg = (color: string): string => {
    // Each SVG gets a unique filter ID to prevent DOM ID conflicts across many pins
    const uid = `psf${++_pinSvgSeq}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 46" width="32" height="46">
        <defs>
            <filter id="${uid}" x="-30%" y="-10%" width="160%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.30)"/>
            </filter>
        </defs>
        <path filter="url(#${uid})" d="M16 0C7.163 0 0 7.163 0 16c0 5.202 2.505 9.825 6.391 12.763L16 46l9.609-17.237C29.495 25.825 32 21.202 32 16 32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="8.5" fill="white"/>
        <circle cx="16" cy="16" r="5" fill="${color}"/>
    </svg>`;
};

const MapSection: React.FC = () => {
    const navigate = useNavigate();
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerGroupsRef = useRef<Map<string, L.LayerGroup>>(new Map());
    const userMarkerRef = useRef<L.Marker | null>(null);
    const mapInitializedRef = useRef(false);

    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

    // Inject custom popup/pin CSS once
    useEffect(() => {
        injectMapStyles();
    }, []);

    // Create custom pin icon with title tooltip
    const createPinIcon = useCallback((listingType: string, title?: string): L.DivIcon => {
        const config = PIN_CONFIGS[listingType] ?? PIN_CONFIGS['For Rent'];
        const svg = createPinSvg(config.color);
        const shortTitle = title ? (title.length > 22 ? title.substring(0, 20) + '…' : title) : '';
        const labelHtml = shortTitle
            ? `<div style="
                position:absolute;
                bottom:50px;
                left:50%;
                transform:translateX(-50%);
                background:rgba(15,23,42,0.88);
                color:#fff;
                font-size:10px;
                font-weight:600;
                padding:2px 7px;
                border-radius:20px;
                white-space:nowrap;
                pointer-events:none;
                line-height:1.5;
                backdrop-filter:blur(4px);
              ">${shortTitle}</div>`
            : '';
        return L.divIcon({
            html: `<div style="position:relative;width:32px;height:46px;">${labelHtml}<div style="width:32px;height:46px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.25));transition:transform 0.2s ease;">${svg}</div></div>`,
            className: 'map-custom-pin',
            iconSize: [32, 46],
            iconAnchor: [16, 46],
            popupAnchor: [0, -48],
        });
    }, []);

    // Create user location icon
    const createUserIcon = useCallback((): L.DivIcon => {
        return L.divIcon({
            html: `
                <div style="position:relative;width:20px;height:20px;">
                    <div style="
                        position:absolute;inset:0;
                        background:#3B82F6;
                        border-radius:50%;
                        animation:map-pulse-ring 2s ease-out infinite;
                        opacity:0.4;
                    "></div>
                    <div style="
                        position:absolute;inset:3px;
                        background:#3B82F6;
                        border:2px solid white;
                        border-radius:50%;
                        box-shadow:0 0 0 2px #3B82F6;
                    "></div>
                </div>
            `,
            className: 'map-user-dot',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });
    }, []);

    // Initialize map (once)
    useEffect(() => {
        if (!mapContainerRef.current || mapInitializedRef.current) return;
        mapInitializedRef.current = true;

        const map = L.map(mapContainerRef.current, {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: false,
        });

        // Add zoom control in top-right
        L.control.zoom({ position: 'topright' }).addTo(map);

        // OSM tile layer with a clean style
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        // Create layer groups
        const rentGroup = L.layerGroup().addTo(map);
        const roommateGroup = L.layerGroup().addTo(map);
        const sellGroup = L.layerGroup().addTo(map);

        layerGroupsRef.current.set('For Rent', rentGroup);
        layerGroupsRef.current.set('Required Roommate', roommateGroup);
        layerGroupsRef.current.set('For Sell', sellGroup);

        mapRef.current = map;

        // Track visible bounds for on-demand marker rendering
        const updateBounds = () => setMapBounds(map.getBounds());
        map.on('moveend', updateBounds);
        map.on('zoomend', updateBounds);
        // Set initial bounds once tiles are ready
        map.whenReady(() => setTimeout(updateBounds, 300));

        // Detect user location silently on init
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                    setUserLocation(loc);
                    map.setView(loc, USER_LOCATION_ZOOM);
                },
                () => { /* Silently use default center */ },
                { timeout: 8000, maximumAge: 60000 }
            );
        }

        return () => {
            map.off('moveend');
            map.off('zoomend');
            map.remove();
            mapRef.current = null;
            mapInitializedRef.current = false;
            layerGroupsRef.current.clear();
        };
    }, []);

    // Fetch rooms
    useEffect(() => {
        const controller = new AbortController();
        const fetchRooms = async () => {
            try {
                setIsLoading(true);
                const data = await getRooms({ limit: 200, page: 1 });
                // Coerce lat/lng to numbers (MySQL may return DECIMAL columns as strings)
                const valid = (data.data ?? [])
                    .map((r) => ({
                        ...r,
                        latitude: parseFloat(r.latitude as unknown as string),
                        longitude: parseFloat(r.longitude as unknown as string),
                    }))
                    .filter(
                        (r) =>
                            !isNaN(r.latitude) &&
                            !isNaN(r.longitude) &&
                            r.latitude !== 0 &&
                            r.longitude !== 0
                    );
                setRooms(valid);
            } catch {
                // silent
            } finally {
                setIsLoading(false);
            }
        };
        void fetchRooms();
        return () => controller.abort();
    }, []);

    // Place room markers when rooms load or map viewport changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map || rooms.length === 0) return;

        // Expand bounds by 10% for smooth edge-loading experience
        const paddedBounds = mapBounds ? mapBounds.pad(0.1) : null;

        // Clear previous markers
        layerGroupsRef.current.forEach((group) => group.clearLayers());

        rooms.forEach((room) => {
            if (!room.latitude || !room.longitude) return;

            // Only render markers visible in (padded) current viewport
            if (paddedBounds && !paddedBounds.contains([room.latitude, room.longitude])) return;

            const icon = createPinIcon(room.listing_type, room.title);
            const roomPath = buildRoomPath(room.room_id, room.title, room.area, room.city);
            const images = parseImages(room.images);
            const config = PIN_CONFIGS[room.listing_type] ?? PIN_CONFIGS['For Rent'];

            const priceLabel =
                room.listing_type === 'For Sell'
                    ? `₹${Math.round(room.cost ?? 0).toLocaleString('en-IN')}`
                    : `₹${Math.round(room.rent ?? 0).toLocaleString('en-IN')}/mo`;

            const imgHtml = images[0]
                ? `<img src="${images[0]}" alt="${room.title.replace(/"/g, '&#34;')}" loading="lazy"
                       style="width:100%;height:110px;object-fit:cover;" onerror="this.parentElement.style.display='none'" />`
                : `<div style="width:100%;height:70px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;">
                       <span style="color:#94a3b8;font-size:11px;">No image</span>
                   </div>`;

            const popupHtml = `
                <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:210px;">
                    ${imgHtml}
                    <div style="padding:10px 12px 12px;">
                        <span style="display:inline-block;padding:2px 8px;background:${config.color};color:#fff;
                              font-size:9px;border-radius:20px;margin-bottom:6px;font-weight:700;letter-spacing:0.04em;
                              text-transform:uppercase;">
                            ${config.emoji} ${room.listing_type}
                        </span>
                        <h4 style="margin:0 0 3px;font-size:13px;font-weight:700;color:#0f172a;
                                   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;">
                            ${room.title}
                        </h4>
                        <p style="margin:0 0 5px;font-size:11px;color:#64748b;white-space:nowrap;
                                  overflow:hidden;text-overflow:ellipsis;">
                            📍 ${room.area}, ${room.city}
                        </p>
                        <p style="margin:0 0 9px;font-size:15px;font-weight:800;color:${config.color};">
                            ${priceLabel}
                        </p>
                        <a href="${roomPath}"
                           style="display:block;text-align:center;padding:7px 10px;
                                  background:${config.color};color:#fff;border-radius:8px;
                                  text-decoration:none;font-size:12px;font-weight:700;
                                  transition:opacity 0.15s;"
                           onmouseover="this.style.opacity='0.85'"
                           onmouseout="this.style.opacity='1'">
                            View Details →
                        </a>
                    </div>
                </div>
            `;

            const marker = L.marker([room.latitude, room.longitude], { icon }).bindPopup(
                popupHtml,
                {
                    maxWidth: 220,
                    className: 'map-room-popup',
                    closeButton: true,
                    autoClose: false,
                    closeOnClick: false,
                }
            );

            // Hover: show popup
            marker.on('mouseover', () => {
                marker.openPopup();
            });

            // Click: navigate to room detail
            marker.on('click', () => {
                navigate(roomPath);
            });

            const group = layerGroupsRef.current.get(room.listing_type);
            group?.addTo(map); // ensure group is on map
            group?.addLayer(marker);
        });
    }, [rooms, mapBounds, createPinIcon, navigate]);

    // Update user location marker
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !userLocation) return;

        if (userMarkerRef.current) {
            userMarkerRef.current.remove();
        }

        userMarkerRef.current = L.marker(userLocation, { icon: createUserIcon() })
            .bindPopup(
                '<div style="padding:8px 12px;font-size:12px;font-weight:700;color:#3B82F6;text-align:center;">📍 You are here</div>',
                { className: 'map-room-popup' }
            )
            .addTo(map);
    }, [userLocation, createUserIcon]);

    // Toggle layer groups based on active filter
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        layerGroupsRef.current.forEach((group, type) => {
            const shouldShow = activeFilter === 'all' || activeFilter === type;
            if (shouldShow) {
                if (!map.hasLayer(group)) group.addTo(map);
            } else {
                if (map.hasLayer(group)) map.removeLayer(group);
            }
        });
    }, [activeFilter]);

    // Locate Me handler
    const handleLocateMe = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser.');
            return;
        }
        setIsLocating(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setUserLocation(loc);
                mapRef.current?.setView(loc, USER_LOCATION_ZOOM);
                setIsLocating(false);
            },
            (err) => {
                setIsLocating(false);
                if (err.code === err.PERMISSION_DENIED) {
                    setLocationError(
                        'Location access denied. Please enable location in your browser settings.'
                    );
                } else {
                    setLocationError('Unable to detect location. Please try again.');
                }
            },
            { timeout: 10000, maximumAge: 30000 }
        );
    }, []);

    const filterButtons: {
        key: FilterType;
        label: string;
        Icon: React.FC<{ className?: string }>;
    }[] = [
        { key: 'all', label: 'All Listings', Icon: Building2 },
        { key: 'For Rent', label: 'For Rent', Icon: Home },
        {
            key: 'Required Roommate',
            label: 'Need Roommate',
            Icon: Users,
        },
        { key: 'For Sell', label: 'For Sale', Icon: DollarSign },
    ];

    return (
        <section className="py-16 bg-gradient-to-b from-white to-green-bg relative isolate">
            <div className="max-w-screen-2xl mx-auto px-5">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-8"
                >
                    <Badge className="mb-4 px-4 py-2 bg-green-primary/10 text-green-primary border-green-primary/20 font-semibold text-sm">
                        <MapPin className="w-4 h-4 mr-2 inline" />
                        Explore on Map
                    </Badge>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
                        Find Rooms on{' '}
                        <span className="bg-gradient-to-r from-green-primary to-green-secondary bg-clip-text text-transparent">
                            Live Map
                        </span>
                    </h2>
                    <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto">
                        All listings are pinned. Map focuses on your current location (20km radius). Hover
                        a pin to preview, click to view full details.
                    </p>
                </motion.div>

                {/* Filter Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4"
                >
                    {/* Filter Pills */}
                    <div className="flex flex-wrap gap-2">
                        {filterButtons.map(({ key, label, Icon }) => {
                            const active = activeFilter === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setActiveFilter(key)}
                                    className={[
                                        'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold',
                                        'transition-all duration-200 border',
                                        active
                                            ? FILTER_ACTIVE_CLASS[key]
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm',
                                    ].join(' ')}
                                >
                                    {/* Color dot for inactive, icon always */}
                                    {!active && (
                                        <span
                                            className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${FILTER_DOT_CLASS[key]}`}
                                        />
                                    )}
                                    <Icon className="w-3.5 h-3.5" />
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Locate Me */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                            onClick={handleLocateMe}
                            disabled={isLocating}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold
                                       hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed
                                       transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                        >
                            {isLocating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Navigation2 className="w-4 h-4" />
                            )}
                            Locate Me
                        </button>
                    </div>
                </motion.div>

                {/* Location Error Banner */}
                {locationError && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center gap-2"
                    >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {locationError}
                    </motion.div>
                )}

                {/* Map Container */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 h-[520px]"
                >
                    {/* Loading overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-10 h-10 animate-spin text-green-primary" />
                                <p className="text-slate-600 font-semibold">Loading listings...</p>
                            </div>
                        </div>
                    )}

                    {/* Leaflet map */}
                    <div ref={mapContainerRef} className="w-full h-full" />

                    {/* Legend overlay */}
                    <div className="absolute bottom-6 left-4 z-[400] bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-3.5 border border-slate-200 min-w-[155px]">
                        <p className="text-[10px] font-extrabold text-slate-500 mb-2.5 uppercase tracking-widest">
                            Legend
                        </p>
                        {Object.keys(PIN_CONFIGS).map((type) => (
                            <div key={type} className="flex items-center gap-2 mb-2 last:mb-0">
                                <div
                                    className={`w-3 h-3 rounded-full flex-shrink-0 shadow-sm ${
                                        LEGEND_DOT_CLASS[type as 'For Rent' | 'Required Roommate' | 'For Sell']
                                    }`}
                                />
                                <span className="text-xs font-medium text-slate-700">{type}</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                            <div className="w-3 h-3 rounded-full flex-shrink-0 bg-blue-500 shadow-sm ring-2 ring-blue-300" />
                            <span className="text-xs font-medium text-slate-700">Your Location</span>
                        </div>
                    </div>

                    {/* "20km" radius badge */}
                    <div className="absolute top-4 left-4 z-[400] bg-blue-600/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                        📍 Focused ~20km radius
                    </div>
                </motion.div>

                {/* Footer note */}
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="text-center text-xs sm:text-sm text-slate-400 mt-4"
                >
                    Map focuses on listings near your location • All pins are active listings • Click any
                    pin to open full details
                </motion.p>
            </div>
        </section>
    );
};

export default MapSection;
