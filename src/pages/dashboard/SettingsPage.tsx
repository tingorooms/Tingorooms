import { useEffect, useState } from 'react';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { messageNotificationService } from '@/services/messageNotificationService';
import {
    defaultNotificationPrefs,
    getNotificationPrefs,
    setNotificationPrefs,
    type NotificationPrefs
} from '@/lib/notificationPreferences';
import { subscribeBrowserPush, unsubscribeBrowserPush } from '@/services/pushSubscriptionService';

const SettingsPage: React.FC = () => {
    const { settings } = useSiteSettings();
    const [notificationPrefs, setNotificationPrefsState] = useState<NotificationPrefs>(defaultNotificationPrefs);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNotificationPrefsState(getNotificationPrefs());
    }, []);

    const persistPrefs = (nextPrefs: NotificationPrefs) => {
        setNotificationPrefsState(nextPrefs);
        setNotificationPrefs(nextPrefs);
    };

    const handleToggleNotification = async (key: keyof NotificationPrefs, checked: boolean) => {
        const currentPrefs = notificationPrefs;

        if (key !== 'push') {
            persistPrefs({
                ...currentPrefs,
                [key]: checked
            });
            return;
        }

        if (!checked) {
            persistPrefs({
                ...currentPrefs,
                push: false
            });
            messageNotificationService.clearAllNotifications();
            await unsubscribeBrowserPush();
            toast.success('Push notifications turned off');
            return;
        }

        if (!('Notification' in window)) {
            toast.error('This browser does not support push notifications');
            return;
        }

        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await messageNotificationService.requestPermission();
        }

        if (permission !== 'granted') {
            persistPrefs({
                ...currentPrefs,
                push: false
            });
            toast.error('Please allow browser notifications to enable push');
            return;
        }

        persistPrefs({
            ...currentPrefs,
            push: true
        });
        const subscribed = await subscribeBrowserPush();
        if (!subscribed) {
            toast.error('Browser push service is not configured yet');
            return;
        }
        toast.success('Push notifications enabled');
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your account settings</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Email Notifications</p>
                                <p className="text-sm text-muted-foreground">Receive updates via email</p>
                            </div>
                        </div>
                        <Switch
                            checked={notificationPrefs.email}
                            onCheckedChange={(checked) => void handleToggleNotification('email', checked)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Chat Notifications</p>
                                <p className="text-sm text-muted-foreground">Get notified of new messages</p>
                            </div>
                        </div>
                        <Switch
                            checked={notificationPrefs.chat}
                            onCheckedChange={(checked) => void handleToggleNotification('chat', checked)}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Bell className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Push Notifications</p>
                                <p className="text-sm text-muted-foreground">Browser push notifications</p>
                            </div>
                        </div>
                        <Switch
                            checked={notificationPrefs.push}
                            onCheckedChange={(checked) => void handleToggleNotification('push', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-red-600">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Delete Account</p>
                            <p className="text-sm text-muted-foreground">Contact support to permanently delete your account</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Support Email: <span className="font-medium text-foreground">{settings.supportEmail}</span>
                            </p>
                        </div>
                        <Button variant="destructive" disabled>Delete</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SettingsPage;
