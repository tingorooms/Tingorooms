import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import ChatMessages from '@/components/chat/ChatMessages';
import ChatInput from '@/components/chat/ChatInput';
import MessagePopup from '@/components/chat/MessagePopup';
import { realtimeChatService } from '@/services/realtimeChatService';
import { messageNotificationService } from '@/services/messageNotificationService';
import { sendMessage, getChatMessages, getChatRooms } from '@/services/chatService';
import type { Message, ChatRoom } from '@/types';

const RealtimeChatRoomPage: React.FC = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    // State
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [typingUsers, setTypingUsers] = useState<Map<number, { name: string; isTyping: boolean }>>(new Map());
    const [recentPopup, setRecentPopup] = useState<{ senderName: string; messagePreview: string } | null>(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);

    // Initialize chat service
    useEffect(() => {
        if (user?.id) {
            realtimeChatService.setCurrentUserId(user.id);
            requestNotificationPermission();
        }
    }, [user?.id]);

    // Load initial chat room and messages
    useEffect(() => {
        if (!chatId || !user?.id) return;

        const loadChatRoom = async () => {
            try {
                setIsLoading(true);
                const chats = await getChatRooms();
                const chat = chats.find(c => c.id === parseInt(chatId));
                
                if (chat) {
                    setChatRoom(chat);
                    // Load messages
                    const initialMessages = await getChatMessages(chatId, 50, 0);
                    setMessages(initialMessages);
                    
                    setError(null);
                } else {
                    setError('Chat room not found');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load chat');
            } finally {
                setIsLoading(false);
            }
        };

        loadChatRoom();
    }, [chatId, user?.id]);



    // Subscribe to realtime updates
    useEffect(() => {
        if (!chatId || !user?.id) return;

        const subscribeToChat = async () => {
            try {
                realtimeChatService.subscribeToChatRoom(
                    chatId,
                    {
                        onMessageReceived: (newMessage: Message) => {
                            setMessages(prev => [...prev, newMessage]);

                            // Don't show popup for own messages
                            if (newMessage.sender_id !== user.id && notificationsEnabled) {
                                showMessagePopup(newMessage);
                            }
                        },
                        onTypingStatusChanged: (userId: number, isTyping: boolean) => {
                            if (userId !== user.id) {
                                setTypingUsers(prev => {
                                    const updated = new Map(prev);
                                    const users = chatRoom?.participant_1 === userId 
                                        ? chatRoom.participant_1_name 
                                        : chatRoom?.participant_2_name;
                                    
                                    if (isTyping) {
                                        updated.set(userId, { name: users || 'Someone', isTyping: true });
                                    } else {
                                        updated.delete(userId);
                                    }
                                    return updated;
                                });
                            }
                        },
                        onReadReceiptChanged: (messageIds: string[]) => {
                            setMessages(prev =>
                                prev.map(msg =>
                                    messageIds.includes(msg.id)
                                        ? { ...msg, is_read: true, read_status: true, delivery_status: 'read' as const }
                                        : msg
                                )
                            );
                        },
                        onError: () => {
                        }
                    },
                    () => {}
                );

                unsubscribeRef.current = async () => {
                    await realtimeChatService.unsubscribeFromChatRoom(chatId);
                };

                return () => {
                    unsubscribeRef.current?.();
                };
            } catch (err) {
            }
        };

        subscribeToChat();

        return () => {
            unsubscribeRef.current?.();
        };
    }, [chatId, user?.id, chatRoom, notificationsEnabled]);

    // Request notification permission
    const requestNotificationPermission = useCallback(async () => {
        const permission = await messageNotificationService.requestPermission();
        if (permission === 'granted') {
            setNotificationsEnabled(true);
        }
    }, []);

    // Show message popup
    const showMessagePopup = (message: Message) => {
        const senderName = message.sender_name || 'Unknown';
        const messagePreview = (message.message || message.message_text || '').substring(0, 100);
        
        setRecentPopup({ senderName, messagePreview });

        // Show desktop notification
        messageNotificationService.showMessageNotification({
            type: 'message',
            senderName,
            senderImage: message.sender_image,
            messagePreview,
            chatRoomId: chatId || '',
            timestamp: new Date(message.created_at || '')
        });
    };

    // Handle send message
    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!chatId || !user?.id) return;

        setIsSending(true);
        setError(null);

        try {
            const newMessage = await sendMessage(chatId, messageText);
            
            const delivery_status: 'sent' | 'read' = newMessage.is_read ? 'read' : 'sent';
            
            const messageWithStatus: Message = {
                ...newMessage,
                delivery_status
            };
            
            setMessages(prev => [...prev, messageWithStatus]);
            
            // Dispatch event for chat list updates
            window.dispatchEvent(new CustomEvent('chat:message-received', {
                detail: { chatRoomId: chatId, message: messageWithStatus }
            }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
            setError(errorMessage);
            throw err;
        } finally {
            setIsSending(false);
        }
    }, [chatId, user?.id]);

    // Handle typing indicator
    const handleTyping = useCallback(async (isTyping: boolean) => {
        if (!chatId) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        await realtimeChatService.sendTypingIndicator(chatId, isTyping);

        if (isTyping) {
            typingTimeoutRef.current = setTimeout(() => {
                realtimeChatService.sendTypingIndicator(chatId, false);
            }, 1000);
        }
    }, [chatId]);

    // Mark messages as read
    const handleMarkAsRead = useCallback(async (messageIds: string[]) => {
        if (!chatId || messageIds.length === 0) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

        try {
            await realtimeChatService.sendReadReceipt(chatId, messageIds);
            setMessages(prev =>
                prev.map(msg =>
                    messageIds.includes(msg.id)
                        ? { ...msg, is_read: true, read_status: true, delivery_status: 'read' }
                        : msg
                )
            );
            const roomIdForEvent = chatRoom?.room_id || chatId;
            window.dispatchEvent(new CustomEvent('chat:messages-read', {
                detail: { chatRoomId: roomIdForEvent }
            }));
        } catch (err) {
        }
    }, [chatId, chatRoom?.room_id]);



    const otherParticipant = chatRoom
        ? {
            name: chatRoom.receiver_name || chatRoom.initiator_name || 'User',
            id: chatRoom.receiver_id || chatRoom.initiator_id
          }
        : null;

    return (
        <div className="w-full h-[calc(100vh-120px)] flex flex-col">
            {/* Chat Header */}
            <div className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-b shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/dashboard/chat')}
                    >
                        <ArrowLeft size={20} />
                    </Button>
                    <div className="min-w-0">
                        {chatRoom && (
                            <>
                                <h2 className="text-lg font-semibold truncate">{otherParticipant?.name}</h2>
                                <p className="text-sm text-gray-500 truncate">{chatRoom.room_title || 'Room Chat'}</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-hidden">
                <ChatMessages
                    messages={messages}
                    currentUserId={user?.id || 0}
                    isLoading={isLoading}
                    error={error}
                    typingUsers={typingUsers}
                    onMarkAsRead={handleMarkAsRead}
                />
            </div>

            {/* Input Area */}
            <ChatInput
                onSendMessage={handleSendMessage}
                onTyping={handleTyping}
                isLoading={isSending}
                disabled={isLoading || !user}
                error={error}
            />

            {/* Message Popup */}
            {recentPopup && (
                <MessagePopup
                    senderName={recentPopup.senderName}
                    messagePreview={recentPopup.messagePreview}
                    chatRoomId={chatId || ''}
                    position="bottom-right"
                    onDismiss={() => setRecentPopup(null)}
                    onClick={() => {
                        setRecentPopup(null);
                        // Scroll to latest message
                        window.scrollTo(0, document.body.scrollHeight);
                    }}
                />
            )}
        </div>
    );
};

export default RealtimeChatRoomPage;
