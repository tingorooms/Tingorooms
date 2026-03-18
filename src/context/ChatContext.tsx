import React, { Suspense, createContext, lazy, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getChatRooms, getOrCreateChatRoom } from '@/services/chatService';
import { getNotificationPrefs } from '@/lib/notificationPreferences';
import { useAuth } from './AuthContext';
import type { ChatRoom, Room, Message } from '@/types';

const ChatModal = lazy(() => import('@/components/chat/ChatModal'));
const MessagePopup = lazy(() => import('@/components/chat/MessagePopup'));

// Pre-warm these chunks when the user is authenticated so the first open is instant
const prefetchChatChunks = () => {
    void import('@/components/chat/ChatModal');
    void import('@/components/chat/MessagePopup');
    void import('@/services/realtimeChatService');
    void import('@/services/messageNotificationService');
};

interface ChatContextType {
    openChat: (roomListingId: number, receiverId: number, room?: Room) => Promise<void>;
    openExistingChat: (chatRoom: ChatRoom) => void;
    openChatByRoomId: (chatRoomId: string) => Promise<void>;
    closeChat: () => void;
    isLoading: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
    const [room, setRoom] = useState<Room | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const isOpenRef = useRef(false);
    const activeChatRoomRef = useRef<string | null>(null);

    // Pre-warm lazy chunks as soon as user is authenticated
    useEffect(() => {
        if (user) prefetchChatChunks();
    }, [!!user]);
    const realtimeServiceRef = useRef<{
        setCurrentUserId: (userId: number) => void;
        subscribeToChatRoom: (chatRoomId: string, callbacks: {
            onMessageReceived?: (message: Message) => void;
            onTypingStatusChanged?: (userId: number, isTyping: boolean) => void;
            onReadReceiptChanged?: (messageIds: string[]) => void;
            onError?: (error: Error) => void;
        }) => unknown;
        getActiveChannels: () => string[];
        unsubscribeFromChatRoom: (chatRoomId: string) => Promise<void>;
    } | null>(null);
    const notificationServiceRef = useRef<{
        showMessageNotification: (payload: {
            type: 'message' | 'read_receipt' | 'typing' | 'online' | 'offline';
            senderName: string;
            senderImage?: string;
            messagePreview?: string;
            chatRoomId: string;
            timestamp: Date;
        }) => Promise<void>;
    } | null>(null);
    const [popupData, setPopupData] = useState<{
        senderName: string;
        senderImage?: string;
        messagePreview: string;
        chatRoomId: string;
        timestamp: Date;
    } | null>(null);

    const ensureRealtimeServicesLoaded = async () => {
        if (realtimeServiceRef.current && notificationServiceRef.current) {
            return {
                realtimeChatService: realtimeServiceRef.current,
                messageNotificationService: notificationServiceRef.current,
            };
        }

        const [{ realtimeChatService }, { messageNotificationService }] = await Promise.all([
            import('@/services/realtimeChatService'),
            import('@/services/messageNotificationService'),
        ]);

        realtimeServiceRef.current = realtimeChatService;
        notificationServiceRef.current = messageNotificationService;

        return { realtimeChatService, messageNotificationService };
    };

