import { get, post, put, del } from './api';
import type { AxiosRequestConfig } from 'axios';
import type { ApiResponse, Room, RoomFilters, PaginationInfo } from '@/types';

interface RoomsResponse {
    data: Room[];
    pagination: PaginationInfo;
}

const decodeHtmlEntities = (value: string): string => {
    return value
        .replace(/&#x2F;/gi, '/')
        .replace(/&#x3A;/gi, ':')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, '&');
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const toAbsoluteAssetUrl = (url: string): string => {
    const trimmedUrl = String(url || '').trim();
    if (!trimmedUrl) return '';
    if (/^https?:\/\//i.test(trimmedUrl)) return trimmedUrl;
    if (!trimmedUrl.startsWith('/')) return trimmedUrl;

    try {
        const apiUrl = new URL(API_BASE_URL);
        return `${apiUrl.origin}${trimmedUrl}`;
    } catch {
        return trimmedUrl;
    }
};

const toStringArray = (value: unknown): string[] => {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value
            .map((item) => String(item ?? '').trim())
            .filter(Boolean)
            .map((item) => decodeHtmlEntities(item));
    }

    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (!trimmedValue) return [];

        try {
            const parsed = JSON.parse(trimmedValue);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item) => String(item ?? '').trim())
                    .filter(Boolean)
                    .map((item) => decodeHtmlEntities(item));
            }

            if (parsed && typeof parsed === 'object') {
                return Object.values(parsed as Record<string, unknown>)
                    .map((item) => String(item ?? '').trim())
                    .filter(Boolean)
                    .map((item) => decodeHtmlEntities(item));
            }
        } catch {
            return trimmedValue
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
                .map((item) => decodeHtmlEntities(item));
        }
    }

    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>)
            .map((item) => String(item ?? '').trim())
            .filter(Boolean)
            .map((item) => decodeHtmlEntities(item));
    }

    return [];
};

const normalizeRoom = (room: Room): Room => {
    return {
        ...room,
        facilities: toStringArray((room as unknown as { facilities?: unknown }).facilities),
        images: toStringArray((room as unknown as { images?: unknown }).images),
    };
};

const normalizeRooms = (rooms: Room[]): Room[] => rooms.map(normalizeRoom);

export interface PublicAd {
    id: number;
    banner_title: string;
    description?: string;
    images?: string[];
    priority?: number;
    card_placement?: string;
    start_date: string;
    end_date: string;
}

const normalizeAdImageUrl = (value: string): string => {
    const decoded = decodeHtmlEntities(String(value || '').trim())
        .replace(/^['"]+|['"]+$/g, '');
    return toAbsoluteAssetUrl(decoded);
};

const normalizePublicAds = (ads: PublicAd[]): PublicAd[] => {
    return (ads || []).map((ad) => ({
        ...ad,
        images: (ad.images || []).map((imageUrl) => normalizeAdImageUrl(imageUrl)).filter(Boolean)
    }));
};

export const getRooms = async (
    filters?: RoomFilters & { page?: number; limit?: number },
    requestConfig?: AxiosRequestConfig
): Promise<RoomsResponse> => {
    const params = new URLSearchParams();
    
    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, String(value));
            }
        });
    }

    const response = await get<ApiResponse<Room[]>>(`/public/rooms?${params}`, requestConfig);
    return {
        data: normalizeRooms(response.data || []),
        pagination: response.pagination!
    };
};

export const getRoomById = async (roomId: string): Promise<Room> => {
    const response = await get<ApiResponse<Room>>(`/public/rooms/${roomId}`);
    return normalizeRoom(response.data);
};

export const getRoomForEditing = async (roomId: string): Promise<Room> => {
    const response = await get<ApiResponse<Room>>(`/rooms/my-room/${roomId}`);
    return normalizeRoom(response.data);
};

export const getRoomByIdWithOwnerAccess = async (roomId: string): Promise<Room> => {
    try {
        // Try public endpoint first to avoid noisy owner-route 404s for normal visitors.
        const response = await get<ApiResponse<Room>>(`/public/rooms/${roomId}`);
        return normalizeRoom(response.data);
    } catch {
        // Fall back to owner endpoint for logged-in owner viewing non-public statuses.
        const response = await get<ApiResponse<Room>>(`/rooms/my-room/${roomId}`);
        return normalizeRoom(response.data);
    }
};

export const getMyRooms = async (status?: string, page = 1, limit = 10): Promise<RoomsResponse> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('page', String(page));
    params.append('limit', String(limit));

    const response = await get<ApiResponse<Room[]>>(`/rooms/my-rooms?${params}`);
    return {
        data: normalizeRooms(response.data || []),
        pagination: response.pagination!
    };
};

