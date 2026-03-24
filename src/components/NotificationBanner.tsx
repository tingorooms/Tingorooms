import { useEffect, useState } from 'react';
import { Bell, X, AlertCircle } from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { getNotificationPrefs, setNotificationPrefs } from '@/lib/notificationPreferences';
import { subscribeBrowserPush } from '@/services/pushSubscriptionService';

export default function NotificationBanner() {
  const { settings } = useSiteSettings();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bannerType, setBannerType] = useState<'enable' | 'warning'>('enable');

  const syncBannerByPermission = () => {
    if (!('Notification' in window)) {
      setIsVisible(false);
      return;
    }

    const permission = Notification.permission;
    if (permission === 'granted') {
      setIsVisible(false);
      return;
    }

    setBannerType(permission === 'denied' ? 'warning' : 'enable');
    setIsVisible(true);
  };

  useEffect(() => {
    const timer = setTimeout(syncBannerByPermission, 800);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncBannerByPermission();
      }
    };

    window.addEventListener('focus', syncBannerByPermission);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', syncBannerByPermission);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleEnable = async () => {
    if (!('Notification' in window)) {
      return;
    }

    try {
      setIsLoading(true);

      if (Notification.permission === 'granted') {
        setIsVisible(false);
        return;
      }

      if (Notification.permission === 'denied') {
        setBannerType('warning');
        return;
      }

      const result = await Notification.requestPermission();
      if (result === 'granted') {
        const currentPrefs = getNotificationPrefs();
        setNotificationPrefs({
          ...currentPrefs,
          push: true
        });

        await subscribeBrowserPush();

        const icon = settings.faviconUrl || '/favicon.png';
        new Notification('Notifications Enabled', {
          body: 'You will receive updates for messages and alerts.',
          icon,
        });
        setIsVisible(false);
      } else {
        setBannerType('warning');
        setIsVisible(true);
      }
    } catch {
      setBannerType('warning');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  const isWarning = bannerType === 'warning';
  const bgColor = isWarning
    ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-600/30'
    : 'bg-gradient-to-r from-blue-600 to-blue-600 border-blue-700/30';

  return (
    <div className={`sticky top-0 z-50 left-0 right-0 w-full bg-opacity-95 px-4 py-2.5 shadow-md border-b ${bgColor}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {isWarning ? (
            <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
          ) : (
            <Bell className="w-4 h-4 text-white flex-shrink-0" />
          )}
          <p className="text-sm text-white/95 truncate">
            {isWarning
              ? 'Notifications are blocked. Enable them in browser settings.'
              : 'Enable notifications to stay updated with messages and room requests.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="px-4 py-1.5 bg-white text-blue-600 rounded text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Please wait...' : isWarning ? 'Open Settings' : 'Enable'}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            disabled={isLoading}
            className="p-1 hover:bg-white rounded transition-colors disabled:opacity-50"
            aria-label="Dismiss notification banner"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}