    const openChat = async (roomListingId: number, receiverId: number, roomData?: Room) => {
        try {
            setIsLoading(true);
            const chatRoomData = await getOrCreateChatRoom(roomListingId, receiverId);
            setChatRoom(chatRoomData);
            activeChatRoomRef.current = chatRoomData.room_id ?? null;
            if (roomData) {
                setRoom(roomData);
            }
            setIsOpen(true);
        } catch (error) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const openExistingChat = (existingRoom: ChatRoom) => {
        setChatRoom(existingRoom);
        activeChatRoomRef.current = existingRoom.room_id ?? null;
        setRoom(existingRoom.room_details || null);
        setIsOpen(true);
    };

    const openChatByRoomId = async (chatRoomId: string) => {
        try {
            setIsLoading(true);
            const rooms = await getChatRooms();
            const matched = rooms.find(roomItem => roomItem.room_id === chatRoomId);

            if (!matched) {
                throw new Error('Chat room not found');
            }

            openExistingChat(matched);
        } finally {
            setIsLoading(false);
        }
    };

    const closeChat = () => {
        setIsOpen(false);
        activeChatRoomRef.current = null;
        // Don't clear chatRoom immediately to allow smooth closing animation
        setTimeout(() => {
            setChatRoom(null);
            setRoom(null);
        }, 200);
    };

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    // Setup global notification listeners
    useEffect(() => {
        if (!user?.id) return;

        const idleApi = globalThis as typeof globalThis & {
            requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
            cancelIdleCallback?: (handle: number) => void;
        };
        let timeoutId: number | undefined;
        let idleId: number | undefined;
        let isCancelled = false;

        const setupGlobalNotifications = async () => {
            try {
                if (isCancelled) return;

                const { realtimeChatService, messageNotificationService } = await ensureRealtimeServicesLoaded();
                if (isCancelled) return;

                // Warm service once so first message popup remains instant after idle setup.
                void messageNotificationService;

                // Set current user for notifications
                realtimeChatService.setCurrentUserId(user.id);

                // Get all chat rooms and subscribe for notifications
                const chatRooms = await getChatRooms();
                if (isCancelled) return;
                
                chatRooms.forEach((chatRoom) => {
                    if (chatRoom.room_id) {
                        // Avoid overriding active chat room subscription callbacks
                        if (activeChatRoomRef.current === chatRoom.room_id) {
                            return;
                        }

                        // Subscribe to each chat room
                        realtimeChatService.subscribeToChatRoom(
                            chatRoom.room_id,
                            {
                                onMessageReceived: (newMessage: Message) => {
                                    // Don't show popup or notification for own messages
                                    if (newMessage.sender_id !== user?.id) {
                                        // Skip notification if this message is from the currently active chat room
                                        const isFromActiveChatRoom = isOpenRef.current && activeChatRoomRef.current === newMessage.chat_room_id;
                                        
                                        // Show notification only if NOT from the current active chat
                                        if (!isFromActiveChatRoom && chatRoom.room_id) {
                                            void messageNotificationService.showMessageNotification({
                                                type: 'message',
                                                senderName: newMessage.sender_name || 'Unknown',
                                                senderImage: newMessage.sender_image,
                                                messagePreview: (newMessage.message || '').substring(0, 100),
                                                chatRoomId: chatRoom.room_id,
                                                timestamp: new Date(newMessage.created_at || '')
                                            });
                                        }

                                        // Emit event to refresh unread counts in ChatListPage
                                        window.dispatchEvent(new CustomEvent('chat:message-received', {
                                            detail: { chatRoomId: chatRoom.room_id }
                                        }));
                                    }
                                }
                            }
                        );
                    }
                });
            } catch (error) {

            }
        };

        if (typeof idleApi.requestIdleCallback === 'function') {
            idleId = idleApi.requestIdleCallback(() => {
                void setupGlobalNotifications();
            }, { timeout: 2000 });
        } else {
            timeoutId = window.setTimeout(() => {
                void setupGlobalNotifications();
            }, 900);
        }

        // Cleanup subscriptions on unmount
        return () => {
            isCancelled = true;
            if (typeof idleId === 'number') {
                idleApi.cancelIdleCallback?.(idleId);
            }
            if (typeof timeoutId === 'number') {
                window.clearTimeout(timeoutId);
            }

            // Unsubscribe from all chat rooms
            const realtimeChatService = realtimeServiceRef.current;
            if (!realtimeChatService) {
                return;
            }

            realtimeChatService.getActiveChannels().forEach((channelName) => {
                const chatRoomId = channelName.replace('chat:', '');
                void realtimeChatService.unsubscribeFromChatRoom(chatRoomId);
            });
        };
    }, [user?.id]);

    // Listen for in-app notification events
    useEffect(() => {
        const handleInAppNotification = (event: Event) => {
            const prefs = getNotificationPrefs();
            if (!prefs.chat || isOpenRef.current) {
                return;
            }
            const customEvent = event as CustomEvent;
            setPopupData(customEvent.detail);
        };

        window.addEventListener('chat:inapp-notification', handleInAppNotification as EventListener);

        return () => {
            window.removeEventListener('chat:inapp-notification', handleInAppNotification as EventListener);
        };
    }, []);

    return (
        <ChatContext.Provider value={{ openChat, openExistingChat, openChatByRoomId, closeChat, isLoading }}>
            {children}
            <Suspense fallback={null}>
                <ChatModal
                    isOpen={isOpen}
                    onClose={closeChat}
                    chatRoom={chatRoom}
                    room={room}
                />
                {popupData && (
                    <MessagePopup
                        senderName={popupData.senderName}
                        senderImage={popupData.senderImage}
                        messagePreview={popupData.messagePreview}
                        chatRoomId={popupData.chatRoomId}
                        position="bottom-right"
                        onDismiss={() => setPopupData(null)}
                        onClick={() => {
                            setPopupData(null);
                            openChatByRoomId(popupData.chatRoomId);
                        }}
                    />
                )}
            </Suspense>
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
