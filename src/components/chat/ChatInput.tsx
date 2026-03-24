import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, AlertCircle, Paperclip, Smile, X } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';

interface ChatInputProps {
    onSendMessage: (message: string) => Promise<void>;
    onTyping?: (isTyping: boolean) => void;
    isLoading?: boolean;
    disabled?: boolean;
    error?: string | null;
    maxLength?: number;
    placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
    onSendMessage,
    onTyping,
    isLoading,
    disabled,
    error,
    maxLength = 2000,
    placeholder = "Type a message..."
}) => {
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const isTypingRef = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Handle typing indicator
    useEffect(() => {
        if (message.trim() && !isTypingRef.current) {
            isTypingRef.current = true;
            onTyping?.(true);
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
            if (isTypingRef.current) {
                isTypingRef.current = false;
                onTyping?.(false);
            }
        }, 1000);

        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [message, onTyping]);

    const handleSendMessage = async () => {
        if (!message.trim()) {
            setLocalError('Message cannot be empty');
            return;
        }

        if (message.length > maxLength) {
            setLocalError(`Message exceeds maximum length of ${maxLength} characters`);
            return;
        }

        setIsSubmitting(true);
        setLocalError(null);

        // Stop typing indicator
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        isTypingRef.current = false;
        onTyping?.(false);

        try {
            await onSendMessage(message);
            setMessage('');
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'Failed to send message');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            if ((e.ctrlKey || e.metaKey) && !isSubmitting && !disabled) {
                e.preventDefault();
                handleSendMessage();
            }
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        const newMessage = message + emojiData.emoji;
        setMessage(newMessage);
        setLocalError(null);
        // Keep emoji picker open for multiple emoji selection
        textareaRef.current?.focus();
    };

    const characterCount = message.length;
    const isNearLimit = characterCount > maxLength * 0.9;
    const isEmpty = message.trim().length === 0;

    return (
        <>
            {/* Error message - inline and compact */}
            {(error || localError) && (
                <div className="flex items-center gap-1 px-2.5 py-1 mx-3 mt-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-xs">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span className="truncate text-xs">{error || localError}</span>
                </div>
            )}

            {/* Modern WhatsApp-style input - Single unified box */}
            <div className="flex items-center gap-1.5 mx-3 mb-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-opacity-50 transition-all h-10">
                {/* Attachment button - inside left */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-gray-600 flex-shrink-0 p-0"
                    title="Attach file"
                    disabled={disabled || isLoading}
                >
                    <Paperclip size={16} />
                </Button>

                {/* Emoji button - inside left */}
                <Button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-600 dark:text-gray-400 hover:text-yellow-500 hover:bg-yellow-100 dark:hover:bg-gray-600 flex-shrink-0 p-0 relative"
                    title="Add emoji"
                    disabled={disabled || isLoading}
                >
                    <Smile size={16} />
                </Button>

                {/* Text input - center */}
                <Textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => {
                        setMessage(e.target.value);
                        setLocalError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={`flex-1 resize-none max-h-8 min-h-8 bg-transparent border-0 focus:ring-0 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm leading-6 py-1.5 px-1 m-0 align-middle ${
                        isNearLimit ? 'text-red-600' : ''
                    }`}
                    disabled={isSubmitting || disabled || isLoading}
                    rows={1}
                    style={{ height: '32px', overflow: 'hidden' }}
                />

                {/* Character count - inside right */}
                {characterCount > 0 && (
                    <div
                        className={`text-xs font-medium flex-shrink-0 ${
                            isNearLimit
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-400 dark:text-gray-500'
                        }`}
                    >
                        {characterCount}/{maxLength}
                    </div>
                )}

                {/* Send button - inside right */}
                <Button
                    onClick={handleSendMessage}
                    disabled={isSubmitting || disabled || isLoading || isEmpty}
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-blue-600 hover:brightness-110 text-white shadow-sm hover:shadow-md transition-all p-0"
                    title="Send message"
                >
                    <Send size={16} />
                </Button>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
                <div className="relative mx-3 mt-2 z-50">
                    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-1">
                        <div className="absolute top-full left-0 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-200 dark:border-t-gray-600 ml-2" />
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            height={350}
                            width="100%"
                        />
                        <button
                            onClick={() => setShowEmojiPicker(false)}
                            className="absolute top-1 right-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Close emoji picker"
                        >
                            <X size={16} className="text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatInput;
