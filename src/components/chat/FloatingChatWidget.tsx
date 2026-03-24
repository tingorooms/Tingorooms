import React, { useEffect, useState } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import MessageBubble from './MessageBubble';
import type { Message, ChatRoom } from '@/types';

interface FloatingChatWidgetProps {
    chatRoom: ChatRoom | null;
    messages: Message[];
    currentUserId: number;
    typingUsers?: Map<number, { name: string; isTyping: boolean }>;
    onSendMessage?: (message: string) => Promise<void>;
    onClose?: () => void;
    isOpen?: boolean;
    onMinimize?: () => void;
    isMinimized?: boolean;
    unreadCount?: number;
}

const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
    chatRoom,
    messages,
    currentUserId,
    typingUsers = new Map(),
    onSendMessage,
    onClose,
    isOpen = true,
    onMinimize,
    isMinimized = false,
    unreadCount = 0
}) => {
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, typingUsers]);

    const handleSendMessage = async () => {
        if (!input.trim() || !onSendMessage) return;

        setIsSending(true);
        try {
            await onSendMessage(input);
            setInput('');
        } catch (error) {
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!isOpen) return null;

    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-40">
                <Button
                    onClick={() => onMinimize?.()}
                    className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl"
                >
                    <MessageCircle size={24} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>
            </div>
        );
    }

    const otherParticipant = chatRoom
        ? {
            name: chatRoom.receiver_name || chatRoom.initiator_name || 'User',
            image: chatRoom.participant_2_image || chatRoom.participant_1_image
          }
        : null;

    return (
        <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-600 px-4 py-4 rounded-t-lg flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    {otherParticipant?.image ? (
                        <img
                            src={otherParticipant.image}
                            alt={otherParticipant.name}
                            className="w-8 h-8 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                            {(otherParticipant?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h3 className="text-white font-semibold text-sm">
                            {otherParticipant?.name || 'Chat'}
                        </h3>
                        <p className="text-blue-100 text-xs">Online</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-white hover:bg-blue-700"
                        onClick={() => onMinimize?.()}
                        title="Minimize"
                    >
                        <div className="w-4 h-0.5 bg-white" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-white hover:bg-blue-700"
                        onClick={onClose}
                        title="Close"
                    >
                        <X size={16} />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                isOwn={message.sender_id === currentUserId}
                                showTimestamp={false}
                            />
                        ))}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <div className="border-t bg-white dark:bg-gray-800 p-3 rounded-b-lg flex-shrink-0">
                <div className="flex gap-2 items-end">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type message..."
                        className="resize-none max-h-16 text-sm rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        rows={1}
                        disabled={isSending}
                    />
                    <Button
                        onClick={handleSendMessage}
                        disabled={isSending || !input.trim()}
                        size="icon"
                        className="h-8 w-8 rounded-full text-white bg-gradient-to-r from-blue-600 to-blue-600 hover:brightness-110"
                    >
                        <Send size={16} />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FloatingChatWidget;
