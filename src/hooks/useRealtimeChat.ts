import { useEffect, useState, useCallback, useRef } from 'react';
import { realtimeChatService } from '@/services/realtimeChatService';
import { messageNotificationService } from '@/services/messageNotificationService';
import { isRealtimeChatInitialized } from '@/lib/realtimeChatInit';
import type { Message } from '@/types';

interface UseRealtimeChatOptions {
  chatRoomId: string;
  userId: number;
  onMessageReceived?: (message: Message) => void;
  onTypingStatusChanged?: (userId: number, isTyping: boolean) => void;
  autoMarkAsRead?: boolean;
  showNotifications?: boolean;
}

interface UseRealtimeChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  typingUsers: Map<number, { name: string; isTyping: boolean }>;
  unseenCount: number;
  sendTypingIndicator: (isTyping: boolean) => Promise<void>;
  sendReadReceipt: (messageIds: string[]) => Promise<void>;
  loadMoreMessages: (limit?: number, offset?: number) => Promise<void>;
  addLocalMessage: (messageText: string) => string;
  removeLocalMessage: (messageId: string) => void;
}

/**
 * Hook for managing realtime chat functionality
 */
export const useRealtimeChat = ({
  chatRoomId,
  userId,
  onMessageReceived,
  onTypingStatusChanged,
  autoMarkAsRead = true,
  showNotifications = true
}: UseRealtimeChatOptions): UseRealtimeChatReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<number, { name: string; isTyping: boolean }>>(new Map());
  const [messageOffset, setMessageOffset] = useState(0);
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const hasValidChatContext = Boolean(chatRoomId) && chatRoomId !== 'temp' && userId > 0;

  // Use refs for callbacks to avoid dependency issues
  const onMessageReceivedRef = useRef(onMessageReceived);
  const onTypingStatusChangedRef = useRef(onTypingStatusChanged);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
    onTypingStatusChangedRef.current = onTypingStatusChanged;
  }, [onMessageReceived, onTypingStatusChanged]);

  // Initialize chat service
  useEffect(() => {
    if (!hasValidChatContext) {
      return;
    }
    realtimeChatService.setCurrentUserId(userId);
  }, [userId, hasValidChatContext]);

  // Request notification permission
  useEffect(() => {
    if (showNotifications) {
      messageNotificationService.requestPermission();
    }
  }, [showNotifications]);

  // Wait for realtime chat initialization
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkReady = () => {
      if (isRealtimeChatInitialized()) {
        setIsRealtimeReady(true);
        setError(null);
        return;
      }

      timeoutId = setTimeout(checkReady, 300);
    };

    checkReady();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Load initial messages
  useEffect(() => {
    if (!isRealtimeReady || !hasValidChatContext) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const history = await realtimeChatService.getMessageHistory(chatRoomId, 50, 0);
        setMessages(history);
        setMessageOffset(history.length);
        setError(null);

        // Auto mark all existing unread messages as read when chat is opened
        if (autoMarkAsRead) {
          const unreadMessageIds = history
            .filter(m => m.sender_id !== userId && !m.is_read)
            .map(m => m.id);
          
          if (unreadMessageIds.length > 0) {
            try {
              await realtimeChatService.sendReadReceipt(chatRoomId, unreadMessageIds);
              // Notify that messages were read
              window.dispatchEvent(new CustomEvent('chat:messages-read', {
                detail: { chatRoomId }
              }));
            } catch (err) {
              console.warn('Failed to send read receipt:', err);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [chatRoomId, isRealtimeReady, autoMarkAsRead, userId, hasValidChatContext]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!isRealtimeReady || !hasValidChatContext) {
      return;
    }

    realtimeChatService.subscribeToChatRoom(
      chatRoomId,
      {
        onMessageReceived: (newMessage: Message) => {
          setMessages(prev => {
            // Remove matching optimistic message if present
            const trimmedText = (newMessage.message || '').trim();
            const withoutOptimistic = prev.filter(m => {
              if (!m.id?.toString().startsWith('local-')) return true;
              if (m.sender_id !== newMessage.sender_id) return true;
              if ((m.message || '').trim() !== trimmedText) return true;
              return false;
            });

            // Ensure status is set correctly
            if (!newMessage.delivery_status) {
              if (newMessage.is_read || newMessage.read_status) {
                newMessage.delivery_status = 'read';
              } else {
                newMessage.delivery_status = 'sent';
              }
            }

            return [...withoutOptimistic, newMessage];
          });
          onMessageReceivedRef.current?.(newMessage);

          // Auto mark as read
          if (autoMarkAsRead && newMessage.sender_id !== userId && !newMessage.is_read) {
            sendReadReceipt([newMessage.id])
              .then(() => {
                window.dispatchEvent(new CustomEvent('chat:messages-read', {
                  detail: { chatRoomId }
                }));
              })
              .catch(() => {
                // Ignore read receipt errors here; UI will refresh via polling
              });
          }

          // Show notification
          if (showNotifications && newMessage.sender_id !== userId) {
            messageNotificationService.showMessageNotification({
              type: 'message',
              senderName: newMessage.sender_name || 'Unknown',
              senderImage: newMessage.sender_image,
              messagePreview: (newMessage.message || '').substring(0, 100),
              chatRoomId,
              timestamp: new Date(newMessage.created_at || '')
            });
          }
        },
        onTypingStatusChanged: (typingUserId: number, isTyping: boolean) => {
          if (typingUserId !== userId) {
            setTypingUsers(prev => {
              const updated = new Map(prev);
              if (isTyping) {
                updated.set(typingUserId, { name: 'Someone', isTyping: true });
              } else {
                updated.delete(typingUserId);
              }
              return updated;
            });
            onTypingStatusChangedRef.current?.(typingUserId, isTyping);
          }
        },
        onReadReceiptChanged: (messageIds: string[]) => {
          // Update delivery status to 'read' for messages that were read
          setMessages(prev =>
            prev.map(m =>
              messageIds.includes(m.id) || messageIds.includes(m.id?.toString() || '') 
                ? { ...m, is_read: true, read_status: true, delivery_status: 'read' as const } 
                : m
            )
          );
        },
        onError: (err) => {
          setError(err.message);
        }
      },
      () => {}
    );

    return () => {
      realtimeChatService.unsubscribeFromChatRoom(chatRoomId);
    };
  }, [chatRoomId, userId, autoMarkAsRead, showNotifications, isRealtimeReady, hasValidChatContext]);

  const sendTypingIndicator = useCallback(
    async (isTyping: boolean) => {
      if (!hasValidChatContext) return;
      try {
        await realtimeChatService.sendTypingIndicator(chatRoomId, isTyping);
      } catch (err) {
        console.warn('Failed to send typing indicator:', err);
      }
    },
    [chatRoomId, hasValidChatContext]
  );

  const sendReadReceipt = useCallback(
    async (messageIds: string[]) => {
      if (!hasValidChatContext) return;
      try {
        await realtimeChatService.sendReadReceipt(chatRoomId, messageIds);
      } catch (err) {
        console.warn('Failed to send read receipt:', err);
      }
    },
    [chatRoomId, hasValidChatContext]
  );

  const loadMoreMessages = useCallback(
    async (limit: number = 50, offset: number = messageOffset) => {
      if (!hasValidChatContext) return;
      try {
        const moreMessages = await realtimeChatService.getMessageHistory(chatRoomId, limit, offset);
        setMessages(prev => [...moreMessages, ...prev]);
        setMessageOffset(offset + limit);
      } catch (err) {
        console.warn('Failed to load more messages:', err);
      }
    },
    [chatRoomId, messageOffset, hasValidChatContext]
  );

  return {
    messages,
    isLoading,
    error,
    typingUsers,
    unseenCount: messages.filter(m => m.sender_id !== userId && !m.is_read).length,
    sendTypingIndicator,
    sendReadReceipt,
    loadMoreMessages,
    addLocalMessage: (messageText: string) => {
      const tempId = `local-${Date.now()}`;
      const localMessage: Message = {
        id: tempId,
        chat_room_id: chatRoomId,
        sender_id: userId,
        message: messageText,
        is_read: true,
        delivery_status: 'sent',
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, localMessage]);
      return tempId;
    },
    removeLocalMessage: (messageId: string) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };
};

export default useRealtimeChat;
