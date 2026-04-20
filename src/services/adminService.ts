import { get, put, del } from './api';
import type { ApiResponse, ContactLead, DashboardStats, User, Room, Broker } from '@/types';
import { post, patch } from './api';

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

// Default Ad Card Backgrounds (Admin)
export const getDefaultAdCardBgSearch = async (): Promise<string> => {
    const response = await get<{ success: boolean; url: string }>('/admin/ads/default-bg-search');
    return toAbsoluteAssetUrl(response.url || '');
};

export const getDefaultAdCardBgPost = async (): Promise<string> => {
    const response = await get<{ success: boolean; url: string }>('/admin/ads/default-bg-post');
    return toAbsoluteAssetUrl(response.url || '');
};

export const uploadDefaultAdCardBgSearch = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('defaultBg', file);
    const response = await post<{ success: boolean; url: string }>('/admin/ads/default-bg-search', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return toAbsoluteAssetUrl(response.url || '');
};

export const uploadDefaultAdCardBgPost = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('defaultBg', file);
    const response = await post<{ success: boolean; url: string }>('/admin/ads/default-bg-post', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return toAbsoluteAssetUrl(response.url || '');
};

export const removeDefaultAdCardBgSearch = async (): Promise<void> => {
    await del<{ success: boolean }>('/admin/ads/default-bg-search');
};

export const removeDefaultAdCardBgPost = async (): Promise<void> => {
    await del<{ success: boolean }>('/admin/ads/default-bg-post');
};

interface UsersResponse {
    data: User[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
}

interface RoomsResponse {
    data: Room[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
}

export const getDashboardStats = async (): Promise<{
    stats: DashboardStats;
    todayRegistrations: User[];
    todayRooms: Room[];
    pendingBrokers: Broker[];
    pendingRooms: Room[];
}> => {
    const response = await get<ApiResponse<{
        stats: DashboardStats;
        todayRegistrations: User[];
        todayRooms: Room[];
        pendingBrokers: Broker[];
        pendingRooms: Room[];
    }>>('/admin/dashboard');
    return response.data;
};

export const getAllUsers = async (filters?: { role?: string; status?: string; search?: string; page?: number; limit?: number }): Promise<UsersResponse> => {
    const params = new URLSearchParams();
    
    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
    }

    const response = await get<ApiResponse<User[]>>(`/admin/users?${params}`);
    return {
        data: response.data,
        pagination: response.pagination!
    };
};

export const getUserStats = async (): Promise<{ all: number; active: number; inactive: number; suspended: number }> => {
    const response = await get<ApiResponse<{ all: number; active: number; inactive: number; suspended: number }>>('/admin/users/stats');
    return response.data;
};

export const getUserDetails = async (userId: string | number): Promise<User & { rooms: any[] }> => {
    const response = await get<ApiResponse<User & { rooms: any[] }>>(`/admin/users/${userId}`);
    return response.data;
};

export const updateUserStatus = async (userId: string | number, status: string): Promise<void> => {
    await put<ApiResponse<void>>(`/admin/users/${userId}/status`, { status });
};

export const getPendingBrokers = async (): Promise<Broker[]> => {
    const response = await get<ApiResponse<Broker[]>>('/admin/brokers/pending');
    return response.data;
};

export const getAllBrokers = async (filters?: { status?: string; search?: string }): Promise<Broker[]> => {
    const params = new URLSearchParams();
    
    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.append(key, String(value));
            }
        });
    }

    const response = await get<ApiResponse<Broker[]>>(`/admin/brokers?${params}`);
    return response.data;
};

export const getBrokerStats = async (): Promise<{ all: number; approved: number; pending: number; hold: number; rejected: number }> => {
    const response = await get<ApiResponse<{ all: number; approved: number; pending: number; hold: number; rejected: number }>>('/admin/brokers/stats');
    return response.data;
};

export const updateBrokerStatus = async (brokerId: string | number, status: string, remark?: string, planId?: number, subscriptionDays?: number): Promise<void> => {
    await put<ApiResponse<void>>(`/admin/brokers/${brokerId}/status`, { status, remark, planId, subscriptionDays });
};

export const getBrokerPlans = async (): Promise<any[]> => {
    const response = await get<ApiResponse<any[]>>('/admin/plans?planType=Broker');
    return response.data;
};

export interface AdminPlanPayload {
    plan_name: string;
    plan_code: string;
    plan_type: 'Regular' | 'Broker';
    description?: string;
    price: number;
    duration_days: number;
    features: string[];
    is_active?: boolean;
}

export const getAdminPlans = async (planType: 'all' | 'Regular' | 'Broker' = 'all'): Promise<any[]> => {
    const response = await get<ApiResponse<any[]>>(`/admin/plans?planType=${planType}`);
    return response.data;
};

export const createAdminPlan = async (payload: AdminPlanPayload): Promise<any> => {
    const response = await post<ApiResponse<any>>('/admin/plans', payload);
    return response.data;
};

