import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getNotifications, markAllAsRead, markAsRead } from '@/services/notificationService';
import type { Notification } from '@/types';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
    className?: string;
    iconClassName?: string;
    defaultNavigatePath?: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
    className,
    iconClassName,
    defaultNavigatePath = '/dashboard',
}) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const result = await getNotifications(undefined, 1, 8);
            setNotifications(result.data || []);
            setUnreadCount(result.unreadCount || 0);
        } catch {
            setNotifications([]);
            setUnreadCount(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshNotifications();

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void refreshNotifications();
            }
        }, 30000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refreshNotifications();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshNotifications]);

    const targetPathFor = useCallback(
        (notification: Notification) => {
            if (notification.type === 'Chat_Message') {
                return '/dashboard/chat';
            }

            if (notification.type === 'Broker_Approved') {
                return '/dashboard/plans';
            }

            return defaultNavigatePath;
        },
        [defaultNavigatePath]
    );

    const onNotificationClick = useCallback(
        async (notification: Notification) => {
            if (!notification.is_read) {
                try {
                    await markAsRead(notification.id);
                    setUnreadCount((prev) => Math.max(0, prev - 1));
                    setNotifications((prev) =>
                        prev.map((item) =>
                            item.id === notification.id
                                ? { ...item, is_read: true, read_at: new Date().toISOString() }
                                : item
                        )
                    );
                } catch {
                    // Keep UX responsive even if API fails
                }
            }

            setOpen(false);
            navigate(targetPathFor(notification));
        },
        [navigate, targetPathFor]
    );

    const onMarkAllRead = useCallback(async () => {
        try {
            await markAllAsRead();
            setUnreadCount(0);
            setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
        } catch {
            // no-op
        }
    }, []);

    const hasNotifications = useMemo(() => notifications.length > 0, [notifications]);

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={cn('relative rounded-xl', className)}>
                    <Bell className={cn('h-5 w-5', iconClassName)} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white font-bold flex items-center justify-center ring-2 ring-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b bg-muted/40">
                    <div>
                        <p className="text-sm font-semibold">Notifications</p>
                        <p className="text-xs text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={onMarkAllRead}
                        disabled={unreadCount === 0}
                    >
                        <CheckCheck className="w-4 h-4 mr-1" />
                        Read all
                    </Button>
                </div>

                <div className="max-h-80 overflow-y-auto">
                    {loading && (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading notifications...</div>
                    )}

                    {!loading && !hasNotifications && (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet</div>
                    )}

                    {!loading &&
                        notifications.map((notification, index) => (
                            <div key={notification.id}>
                                <DropdownMenuItem
                                    className={cn(
                                        'items-start gap-0 flex-col px-4 py-3 cursor-pointer',
                                        !notification.is_read && 'bg-green-50/60'
                                    )}
                                    onClick={() => {
                                        void onNotificationClick(notification);
                                    }}
                                >
                                    <div className="w-full flex items-center justify-between gap-2">
                                        <p className={cn('text-sm', !notification.is_read && 'font-semibold')}>
                                            {notification.title}
                                        </p>
                                        {!notification.is_read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 w-full">
                                        {notification.message}
                                    </p>
                                </DropdownMenuItem>
                                {index < notifications.length - 1 && <DropdownMenuSeparator />}
                            </div>
                        ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default NotificationBell;
