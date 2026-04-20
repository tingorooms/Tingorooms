import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
    cacheSiteSettings,
    defaultSiteSettings,
    getCachedSiteSettings,
    getProjectSiteSettingsFallback,
    getPublicSiteSettings,
    type SiteSettings
} from '@/services/siteSettingsService';
import { getMediaAssetUrl } from '@/lib/utils';

interface SiteSettingsContextValue {
    settings: SiteSettings;
    isLoading: boolean;
    refreshSettings: (forceRefresh?: boolean) => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | undefined>(undefined);

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<SiteSettings>(() => {
        const cached = getCachedSiteSettings();
        return {
            ...defaultSiteSettings,
            ...(cached || {})
        };
    });
    const [isLoading, setIsLoading] = useState(true);

    const refreshSettings = async (forceRefresh = false) => {
        try {
            const data = await getPublicSiteSettings(forceRefresh);
            const nextSettings = {
                ...defaultSiteSettings,
                ...data
            };
            setSettings(nextSettings);
            cacheSiteSettings(nextSettings);
        } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars

            const localFallback = await getProjectSiteSettingsFallback();
            if (localFallback) {
                const nextSettings = {
                    ...defaultSiteSettings,
                    ...localFallback
                };
                setSettings(nextSettings);
                cacheSiteSettings(nextSettings);
            } else {
                const cached = getCachedSiteSettings();
                setSettings({
                    ...defaultSiteSettings,
                    ...(cached || {})
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void refreshSettings();
    }, []);

    // Update document title based on business name
    useEffect(() => {
        if (settings.businessName) {
            document.title = `${settings.businessName} - ${settings.businessTagline || 'Find Your Perfect Room'}`;
        }
    }, [settings.businessName, settings.businessTagline]);

    // Update favicon dynamically
    useEffect(() => {
        if (!settings.faviconUrl) return;
        const resolvedFaviconUrl = getMediaAssetUrl(settings.faviconUrl) || settings.faviconUrl;

        let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.href = resolvedFaviconUrl;

        // Also update apple-touch-icon
        let appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
        if (!appleTouchIcon) {
            appleTouchIcon = document.createElement('link');
            appleTouchIcon.rel = 'apple-touch-icon';
            document.head.appendChild(appleTouchIcon);
        }
        appleTouchIcon.href = resolvedFaviconUrl;
    }, [settings.faviconUrl]);

    const value = useMemo(
        () => ({ settings, isLoading, refreshSettings }),
        [settings, isLoading]
    );

    return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
};

export const useSiteSettings = () => {
    const context = useContext(SiteSettingsContext);
    if (!context) {
        throw new Error('useSiteSettings must be used within SiteSettingsProvider');
    }
    return context;
};
