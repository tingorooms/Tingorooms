import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LocateFixed, Search } from 'lucide-react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

type LocationDetails = {
    address?: string;
    area?: string;
    city?: string;
    pincode?: string;
};

type SearchSuggestion = {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
};

type LocationPickerMapProps = {
    latitude: number;
    longitude: number;
    onCoordinatesChange: (latitude: number, longitude: number) => void;
    onLocationDetailsChange?: (details: LocationDetails) => void;
};

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
    latitude,
    longitude,
    onCoordinatesChange,
    onLocationDetailsChange,
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const [searchText, setSearchText] = useState('');
    const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isResolvingLocation, setIsResolvingLocation] = useState(false);
    const isProgrammaticUpdateRef = useRef(false);
    const reverseGeocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastReverseGeocodeRef = useRef<{ lat: number; lon: number } | null>(null);

    const canSearch = useMemo(() => searchText.trim().length >= 3, [searchText]);

    const moveMarkerAndMap = (targetLatitude: number, targetLongitude: number) => {
        if (!mapRef.current || !markerRef.current) {
            return;
        }

        markerRef.current.setLatLng([targetLatitude, targetLongitude]);
        mapRef.current.setView([targetLatitude, targetLongitude], 16);
    };

    const reverseGeocode = async (targetLatitude: number, targetLongitude: number) => {
        
        if (!onLocationDetailsChange) {
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
            
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${targetLatitude}&lon=${targetLongitude}&addressdetails=1&zoom=18`,
                {
                    signal: controller.signal,
                    headers: {
                        'Accept-Language': 'en',
                        'User-Agent': 'RoomRentalApp/1.0'
                    },
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                return;
            }

            const data = await response.json();
            const address = data.address || {};

            // Extract area - Priority: Most specific localities first
            // Avoid using broad administrative divisions like city_district, state_district, county
            const area = 
                address.hamlet ||           // Very small locality
                address.locality ||         // Generic locality
                address.suburb ||           // Suburb/neighborhood
                address.neighbourhood ||    // Neighborhood
                address.quarter ||          // Quarter of a city
                address.village ||          // Village
                address.town ||             // Small town
                '';
            
            // Allowed cities for the app
            const allowedCities = ['Pune', 'Mumbai', 'Nagpur', 'Nashik'];
            
            // Extract district as fallback for city
            let district = address.state_district || address.district || '';
            
            // Clean up district name by removing common suffixes
            if (district) {
                district = district
                    .replace(' District', '')
                    .replace(' district', '')
                    .trim();
            }
            
            // Extract city with better handling for Indian cities
            let city = 
                address.city ||
                address.town ||
                address.village ||
                address.municipality ||
                '';

            // If city not found or doesn't match allowed cities, use fallback logic
            if (!city || !allowedCities.includes(city)) {
                // Try to extract just the city name from district if it contains allowed city
                const foundCity = allowedCities.find(allowedCity => 
                    district.toLowerCase().includes(allowedCity.toLowerCase())
                );
                
                if (foundCity) {
                    city = foundCity;
                } else {
                    // Use district as city if it exists and looks like a city name
                    if (district && district.length > 2) {
                        city = district;
                    }
                    
                    // If still no city, try to match from full address
                    if (!city) {
                        const displayName = data.display_name || '';
                        const foundCityInAddress = allowedCities.find(allowedCity =>
                            displayName.toLowerCase().includes(allowedCity.toLowerCase())
                        );
                        if (foundCityInAddress) {
                            city = foundCityInAddress;
                        }
                    }
                }
            }

            // Extract pincode with fallback
            const pincode = address.postcode || address.postal_code || '';

            // Build full address from components if display_name is too short
            let fullAddress = data.display_name || '';
            if (fullAddress.length < 20 && area) {
                // Rebuild address with area
                fullAddress = area;
                if (district && district !== area) {
                    fullAddress += ', ' + district;
                }
                if (city && city !== area && city !== district) {
                    fullAddress += ', ' + city;
                }
                if (pincode) {
                    fullAddress += ' - ' + pincode;
                }
            }

            const locationDetails = {
                address: fullAddress.trim(),
                area: area.trim(),
                city: city.trim(),
                pincode: pincode.trim(),
            };
            
            if (onLocationDetailsChange) {
                onLocationDetailsChange(locationDetails);
            }
        } catch (error) {
            // Silent error handling for security
        }
    };

    const applyCoordinates = (targetLatitude: number, targetLongitude: number) => {
        onCoordinatesChange(targetLatitude, targetLongitude);
        
        // Store the latest request
        lastReverseGeocodeRef.current = { lat: targetLatitude, lon: targetLongitude };
        
        // Clear any pending reverse geocode timeout
        if (reverseGeocodeTimeoutRef.current) {
            clearTimeout(reverseGeocodeTimeoutRef.current);
        }
        
        // Debounce the reverse geocode API call by 800ms
        // This prevents rapid requests while dragging the marker
        reverseGeocodeTimeoutRef.current = setTimeout(() => {
            const latest = lastReverseGeocodeRef.current;
            if (latest) {
                void reverseGeocode(latest.lat, latest.lon);
            }
        }, 800);
    };

    useEffect(() => {
        if (!containerRef.current || mapRef.current) {
            return;
        }

        const map = L.map(containerRef.current).setView([latitude, longitude], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);

        marker.on('dragend', () => {
            const markerPosition = marker.getLatLng();
            applyCoordinates(markerPosition.lat, markerPosition.lng);
        });

        map.on('click', (event: L.LeafletMouseEvent) => {
            marker.setLatLng(event.latlng);
            applyCoordinates(event.latlng.lat, event.latlng.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;

        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current || !markerRef.current) {
            return;
        }

        if (isProgrammaticUpdateRef.current) {
            isProgrammaticUpdateRef.current = false;
            return;
        }

        const currentMarkerPosition = markerRef.current.getLatLng();
        const latitudeDiff = Math.abs(currentMarkerPosition.lat - latitude);
        const longitudeDiff = Math.abs(currentMarkerPosition.lng - longitude);

        if (latitudeDiff < 0.000001 && longitudeDiff < 0.000001) {
            return;
        }

        markerRef.current.setLatLng([latitude, longitude]);
        mapRef.current.panTo([latitude, longitude]);
    }, [latitude, longitude]);

    useEffect(() => {
        const controller = new AbortController();

        if (!canSearch) {
            setSuggestions([]);
            setIsSearching(false);
            return () => controller.abort();
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const searchController = new AbortController();
                const searchTimeoutId = setTimeout(() => searchController.abort(), 8000); // 8 second timeout
                
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchText)}&countrycodes=in&addressdetails=1&limit=6`,
                    {
                        signal: searchController.signal,
                        headers: {
                            'Accept-Language': 'en',
                            'User-Agent': 'RoomRentalApp/1.0'
                        },
                    }
                );

                clearTimeout(searchTimeoutId);

                if (!response.ok) {
                    setSuggestions([]);
                    return;
                }

                const data = await response.json();
                setSuggestions(Array.isArray(data) ? data : []);
            } catch (error) {
                setSuggestions([]);
            } finally {
                setIsSearching(false);
            }
        }, 350);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [canSearch, searchText]);

    // Cleanup reverse geocode timeout on unmount
    useEffect(() => {
        return () => {
            if (reverseGeocodeTimeoutRef.current) {
                clearTimeout(reverseGeocodeTimeoutRef.current);
            }
        };
    }, []);

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            return;
        }

        setIsResolvingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const targetLatitude = position.coords.latitude;
                const targetLongitude = position.coords.longitude;
                isProgrammaticUpdateRef.current = true;
                moveMarkerAndMap(targetLatitude, targetLongitude);
                onCoordinatesChange(targetLatitude, targetLongitude);
                // For geolocation, fetch location details immediately without debounce
                void reverseGeocode(targetLatitude, targetLongitude);
                setIsResolvingLocation(false);
            },
            () => {
                setIsResolvingLocation(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    };

    const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
        const targetLatitude = Number(suggestion.lat);
        const targetLongitude = Number(suggestion.lon);

        if (Number.isNaN(targetLatitude) || Number.isNaN(targetLongitude)) {
            return;
        }

        isProgrammaticUpdateRef.current = true;
        setSearchText(suggestion.display_name);
        setSuggestions([]);
        moveMarkerAndMap(targetLatitude, targetLongitude);
        onCoordinatesChange(targetLatitude, targetLongitude);
        // For search selections, fetch location details immediately without debounce
        void reverseGeocode(targetLatitude, targetLongitude);
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search location in India"
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        className="pl-9"
                    />
                    {(isSearching || suggestions.length > 0) && (
                        <div className="absolute z-[1000] mt-1 w-full rounded-md border bg-background shadow-md max-h-56 overflow-y-auto">
                            {isSearching ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                            ) : (
                                suggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.place_id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                    >
                                        {suggestion.display_name}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseCurrentLocation}
                    disabled={isResolvingLocation}
                >
                    <LocateFixed className="w-4 h-4 mr-2" />
                    {isResolvingLocation ? 'Fetching...' : 'Fetch My Location'}
                </Button>
            </div>

            <div ref={containerRef} className="h-72 w-full rounded-lg border" />
        </div>
    );
};

export default LocationPickerMap;