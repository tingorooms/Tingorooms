import { get, post, put } from './api';
import type { ApiResponse } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const decodeHtmlEntities = (value = ''): string => value
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&#x3A;/gi, ':')
    .replace(/&#58;/g, ':')
    .replace(/&#x3F;/gi, '?')
    .replace(/&#63;/g, '?')
    .replace(/&#x3D;/gi, '=')
    .replace(/&#61;/g, '=');

const resolveMediaUrl = (url?: string): string => {
    if (!url) return '';
    const decodedUrl = decodeHtmlEntities(url).trim();
    if (!decodedUrl) return '';
    if (/^https?:\/\//i.test(decodedUrl)) return decodedUrl;
    if (decodedUrl.startsWith('/') && !decodedUrl.startsWith('/uploads/')) return decodedUrl;
    if (decodedUrl.startsWith('/')) return `${API_ORIGIN}${decodedUrl}`;
    return `${API_ORIGIN}/${decodedUrl}`;
};

const normalizeSiteSettings = (settings: SiteSettings, preferLocalAssetPaths: boolean = false): SiteSettings => ({
    ...settings,
    logoUrl: preferLocalAssetPaths
        ? decodeHtmlEntities(settings.logoUrl || '').trim()
        : resolveMediaUrl(settings.logoUrl),
    faviconUrl: preferLocalAssetPaths
        ? decodeHtmlEntities(settings.faviconUrl || '').trim()
        : resolveMediaUrl(settings.faviconUrl)
});

export interface SiteSettings {
    businessName: string;
    businessTagline: string;
    supportEmail: string;
    adminEmail: string;
    supportPhone: string;
    logoUrl: string;
    faviconUrl: string;
    supportAddress: string;
    facebookUrl?: string;
    twitterUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
    youtubeUrl?: string;
}

export const defaultSiteSettings: SiteSettings = {
    businessName: 'Tingo Rooms',
    businessTagline: 'Find Rooms • Roomates • Listing',
    supportEmail: 'customer@support.com',
    adminEmail: 'admin@roomrental.com',
    supportPhone: '+91 99999 99999',
    logoUrl: '',
    faviconUrl: '',
    supportAddress: 'Pune, Maharashtra',
    facebookUrl: '',
    twitterUrl: '',
    instagramUrl: '',
    linkedinUrl: '',
    youtubeUrl: ''
};

const SITE_SETTINGS_CACHE_KEY = 'site-settings-cache-v2';
let inMemorySiteSettingsCache: SiteSettings | null = null;

const canUseStorage = (storage: Storage): boolean => {
    try {
        const testKey = '__site_settings_cache_test__';
        storage.setItem(testKey, '1');
        storage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
};

const getPreferredStorage = (): Storage | null => {
    if (typeof window === 'undefined') return null;

    if (canUseStorage(window.localStorage)) {
        return window.localStorage;
    }

    if (canUseStorage(window.sessionStorage)) {
        return window.sessionStorage;
    }

    return null;
};

export const getCachedSiteSettings = (): SiteSettings | null => {
    try {
        const storage = getPreferredStorage();
        const raw = storage?.getItem(SITE_SETTINGS_CACHE_KEY);

        if (!raw && !inMemorySiteSettingsCache) return null;

        if (!raw && inMemorySiteSettingsCache) {
            return normalizeSiteSettings({
                ...defaultSiteSettings,
                ...inMemorySiteSettingsCache
            });
        }

        if (!raw) return null;

        const parsed = JSON.parse(raw) as SiteSettings;
        inMemorySiteSettingsCache = parsed;
        return normalizeSiteSettings({
            ...defaultSiteSettings,
            ...parsed
        });
    } catch (error) {
        return null;
    }
};

export const cacheSiteSettings = (settings: SiteSettings): void => {
    const normalized = {
        ...defaultSiteSettings,
        ...settings
    };

    inMemorySiteSettingsCache = normalized;

    try {
        const storage = getPreferredStorage();
        if (!storage) return;

        storage.setItem(SITE_SETTINGS_CACHE_KEY, JSON.stringify(normalized));
    } catch (error) {
        // Silently fail if storage is unavailable
    }
};

export const getProjectSiteSettingsFallback = async (): Promise<SiteSettings | null> => {
    try {
        const response = await fetch('/site-settings.fallback.json', {
            cache: 'no-cache'
        });

        if (!response.ok) return null;

        const data = (await response.json()) as SiteSettings;
        const normalized = normalizeSiteSettings(data, true);
        cacheSiteSettings(normalized);
        return normalized;
    } catch {
        return null;
    }
};

export const getPublicSiteSettings = async (forceRefresh = false): Promise<SiteSettings> => {
    try {
        const endpoint = forceRefresh
            ? `/public/site-settings?t=${Date.now()}`
            : '/public/site-settings';
        const response = await get<ApiResponse<SiteSettings>>(endpoint);
        const normalized = normalizeSiteSettings(response.data);
        cacheSiteSettings(normalized);
        return normalized;
    } catch (error) {
        const fallback = await getProjectSiteSettingsFallback();
        if (fallback) return fallback;
        throw error;
    }
};

export const getAdminSiteSettings = async (): Promise<SiteSettings> => {
    const response = await get<ApiResponse<SiteSettings>>('/admin/site-settings');
    const normalized = normalizeSiteSettings(response.data);
    cacheSiteSettings(normalized);
    return normalized;
};

export const updateAdminSiteSettings = async (payload: Partial<SiteSettings>): Promise<SiteSettings> => {
    const response = await put<ApiResponse<SiteSettings>>('/admin/site-settings', payload);
    const normalized = normalizeSiteSettings(response.data);
    cacheSiteSettings(normalized);
    return normalized;
};

export const uploadSiteFile = async (fileType: 'logo' | 'favicon', file: File): Promise<SiteSettings> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await post<ApiResponse<SiteSettings>>(
        `/admin/site-settings/upload/${fileType}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    const normalized = normalizeSiteSettings(response.data);
    cacheSiteSettings(normalized);
    return normalized;
};
