import React from 'react';
import { format } from 'date-fns';
import { Check } from 'lucide-react';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showTimestamp?: boolean;
  showAvatar?: boolean;
  senderImage?: string;
  senderName?: string;
  onHover?: (id: string, isHovering: boolean) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showAvatar = false,
  senderName,
  onHover
}) => {
  const messageText = message.message || message.message_text || message.content || '';
  const createdAt = message.created_at ? new Date(message.created_at) : new Date();
  const timeString = format(createdAt, 'HH:mm');

  // Render message status indicators
  const renderStatusIndicator = () => {
    if (!isOwn) return null;

    const isRead = Boolean(message.is_read || message.read_status || message.delivery_status === 'read');
    
    return (
      <Check
        size={16}
        className={`${isRead ? 'text-yellow-300' : 'text-gray-300'} inline-block`}
        strokeWidth={2.5}
      />
    );
  };

  return (
    <div
      className={`flex gap-2 mb-3 animate-in fade-in duration-300 ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
      onMouseEnter={() => onHover?.(message.id, true)}
      onMouseLeave={() => onHover?.(message.id, false)}
    >
      {/* Avatar for received messages */}
      {!isOwn && showAvatar && (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5">
          {(senderName || 'U').charAt(0).toUpperCase()}
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-lg transition-all ${
          isOwn
            ? 'bg-blue-500 text-white rounded-br-none shadow-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-none shadow-sm'
        }`}
      >
        {/* Sender name for group messages */}
        {!isOwn && senderName && (
          <p className="text-xs font-semibold mb-1 text-gray-600">{senderName}</p>
        )}

        {/* Message content */}
        <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">
          {messageText}
        </p>

        {/* Time and read status footer */}
        <div
          className={`text-xs mt-1 flex items-center justify-end gap-1 ${
            isOwn ? 'text-white/70' : 'text-gray-500'
          }`}
        >
          <span className="opacity-70">{timeString}</span>
          {renderStatusIndicator()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
