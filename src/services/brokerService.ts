import { get } from './api';
import type { ApiResponse, PaginationInfo } from '@/types';
import { getProfileImageUrl } from '@/lib/utils';

export interface PublicBroker {
    id: number;
    unique_id: string;
    name: string;
    email?: string;
    contact?: string;
    broker_area?: string;
    profile_image?: string;
    registration_date: string;
    room_count: number;
}

export interface PublicBrokerFilters {
    search?: string;
    city?: string;
    minListings?: number;
    sort?: 'top_listed' | 'newest' | 'name_asc' | 'name_desc';
    page?: number;
    limit?: number;
}

export const getPublicBrokers = async (
    filters?: PublicBrokerFilters
): Promise<{ data: PublicBroker[]; pagination: PaginationInfo }> => {
    const params = new URLSearchParams();

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, String(value));
            }
        });
    }

    try {
        const response = await get<ApiResponse<PublicBroker[]>>(`/public/brokers?${params}`);
        const normalizedData = (response.data || []).map((broker) => ({
            ...broker,
            profile_image: getProfileImageUrl(broker.profile_image)
        }));

        return {
            data: normalizedData,
            pagination: response.pagination ?? {
                currentPage: filters?.page ?? 1,
                totalPages: 1,
                totalItems: normalizedData.length,
                itemsPerPage: filters?.limit ?? normalizedData.length,
                hasNextPage: false,
                hasPrevPage: false
            }
        };
    } catch (error: any) {
        if (error?.response?.status !== 404) {
            throw error;
        }

        const legacyParams = new URLSearchParams();
        if (filters?.city) {
            legacyParams.append('city', filters.city);
        }
        legacyParams.append('limit', String(Math.max(filters?.limit ?? 100, 100)));

        const legacyResponse = await get<ApiResponse<PublicBroker[]>>(`/public/brokers/top?${legacyParams}`);
        let legacyData = (legacyResponse.data || []).map((broker) => ({
            ...broker,
            profile_image: getProfileImageUrl(broker.profile_image)
        }));

        if (filters?.search) {
            const keyword = filters.search.toLowerCase().trim();
            legacyData = legacyData.filter((broker) =>
                [broker.name, broker.broker_area, broker.email]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(keyword))
            );
        }

        if ((filters?.minListings ?? 0) > 0) {
            legacyData = legacyData.filter((broker) => (broker.room_count || 0) >= (filters?.minListings || 0));
        }

        const sort = filters?.sort || 'top_listed';
        legacyData.sort((first, second) => {
            if (sort === 'name_asc') {
                return first.name.localeCompare(second.name);
            }

            if (sort === 'name_desc') {
                return second.name.localeCompare(first.name);
            }

            if (sort === 'newest') {
                return new Date(second.registration_date).getTime() - new Date(first.registration_date).getTime();
            }

            return (second.room_count || 0) - (first.room_count || 0);
        });

        const currentPage = Math.max(filters?.page ?? 1, 1);
        const fallbackLimit = legacyData.length > 0 ? legacyData.length : 1;
        const itemsPerPage = Math.max(filters?.limit ?? fallbackLimit, 1);
        const offset = (currentPage - 1) * itemsPerPage;
        const paginatedData = legacyData.slice(offset, offset + itemsPerPage);
        const totalItems = legacyData.length;
        const totalPages = Math.max(Math.ceil(totalItems / itemsPerPage), 1);

        return {
            data: paginatedData,
            pagination: {
                currentPage,
                totalPages,
                totalItems,
                itemsPerPage,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1
            }
        };
    }
};

export const getBrokerById = async (brokerId: number | string): Promise<PublicBroker> => {
    const response = await get<ApiResponse<PublicBroker>>(`/public/brokers/${brokerId}`);
    return {
        ...response.data,
        profile_image: getProfileImageUrl(response.data.profile_image)
    };
};
