import React, { useRef, useCallback, useLayoutEffect, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Eye, EyeOff, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { sendMessage, getRoomContactInfo, updateRoomContactVisibility } from '@/services/chatService';
import MessageBubble from './MessageBubble';
import { getProfileImageUrl } from '@/lib/utils';
import ChatInput from './ChatInput';
import type { ChatRoom, Room } from '@/types';
import { toast } from 'sonner';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatRoom: ChatRoom | null;
    room?: Room | null;
    onNavigateToRoom?: (roomId: number | string) => void;
    isEstablishing?: boolean;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, chatRoom, room, onNavigateToRoom }) => {
    const { user } = useAuth();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // State for room contact visibility
    const [roomContactInfo, setRoomContactInfo] = useState<{
        id: number;
        room_id: string;
        title: string;
        contact: string;
        contact_visibility: 'Private' | 'Public';
        user_id: number;
        owner_name: string;
        owner_image?: string;
    } | null>(null);
    const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
    
    // Get participant IDs (handle both nested objects and primitives)
    const participant1Id = typeof chatRoom?.participant_1 === 'object' ? chatRoom?.participant_1?.id : chatRoom?.participant_1;

    // Determine which participant is the other user (with type coercion for safety)
    const isCurrentUserParticipant1 = participant1Id && user?.id && Number(participant1Id) === Number(user.id);
    
    // Use realtime chat hook
    const {
        messages,
        typingUsers,
        sendTypingIndicator,
        addLocalMessage,
        removeLocalMessage
    } = useRealtimeChat({
        chatRoomId: chatRoom?.room_id || 'temp',
        userId: user?.id || 0,
        autoMarkAsRead: isOpen,
        showNotifications: false
    });

    // Get room ID for contact info
    const roomListingId = chatRoom?.room_listing_id || room?.id;

    // Fetch room contact info
    useEffect(() => {
        const fetchRoomContactInfo = async () => {
            try {
                if (roomListingId) {
                    const roomInfo = await getRoomContactInfo(roomListingId);
                    setRoomContactInfo(roomInfo);
                }
            } catch (error) {
            }
        };

        if (isOpen && roomListingId) {
            fetchRoomContactInfo();
        }
    }, [isOpen, roomListingId]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
        const target = messagesEndRef.current;
        if (!target) return;

        // Defer to ensure layout is settled before scrolling.
        requestAnimationFrame(() => {
            target.scrollIntoView({ behavior, block: 'end' });
        });
    }, []);

    useLayoutEffect(() => {
        if (messages.length > 0 && isOpen) {
            scrollToBottom('auto');
        }
    }, [messages.length, isOpen, scrollToBottom]);

    const handleSendMessage = async (messageText: string) => {
        if (!chatRoom?.room_id || !messageText.trim()) return;

        const tempId = addLocalMessage(messageText);

        try {
            await sendMessage(chatRoom.room_id, messageText);
        } catch (error) {
            removeLocalMessage(tempId);
            throw error;
        }
    };

    const handleTyping = (isTyping: boolean) => {
        if (chatRoom?.room_id) {
            sendTypingIndicator(isTyping);
        }
    };

    // Handle toggle contact visibility for the room
    const handleToggleVisibility = async () => {
        if (isTogglingVisibility || !roomContactInfo || !roomListingId) return;
        
        // Only room owner can toggle visibility
        if (roomContactInfo.user_id !== user?.id) {
            toast.error('Only the room owner can change contact visibility');
            return;
        }
        
        setIsTogglingVisibility(true);
        try {
            const newVisibility = roomContactInfo.contact_visibility === 'Private' ? 'Public' : 'Private';
            await updateRoomContactVisibility(roomListingId, newVisibility);
            
            // Update local state
            setRoomContactInfo({
                ...roomContactInfo,
                contact_visibility: newVisibility
            });
            
            toast.success(`Contact is now ${newVisibility.toLowerCase()}`);
        } catch (error) {
            toast.error('Failed to update contact visibility. Please try again.');
        } finally {
            setIsTogglingVisibility(false);
        }
    };

    // Get other participant info - comprehensive fallback chain
    const otherParticipant = isCurrentUserParticipant1
        ? {
            name: (typeof chatRoom?.participant_2 === 'object' ? chatRoom?.participant_2?.name : null) || 
                   chatRoom?.participant_2_name || 
                   chatRoom?.receiver_name ||
                   'User',
            image: (typeof chatRoom?.participant_2 === 'object' ? chatRoom?.participant_2?.profile_image : null) || 
                   chatRoom?.participant_2_image
        }
        : {
            name: (typeof chatRoom?.participant_1 === 'object' ? chatRoom?.participant_1?.name : null) || 
                   chatRoom?.participant_1_name || 
                   chatRoom?.initiator_name ||
                   'User',
            image: (typeof chatRoom?.participant_1 === 'object' ? chatRoom?.participant_1?.profile_image : null) || 
                   chatRoom?.participant_1_image
        };

    // Build user name with robust fallbacks (no room title fallback)
    const otherParticipantName = 
        otherParticipant.name || 
        'User';

    const otherParticipantInitials = (otherParticipantName as string)
        .split(' ')
        .filter((part: string) => Boolean(part))
        .slice(0, 2)
        .map((part: string) => part[0])
        .join('')
        .toUpperCase();

    const isTypingOther = Array.from(typingUsers.values()).some(u => u.isTyping);
    const statusLabel = isTypingOther ? 'Typing...' : '';

    // Get room title
    const roomTitle = chatRoom?.room_title || room?.title || 'Room';
    const roomId = chatRoom?.room_id || room?.id;

    const handleRoomTitleClick = () => {
        if (roomId) {
            if (onNavigateToRoom) {
                onNavigateToRoom(roomId);
            } else {
                // Fallback for when callback is not provided
                window.location.href = `/rooms/${roomId}`;
            }
        }
    };

    if (!chatRoom) {
        // Show a connecting-state dialog while the room is being fetched
        if (!isOpen) return null;
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-sm w-full p-0 gap-0 flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden" showCloseButton={false}>
                    <DialogTitle className="sr-only">Connecting chat</DialogTitle>
                    <DialogDescription className="sr-only">Establishing chat connection with owner</DialogDescription>
                    <div className="flex flex-col items-center gap-4 py-10 px-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                            <MessageSquare className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-gray-900 text-base">Establishing chat...</p>
                            <p className="text-sm text-gray-500 mt-1">Connecting you with the owner</p>
                        </div>
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl w-full h-[600px] p-0 gap-0 flex flex-col rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden" showCloseButton={false}>
                {/* Hidden DialogTitle for accessibility */}
                <DialogTitle className="sr-only">
                    Chat with {otherParticipantName}
                </DialogTitle>
                
                {/* Hidden DialogDescription for accessibility */}
                <DialogDescription className="sr-only">
                    Real-time chat conversation
                </DialogDescription>

                {/* Header */}
                <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 bg-white">
                    {/* Main header content */}
                    <div className="flex items-center gap-3 justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Avatar className="w-10 h-10 ring-2 ring-gray-200 flex-shrink-0">
                                <AvatarImage src={getProfileImageUrl(otherParticipant.image)} />
                                <AvatarFallback className="bg-blue-100 text-blue-700">
                                    {otherParticipantInitials || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                {/* Room title - clickable */}
                                <button
                                    onClick={handleRoomTitleClick}
                                    className="text-base font-semibold text-blue-600 hover:text-blue-700 hover:underline truncate text-left transition-colors w-full"
                                    title="View room details"
                                >
                                    {roomTitle}
                                </button>
                                {/* User name below */}
                                <p className="text-sm text-gray-600 truncate mt-0.5">
                                    {otherParticipantName}
                                </p>
                                {/* Show room contact number if visibility is Public - but NOT for the owner */}
                                {roomContactInfo?.contact_visibility === 'Public' && 
                                 roomContactInfo?.contact && 
                                 roomContactInfo.user_id !== user?.id && (
                                    <a 
                                        href={`tel:${roomContactInfo.contact}`}
                                        className="text-xs text-blue-600 font-medium mt-0.5 hover:text-blue-700 hover:underline cursor-pointer inline-block transition-colors"
                                        title="Click to call"
                                    >
                                        📞 {roomContactInfo.contact}
                                    </a>
                                )}
                                {/* Show toggle instruction for owner instead of the number */}
                                {roomContactInfo && roomContactInfo.user_id === user?.id && (
                                    <div className="text-xs text-gray-600 mt-0.5 italic">
                                        {roomContactInfo.contact_visibility === 'Public' ? (
                                            'Click Hide to make contact Private'
                                        ) : (
                                            'Click Show to Make Contact public'
                                        )}
                                    </div>
                                )}
                                {/* Typing status - only show when typing */}
                                {isTypingOther && (
                                    <div className="text-xs text-blue-600 mt-1">
                                        {statusLabel}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right side buttons */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors hover:bg-gray-100 rounded-md"
                                aria-label="Close chat"
                            >
                                <X size={20} />
                            </button>
                            
                            {/* Contact Visibility Toggle - Only for room owner */}
                            {roomContactInfo && roomContactInfo.user_id === user?.id && (
                                <button
                                    onClick={handleToggleVisibility}
                                    disabled={isTogglingVisibility}
                                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-all ${
                                        roomContactInfo.contact_visibility === 'Public'
                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title={`Contact is ${roomContactInfo.contact_visibility.toLowerCase()}. Click to ${roomContactInfo.contact_visibility === 'Private' ? 'show' : 'hide'} contact`}
                                >
                                    {roomContactInfo.contact_visibility === 'Public' ? (
                                        <>
                                            <Eye size={12} />
                                            <span>Show</span>
                                        </>
                                    ) : (
                                        <>
                                            <EyeOff size={12} />
                                            <span>Hide</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Messages Area - Takes remaining space */}
                <ScrollArea className="flex-1 overflow-hidden bg-gray-50">
                    <div className="space-y-3 p-4 pb-6">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-400 py-12">
                                <p className="text-xs uppercase tracking-widest">No messages yet</p>
                                <p className="text-sm mt-2">Start the conversation with a friendly hello.</p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isOwn={message.sender_id === user?.id}
                                    showAvatar={message.sender_id !== user?.id}
                                />
                            ))
                        )}


                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Input Area - Fixed at bottom */}
                <div className="flex-shrink-0 bg-white px-0 py-2">
                    <ChatInput
                        onSendMessage={handleSendMessage}
                        onTyping={handleTyping}
                        placeholder="Type a message..."
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ChatModal;