export const updateAdminPlan = async (planId: number, payload: AdminPlanPayload): Promise<any> => {
    const response = await put<ApiResponse<any>>(`/admin/plans/${planId}`, payload);
    return response.data;
};

export const updateAdminPlanStatus = async (planId: number, is_active: boolean): Promise<any> => {
    const response = await patch<ApiResponse<any>>(`/admin/plans/${planId}/status`, { is_active });
    return response.data;
};

export interface AdminAd {
    id: number;
    banner_title: string;
    description?: string;
    images?: string[];
    priority?: number;
    card_placement?: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    status_display?: 'Running' | 'Scheduled' | 'Expired' | 'Inactive';
    created_at?: string;
    updated_at?: string;
}

export interface AdminAdPayload {
    banner_title: string;
    description?: string;
    images?: string[];
    priority?: number;
    card_placement?: string;
    start_date: string;
    end_date: string;
    is_active?: boolean;
}

const normalizeAdminAdImageUrl = (value: string): string => {
    const decoded = String(value || '')
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x2F;/gi, '/')
        .replace(/&#47;/g, '/')
        .replace(/&#x3A;/gi, ':')
        .replace(/&#58;/g, ':')
        .replace(/&#x3F;/gi, '?')
        .replace(/&#63;/g, '?')
        .replace(/&#x3D;/gi, '=')
        .replace(/&#61;/g, '=');

    return toAbsoluteAssetUrl(decoded);
};

const normalizeAdminAd = (ad: AdminAd): AdminAd => ({
    ...ad,
    images: (ad.images || []).map((imageUrl) => normalizeAdminAdImageUrl(imageUrl)).filter(Boolean)
});

export const getAdminAds = async (): Promise<AdminAd[]> => {
    const response = await get<ApiResponse<AdminAd[]>>('/admin/ads');
    return (response.data || []).map(normalizeAdminAd);
};

export const createAdminAd = async (payload: AdminAdPayload): Promise<AdminAd> => {
    const response = await post<ApiResponse<AdminAd>>('/admin/ads', payload);
    return normalizeAdminAd(response.data);
};

export const updateAdminAd = async (adId: number, payload: AdminAdPayload): Promise<AdminAd> => {
    const response = await put<ApiResponse<AdminAd>>(`/admin/ads/${adId}`, payload);
    return normalizeAdminAd(response.data);
};

export const updateAdminAdStatus = async (adId: number, is_active: boolean): Promise<AdminAd> => {
    const response = await patch<ApiResponse<AdminAd>>(`/admin/ads/${adId}/status`, { is_active });
    return normalizeAdminAd(response.data);
};

export const uploadAdminAdImages = async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((file) => {
        formData.append('images', file);
    });

    const response = await post<ApiResponse<{ imageUrls: string[] }>>('/admin/ads/upload-images', formData);
    return response.data.imageUrls;
};

export const getRoomStats = async (): Promise<{ approved_count: number; pending_count: number; hold_count: number; rejected_count: number; total_count: number }> => {
    const response = await get<ApiResponse<any>>('/admin/rooms/stats');
    return response.data;
};

export const getAllRooms = async (filters?: { status?: string; listingType?: string; city?: string; search?: string; page?: number; limit?: number }): Promise<RoomsResponse> => {
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
        data: response.data,
        pagination: response.pagination!
    };
};

export const getRoomDetails = async (roomId: string): Promise<Room> => {
    const response = await get<ApiResponse<Room>>(`/admin/rooms/${roomId}`);
    return response.data;
};

export const updateRoomStatus = async (roomId: string, status: string, remark?: string): Promise<void> => {
    await put<ApiResponse<void>>(`/admin/rooms/${roomId}/status`, { status, remark });
};

export interface ReportSeriesPoint {
    date: string;
    count: number;
    total?: number;
}

export interface AdminReportsData {
    registrations?: ReportSeriesPoint[];
    rooms?: ReportSeriesPoint[];
    expenses?: ReportSeriesPoint[];
}

export const getReports = async (
    type: 'all' | 'registrations' | 'rooms' | 'expenses',
    startDate?: string,
    endDate?: string
): Promise<AdminReportsData> => {
    const params = new URLSearchParams();
    params.append('type', type);

    if (startDate) {
        params.append('startDate', startDate);
    }

    if (endDate) {
        params.append('endDate', endDate);
    }

    const response = await get<ApiResponse<AdminReportsData>>(`/admin/reports?${params.toString()}`);
    return response.data;
};

export const getCities = async (): Promise<{ city_name: string; district: string }[]> => {
    const response = await get<ApiResponse<{ city_name: string; district: string }[]>>('/admin/cities');
    return response.data;
};

export interface SubscriptionUpgradeRequest {
    id: number;
    user_id: number;
    broker_unique_id: string;
    broker_name: string;
    broker_email: string;
    current_plan_id: number | null;
    current_plan_name: string | null;
    requested_plan_id: number;
    requested_plan_name: string;
    requested_duration_days: number;
    amount_paid: number;
    starts_at: string;
    expires_at: string;
    created_at: string;
    request_type: 'Upgrade' | 'Renewal';
    effective_starts_at?: string;
    effective_expires_at?: string;
    carry_forward_days?: number;
    admin_remark?: string | null;
}

export interface UpgradeDecisionPayload {
    plan_id?: number;
    starts_at?: string;
    expires_at?: string;
    remark?: string;
    admin_remark?: string;
}

const isNotFoundResponse = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const maybeStatus = (error as { response?: { status?: number } }).response?.status;
    return maybeStatus === 404;
};

export const getSubscriptionUpgradeRequests = async (): Promise<SubscriptionUpgradeRequest[]> => {
    try {
        const response = await get<ApiResponse<SubscriptionUpgradeRequest[]>>('/admin/subscription-upgrade-requests');
        return response.data;
    } catch (error) {
        if (!isNotFoundResponse(error)) {
            throw error;
        }

        const fallbackResponse = await get<ApiResponse<SubscriptionUpgradeRequest[]>>('/admin/subscription-upgrade-request');
        return fallbackResponse.data;
    }
};

export const decideSubscriptionUpgradeRequest = async (
    requestId: number,
    status: 'Completed' | 'Failed',
    payload?: UpgradeDecisionPayload
): Promise<void> => {
    const normalizedRemark = payload?.remark ?? payload?.admin_remark;
    const body = {
        status,
        ...(payload || {}),
        ...(normalizedRemark !== undefined ? { remark: normalizedRemark, admin_remark: normalizedRemark } : {})
    };

    try {
        await put<ApiResponse<void>>(`/admin/subscription-upgrade-requests/${requestId}/decision`, body);
    } catch (error) {
        if (!isNotFoundResponse(error)) {
            throw error;
        }

        await put<ApiResponse<void>>(`/admin/subscription-upgrade-request/${requestId}/decision`, body);
    }
};

// Broker Subscription Management
export interface BrokerSubscription {
    id: number;
    user_id: number;
    plan_id: number;
    amount_paid: number;
    starts_at: string;
    expires_at: string;
    payment_status: 'Pending' | 'Completed' | 'Rejected' | 'Suspended' | 'Refunded';
    transaction_id?: string;
    admin_remark?: string;
    created_at: string;
    broker_unique_id: string;
    broker_name: string;
    broker_email: string;
    broker_contact: string;
    plan_name: string;
    plan_price: number;
    duration_days: number;
    status_display: string;
}

export interface BrokerSubscriptionsResponse {
    data: BrokerSubscription[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface ContactLeadStats {
    total: number;
    valid: number;
    new: number;
    in_progress: number;
    closed: number;
    spam: number;
}

export interface ContactLeadsResponse {
    data: ContactLead[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

export const getContactLeadStats = async (): Promise<ContactLeadStats> => {
    const response = await get<ApiResponse<ContactLeadStats>>('/admin/leads/stats');
    return response.data;
};

export const getContactLeads = async (filters?: {
    status?: string;
    search?: string;
    spam?: string;
    page?: number;
    limit?: number;
}): Promise<ContactLeadsResponse> => {
    const params = new URLSearchParams();

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, String(value));
            }
        });
    }

    const response = await get<ApiResponse<ContactLead[]>>(`/admin/leads?${params.toString()}`);

    return {
        data: response.data,
        pagination: response.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalItems: response.data.length,
            itemsPerPage: response.data.length,
            hasNextPage: false,
            hasPrevPage: false,
        }
    };
};

export const updateContactLeadStatus = async (
    leadId: number,
    status: ContactLead['status'],
    adminRemark?: string
): Promise<void> => {
    await put<ApiResponse<void>>(`/admin/leads/${leadId}/status`, { status, adminRemark });
};

export const getBrokerSubscriptions = async (filters?: { 
    status?: string; 
    search?: string; 
    page?: number; 
    limit?: number 
}): Promise<BrokerSubscriptionsResponse> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await get<ApiResponse<BrokerSubscription[]>>(
        `/admin/broker-subscriptions?${params.toString()}`
    );
    
    return {
        data: response.data,
        pagination: response.pagination ? {
            page: response.pagination.currentPage,
            limit: response.pagination.itemsPerPage,
            total: response.pagination.totalItems,
            totalPages: response.pagination.totalPages
        } : {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0
        }
    };
};

export const getBrokerSubscriptionsByUserId = async (userId: number): Promise<BrokerSubscription[]> => {
    const response = await get<ApiResponse<BrokerSubscription[]>>(
        `/admin/broker-subscriptions/user/${userId}`
    );
    return response.data;
};

export interface UpdateSubscriptionPayload {
    plan_id?: number;
    starts_at?: string;
    expires_at?: string;
    payment_status?: 'Pending' | 'Completed' | 'Rejected' | 'Suspended' | 'Refunded';
    admin_remark?: string;
}

export const updateBrokerSubscription = async (
    subscriptionId: number,
    payload: UpdateSubscriptionPayload
): Promise<void> => {
    await put<ApiResponse<void>>(`/admin/broker-subscriptions/${subscriptionId}`, payload);
};

