import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, X, Star } from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { getCachedChatRooms, getChatRooms, getUnreadCount, starChat, unstarChat } from '@/services/chatService';
import type { ChatRoom } from '@/types';
import { getProfileImageUrl } from '@/lib/utils';

const FloatingChatButton: React.FC = () => {
    const { openExistingChat } = useChat();
    const { user: currentUser, isAuthenticated } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(false);

    const refreshUnreadCount = useCallback(async () => {
        try {
            const data = await getUnreadCount();
            setUnreadCount(data.unreadCount || 0);
        } catch {
        }
    }, []);

    const loadChatRooms = useCallback(async (showLoader = false) => {
        try {
            if (showLoader) {
                setLoading(true);
            }
            const rooms = await getChatRooms();
            setChatRooms(rooms);

            const totalUnread = rooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);
            setUnreadCount(totalUnread);
        } catch {
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }, []);

    const openDropdownWithWarmData = useCallback(() => {
        const cachedRooms = getCachedChatRooms();

        if (cachedRooms && cachedRooms.length > 0) {
            setChatRooms(cachedRooms);
            const totalUnread = cachedRooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);
            setUnreadCount(totalUnread);
            setLoading(false);
        } else {
            setLoading(true);
        }

        setShowDropdown(true);
        void loadChatRooms(false);
    }, [loadChatRooms]);

    // Load chat badge and rooms with route-friendly polling strategy.
    useEffect(() => {
        if (!isAuthenticated) {
            setChatRooms([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        if (showDropdown) {
            void loadChatRooms(false);
        } else {
            void refreshUnreadCount();
        }

        // Refresh every 10 seconds
        const interval = setInterval(() => {
            if (document.visibilityState !== 'visible') {
                return;
            }
            if (showDropdown) {
                void loadChatRooms(false);
            } else {
                void refreshUnreadCount();
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [isAuthenticated, currentUser?.id, showDropdown, loadChatRooms, refreshUnreadCount]);

    const handleChatClick = (room: ChatRoom) => {
        openExistingChat(room);
        setShowDropdown(false);
    };

    const handleStarClick = async (e: React.MouseEvent, room: ChatRoom) => {
        e.stopPropagation();
        try {
            const starredCount = chatRooms.filter(r => r.is_starred).length;
            
            if (!room.is_starred && starredCount >= 5) {
                alert('You can only star up to 5 conversations');
                return;
            }

            if (room.is_starred) {
                const updatedRoom = await unstarChat(room.room_id!);
                setChatRooms(chatRooms.map(r => r.room_id === room.room_id ? updatedRoom : r));
            } else {
                const updatedRoom = await starChat(room.room_id!);
                setChatRooms(chatRooms.map(r => r.room_id === room.room_id ? updatedRoom : r));
            }
        } catch (error) {
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
            {/* Dropdown Menu */}
            {showDropdown && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-72 max-h-96 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            <MessageCircle size={18} />
                            Messages
                        </h3>
                        <button
                            onClick={() => setShowDropdown(false)}
                            className="text-white hover:bg-white p-1 rounded transition-colors"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Chat List */}
                    <div className="overflow-y-auto flex-1 divide-y">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto" />
                            </div>
                        ) : chatRooms.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">
                                No conversations yet
                            </div>
                        ) : (
                            (() => {
                                const sortedRooms = [...chatRooms].sort((a, b) => {
                                    if (a.is_starred && !b.is_starred) return -1;
                                    if (!a.is_starred && b.is_starred) return 1;
                                    return 0;
                                });

                                return sortedRooms.map((room) => {
                                    // Determine which participant is the other person
                                    const participant1 = typeof room.participant_1 === 'object' ? room.participant_1 : null;
                                    const participant2 = typeof room.participant_2 === 'object' ? room.participant_2 : null;
                                    
                                    const otherParticipant = 
                                        participant1?.id !== currentUser?.id ? participant1 : participant2;
                                    
                                    const userName = otherParticipant?.name || 'Unknown User';
                                    const roomTitle = room.room_details?.title || room.room_title || 'Unknown Room';
                                    const profileImage = otherParticipant?.profile_image;
                                    const unreadCount = room.unread_count || 0;
                                    
                                    return (
                                        <div
                                            key={room.room_id}
                                            className="w-full p-3 hover:bg-gray-50 transition-colors text-left flex items-center gap-3 group cursor-pointer"
                                            onClick={() => handleChatClick(room)}
                                        >
                                            {/* Profile Image */}
                                            <div className="flex-shrink-0">
                                                {profileImage ? (
                                                    <img 
                                                        src={getProfileImageUrl(profileImage)} 
                                                        alt={userName}
                                                        className="w-12 h-12 rounded-full object-cover border border-gray-200"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                                        {userName.charAt(0)?.toUpperCase() || 'U'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 truncate">
                                                    {userName}
                                                </p>
                                                <p className={`text-xs truncate ${unreadCount > 0 ? 'text-purple-600 font-semibold' : 'text-gray-500'}`}>
                                                    {roomTitle}
                                                </p>
                                            </div>

                                            {/* Star and Unread */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {/* Star Button */}
                                                <button
                                                    onClick={(e) => handleStarClick(e, room)}
                                                    className="p-1 hover:bg-yellow-100 rounded transition-colors group/star"
                                                    title={room.is_starred ? 'Unstar' : 'Star'}
                                                >
                                                    <Star
                                                        size={16}
                                                        className={`transition-colors ${
                                                            room.is_starred
                                                                ? 'fill-yellow-400 text-yellow-400'
                                                                : 'text-gray-300 group-hover/star:text-yellow-400'
                                                        }`}
                                                    />
                                                </button>

                                                {/* Unread Badge */}
                                                {unreadCount > 0 && (
                                                    <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                                                        {unreadCount > 99 ? '99+' : unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()
                        )}
                    </div>
                </div>
            )}

            {/* Main Button */}
            <button
                onClick={() => {
                    if (showDropdown) {
                        setShowDropdown(false);
                        return;
                    }
                    openDropdownWithWarmData();
                }}
                className="relative bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all transform hover:scale-110 active:scale-95"
                aria-label="Open chat"
                title="Chat"
            >
                <MessageCircle size={24} />
                
                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}

                {/* Notification Pulse */}
                {unreadCount > 0 && (
                    <span className="absolute inset-0 bg-red-500 rounded-full animate-pulse opacity-20" />
                )}
            </button>
        </div>
    );
};

export default FloatingChatButton;
