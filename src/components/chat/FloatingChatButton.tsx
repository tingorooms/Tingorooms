import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Star } from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { getCachedChatRooms, getChatRooms, getUnreadCount, starChat, unstarChat } from '@/services/chatService';
import type { ChatRoom } from '@/types';
import { getProfileImageUrl } from '@/lib/utils';

const FLOATING_CHAT_POSITION_KEY = 'floating-chat-position-v3';
const FLOATING_CHAT_BUTTON_SIZE = 56;
const FLOATING_CHAT_EDGE_MARGIN = 12;

type FloatingButtonPosition = {
    x: number;
    y: number;
};

const FloatingChatButton: React.FC = () => {
    const { openExistingChat } = useChat();
    const { user: currentUser, isAuthenticated } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(false);
    const [buttonPosition, setButtonPosition] = useState<FloatingButtonPosition | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const dragPointerIdRef = useRef<number | null>(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const dragStartRef = useRef({ x: 0, y: 0 });
    const didDragRef = useRef(false);

    const applyChatRooms = useCallback((rooms: ChatRoom[]) => {
        setChatRooms(rooms);
        setUnreadCount(rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0));
    }, []);

    const clampPosition = useCallback((position: FloatingButtonPosition): FloatingButtonPosition => {
        const maxX = Math.max(
            FLOATING_CHAT_EDGE_MARGIN,
            window.innerWidth - FLOATING_CHAT_BUTTON_SIZE - FLOATING_CHAT_EDGE_MARGIN
        );
        const maxY = Math.max(
            FLOATING_CHAT_EDGE_MARGIN,
            window.innerHeight - FLOATING_CHAT_BUTTON_SIZE - FLOATING_CHAT_EDGE_MARGIN
        );

        return {
            x: Math.min(Math.max(position.x, FLOATING_CHAT_EDGE_MARGIN), maxX),
            y: Math.min(Math.max(position.y, FLOATING_CHAT_EDGE_MARGIN), maxY),
        };
    }, []);

    const refreshUnreadCount = useCallback(async () => {
        const cachedRooms = getCachedChatRooms();
        if (cachedRooms && cachedRooms.length > 0) {
            applyChatRooms(cachedRooms);
        }

        try {
            const data = await getUnreadCount();
            setUnreadCount(data.unreadCount || 0);
        } catch {
        }
    }, [applyChatRooms]);

    const loadChatRooms = useCallback(async (showLoader = false) => {
        const cachedRooms = getCachedChatRooms();
        if (cachedRooms && cachedRooms.length > 0) {
            applyChatRooms(cachedRooms);
        }

        try {
            if (showLoader && (!cachedRooms || cachedRooms.length === 0)) {
                setLoading(true);
            }
            const rooms = await getChatRooms();
            applyChatRooms(rooms);
        } catch {
        } finally {
            if (showLoader) {
                setLoading(false);
            }
        }
    }, [applyChatRooms]);

    const openDropdownWithWarmData = useCallback(() => {
        const cachedRooms = getCachedChatRooms();

        if (cachedRooms && cachedRooms.length > 0) {
            applyChatRooms(cachedRooms);
            setLoading(false);
        } else {
            setLoading(true);
        }

        setShowDropdown(true);
        void loadChatRooms(false);
    }, [applyChatRooms, loadChatRooms]);

    const toggleDropdown = useCallback(() => {
        if (showDropdown) {
            setShowDropdown(false);
            return;
        }

        openDropdownWithWarmData();
    }, [openDropdownWithWarmData, showDropdown]);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(FLOATING_CHAT_POSITION_KEY);
            if (!raw) return;

            const parsed = JSON.parse(raw) as FloatingButtonPosition;
            if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') {
                return;
            }

            setButtonPosition(clampPosition(parsed));
        } catch {
        }
    }, [clampPosition]);

    useEffect(() => {
        if (!buttonPosition) return;

        try {
            window.localStorage.setItem(FLOATING_CHAT_POSITION_KEY, JSON.stringify(buttonPosition));
        } catch {
        }
    }, [buttonPosition]);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        if (!buttonPosition) {
            wrapper.style.left = '';
            wrapper.style.top = '';
            return;
        }

        wrapper.style.left = `${buttonPosition.x}px`;
        wrapper.style.top = `${buttonPosition.y}px`;
    }, [buttonPosition]);

    useEffect(() => {
        const handleResize = () => {
            setViewportWidth(window.innerWidth);
            setButtonPosition((current) => (current ? clampPosition(current) : current));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampPosition]);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
            if (!showDropdown) return;
            const target = event.target as Node | null;
            if (target && wrapperRef.current?.contains(target)) {
                return;
            }
            setShowDropdown(false);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick, { passive: true });

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [showDropdown]);

    // Load chat badge and rooms with route-friendly polling strategy.
    useEffect(() => {
        if (!isAuthenticated) {
            setChatRooms([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        // Always pre-warm rooms on auth/page load so dropdown opens instantly
        void loadChatRooms(false);

        const cachedRooms = getCachedChatRooms();
        if (cachedRooms && cachedRooms.length > 0) {
            applyChatRooms(cachedRooms);
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
    }, [isAuthenticated, currentUser?.id, showDropdown, loadChatRooms, refreshUnreadCount, applyChatRooms]);

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

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) {
            return;
        }

        const target = event.currentTarget;
        const rect = target.getBoundingClientRect();

        dragPointerIdRef.current = event.pointerId;
        dragOffsetRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
        dragStartRef.current = {
            x: event.clientX,
            y: event.clientY,
        };
        didDragRef.current = false;
        setIsDragging(true);
        setButtonPosition((current) => current ?? { x: rect.left, y: rect.top });

        target.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) {
            return;
        }

        const deltaX = Math.abs(event.clientX - dragStartRef.current.x);
        const deltaY = Math.abs(event.clientY - dragStartRef.current.y);

        if (deltaX > 5 || deltaY > 5) {
            didDragRef.current = true;
        }

        const nextPosition = clampPosition({
            x: event.clientX - dragOffsetRef.current.x,
            y: event.clientY - dragOffsetRef.current.y,
        });

        setButtonPosition(nextPosition);
    };

    const finishPointerInteraction = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (dragPointerIdRef.current !== event.pointerId) {
            return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);
        dragPointerIdRef.current = null;
        setIsDragging(false);

        if (!didDragRef.current) {
            toggleDropdown();
        }
    };

    const alignRight = buttonPosition ? buttonPosition.x > viewportWidth / 2 : true;
    const dropdownBelow = buttonPosition ? buttonPosition.y < window.innerHeight / 2 : false;

    return (
        <div
            ref={wrapperRef}
            className={`fixed z-40 ${buttonPosition ? 'left-0 top-0' : 'bottom-4 right-4'}`}
        >
            {/* Dropdown Menu – absolutely positioned so button never shifts */}
            {showDropdown && (
                <div className={[
                    'absolute bg-white border border-gray-200 rounded-lg shadow-xl w-72',
                    'max-w-[calc(100vw-24px)] max-h-96 overflow-hidden flex flex-col',
                    'animate-in fade-in duration-200',
                    dropdownBelow ? 'top-full mt-2' : 'bottom-full mb-2',
                    alignRight ? 'right-0' : 'left-0',
                ].join(' ')}>
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
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerInteraction}
                onPointerCancel={finishPointerInteraction}
                className={`relative bg-gradient-to-r from-blue-600 to-purple-600 hover:brightness-110 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all transform active:scale-95 touch-none select-none ${isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab hover:scale-110'}`}
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
