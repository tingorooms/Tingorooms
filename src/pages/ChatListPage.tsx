import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getChatRooms } from '@/services/chatService';
import { useAuth } from '@/context/AuthContext';
import { getMediaAssetUrl } from '@/lib/utils';
import type { ChatRoom } from '@/types';

const ChatListPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Debounce timer to prevent rapid refreshes
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRefreshRef = useRef<number>(0);
    const MIN_REFRESH_INTERVAL = 500; // Minimum time between refreshes (ms)

    const loadChatRooms = useCallback(async () => {
        try {
            setIsLoading(true);
            const rooms = await getChatRooms();
            // Sort by most recent first
            const sortedRooms = [...rooms].sort((a, b) => {
                const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                return timeB - timeA;
            });
            setChatRooms(sortedRooms);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load chats');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Debounced refresh function to prevent too many API calls
    const debouncedRefresh = useCallback(() => {
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshRef.current;

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // If enough time has passed, refresh immediately
        if (timeSinceLastRefresh >= MIN_REFRESH_INTERVAL) {
            loadChatRooms();
            lastRefreshRef.current = now;
        } else {
            // Otherwise, schedule a refresh
            debounceTimerRef.current = setTimeout(() => {
                loadChatRooms();
                lastRefreshRef.current = Date.now();
            }, MIN_REFRESH_INTERVAL - timeSinceLastRefresh);
        }
    }, [loadChatRooms]);

    useEffect(() => {
        // Initial load
        loadChatRooms();

        // Listen for message events to refresh the list with debouncing
        const handleMessageEvent = () => {
            debouncedRefresh();
        };

        window.addEventListener('chat:message-received', handleMessageEvent);
        window.addEventListener('chat:messages-read', handleMessageEvent);

        return () => {
            window.removeEventListener('chat:message-received', handleMessageEvent);
            window.removeEventListener('chat:messages-read', handleMessageEvent);
            
            // Clean up timer on unmount
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [loadChatRooms, debouncedRefresh]);

    const handleOpenChat = (chatId: number) => {
        navigate(`/dashboard/chat/${chatId}`);
    };

    return (
        <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Messages</h1>
                        <p className="text-gray-600">Your conversations with room owners and roommates</p>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6 flex items-center gap-2 text-red-700">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </CardContent>
                    </Card>
                )}

                {/* Loading State */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : chatRooms.length === 0 ? (
                    /* Empty State */
                    <Card>
                        <CardContent className="py-12 text-center">
                            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                            <h2 className="text-xl font-semibold mb-2">No conversations yet</h2>
                            <p className="text-gray-600 mb-4">Start chatting with room owners to find your perfect place</p>
                            <Button onClick={() => navigate('/rooms')}>
                                Browse Rooms
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    /* Chat List - All Conversations */
                    <div className="grid grid-cols-1 gap-4">
                        {chatRooms.map((chat) => {
                            const lastMessageTime = chat.last_message_at
                                ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true })
                                : 'No messages yet';

                            const lastMessageText = chat.last_message?.message || chat.last_message?.message_text || '...';

                            // Resolve the "other" participant for avatar/name
                            const p1 = typeof chat.participant_1 === 'object' ? chat.participant_1 : null;
                            const p2 = typeof chat.participant_2 === 'object' ? chat.participant_2 : null;
                            const other = (p1?.id === user?.id) ? p2 : p1;
                            const otherName = other?.name || chat.receiver_name || chat.initiator_name || 'Unknown User';
                            const otherImageUrl = getMediaAssetUrl(other?.profile_image);

                            return (
                                <Card
                                    key={chat.id}
                                    className="cursor-pointer transition-all hover:shadow-lg border border-gray-200"
                                    onClick={() => handleOpenChat(chat.id)}
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            {/* Avatar */}
                                            <div className="relative w-12 h-12 rounded-full flex-shrink-0 overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                                                    {otherName.charAt(0).toUpperCase()}
                                                </div>
                                                {otherImageUrl && (
                                                    <img
                                                        src={otherImageUrl}
                                                        alt={otherName}
                                                        className="absolute inset-0 w-full h-full object-cover"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                )}
                                            </div>

                                            {/* Chat Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold truncate">
                                                        {otherName}
                                                    </h3>
                                                    {(chat.unread_count ?? 0) > 0 && (
                                                        <span className="min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                                            {chat.unread_count}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm truncate text-gray-600">
                                                    {chat.room_title || 'Room Chat'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                    {lastMessageText}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {lastMessageTime}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex-shrink-0 ml-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenChat(chat.id);
                                                }}
                                            >
                                                Open
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    export default ChatListPage;
