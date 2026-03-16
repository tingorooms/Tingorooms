import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { getNotificationPrefs, setNotificationPrefs } from '@/lib/notificationPreferences';
import { subscribeBrowserPush } from '@/services/pushSubscriptionService';

const NOTIFICATION_PERMISSION_KEY = 'notification_permission_asked';

export default function NotificationPermissionModal() {
  const { settings } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if permission was already requested
    const hasAskedBefore = localStorage.getItem(NOTIFICATION_PERMISSION_KEY);
    
    // Only show modal if:
    // 1. Permission hasn't been asked before
    // 2. Notification API is supported
    // 3. Current permission is 'default' (not yet granted or denied)
    if (!hasAskedBefore && 'Notification' in window && Notification.permission === 'default') {
      // Small delay to ensure page is fully loaded
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        // Mark that we've asked for permission
        localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
        
        if (permission === 'granted') {
          const currentPrefs = getNotificationPrefs();
          setNotificationPrefs({
            ...currentPrefs,
            push: true
          });

          await subscribeBrowserPush();

          // Show a test notification with dynamic icon
          const notificationIcon = settings.faviconUrl || '/favicon.png';
          new Notification('Notifications Enabled! 🎉', {
            body: 'You will now receive notifications for messages and updates.',
            icon: notificationIcon,
          });
        }
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
      setOpen(false);
    }
  };

  const handleDismiss = () => {
    // Mark that we've asked even if user dismissed it
    localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
              <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <DialogTitle className="text-xl">Stay Updated with Notifications</DialogTitle>
          <DialogDescription className="pt-2 text-base">
            Get instant notifications for new messages, room updates, and important announcements. You can disable this anytime in your settings.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-3 sm:flex-row pt-4">
          <Button
            variant="outline"
            onClick={handleDismiss}
            disabled={isLoading}
            className="flex-1"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Enabling...' : 'Enable Notifications'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