type CreateRoomPayload = {
    listingType: 'For Rent' | 'Required Roommate' | 'For Sell';
    roomType: '1RK' | '1BHK' | '2BHK' | '3BHK' | '4BHK' | 'PG' | 'Dormitory' | 'Studio' | 'Other';
    houseType: 'Flat' | 'Apartment' | 'House';
    title: string;
    availabilityFrom: string;
    latitude: number;
    longitude: number;
    city: string;
    area: string;
    address: string;
    pincode: string;
    contact: string;
    contactVisibility: 'Private' | 'Public';
    furnishingType: 'Furnished' | 'Semi-furnished' | 'Unfurnished';
    planType: string;
    rent?: number;
    deposit?: number;
    cost?: number;
    sizeSqft?: number;
    email?: string;
    preferredGender?: 'Male' | 'Female' | 'Any';
    facilities?: string[];
    note?: string;
    planAmount?: number;
    postWithoutSubscription?: boolean;
    existingRoommates?: { name: string; city: string }[];
    images?: string[];
};

export const createRoom = async (data: CreateRoomPayload): Promise<{ roomId: string; dbId: number; status: string }> => {
    const response = await post<ApiResponse<{ roomId: string; dbId: number; status: string }>>('/rooms', data);
    return response.data;
};

export const updateRoom = async (roomId: string, data: Partial<Room>): Promise<void> => {
    await put<ApiResponse<void>>(`/rooms/${roomId}`, data);
};

export const deleteRoom = async (roomId: string): Promise<void> => {
    await del<ApiResponse<void>>(`/rooms/${roomId}`);
};

export const markRoomOccupied = async (roomId: string, isOccupied: boolean = true): Promise<void> => {
    const encodedRoomId = encodeURIComponent(roomId);

    try {
        await put<ApiResponse<void>>(`/rooms/${encodedRoomId}/occupancy`, { isOccupied });
    } catch (error: any) {
        // Backward compatibility for older backend without occupancy route
        if (isOccupied && error?.response?.status === 404) {
            await put<ApiResponse<void>>(`/rooms/${encodedRoomId}/mark-occupied`, {});
            return;
        }
        throw error;
    }
};

export const uploadRoomImages = async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach(file => {
        formData.append('images', file);
    });

    const response = await post<ApiResponse<{ imageUrls: string[] }>>('/rooms/upload-images', formData);
    return response.data.imageUrls;
};

export const getFacilities = async (): Promise<string[]> => {
    const response = await get<ApiResponse<string[]>>('/public/facilities');
    return response.data;
};

export const getCities = async (): Promise<{ city_name: string; district: string; room_count?: number }[]> => {
    const response = await get<ApiResponse<{ city_name: string; district: string; room_count?: number }[]>>('/public/cities');
    return response.data;
};

export const getAreasByCity = async (city: string): Promise<{ area: string; room_count: number }[]> => {
    const response = await get<ApiResponse<{ area: string; room_count: number }[]>>(`/public/areas/${city}`);
    return response.data;
};

export const getRoomTypes = async (): Promise<{ room_type: string; count: number }[]> => {
    const response = await get<ApiResponse<{ room_type: string; count: number }[]>>('/public/room-types');
    return response.data;
};

export const getListingTypes = async (): Promise<{ listing_type: string; count: number }[]> => {
    const response = await get<ApiResponse<{ listing_type: string; count: number }[]>>('/public/listing-types');
    return response.data;
};

export const getPublicSupportEmail = async (): Promise<string> => {
    const response = await get<ApiResponse<{ supportEmail: string }>>('/public/support-email');
    return response.data.supportEmail;
};

export const getActiveAds = async (): Promise<PublicAd[]> => {
    const response = await get<ApiResponse<PublicAd[]>>('/public/ads/active');
    return normalizePublicAds(response.data || []);
};

export const incrementViewCount = async (roomId: string): Promise<void> => {
    await post<ApiResponse<void>>(`/rooms/${roomId}/view`, {});
};

// Admin functions
export const getAllRoomsAdmin = async (filters?: any): Promise<RoomsResponse> => {
    const params = new URLSearchParams();
    
    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
    }

    const response = await get<ApiResponse<Room[]>>(`/admin/rooms?${params}`);
    return {
        data: normalizeRooms(response.data || []),
        pagination: response.pagination!
    };
};

export const updateRoomStatus = async (roomId: string, status: string, remark?: string): Promise<void> => {
    await put<ApiResponse<void>>(`/admin/rooms/${roomId}/status`, { status, remark });
};

export const getRoomStats = async (): Promise<any> => {
    const response = await get<ApiResponse<any>>('/admin/rooms/stats/overview');
    return response.data;
};
