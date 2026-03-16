import { getProfileImageUrl } from '@/lib/utils';
import { getNotificationPrefs } from '@/lib/notificationPreferences';

interface NotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
  data?: Record<string, any>;
}

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface MessageNotificationPayload {
  type: 'message' | 'read_receipt' | 'typing' | 'online' | 'offline';
  senderName: string;
  senderImage?: string;
  messagePreview?: string;
  chatRoomId: string;
  timestamp: Date;
}

type NotificationCallback = (action: string) => void;

class MessageNotificationService {
  private permission: NotificationPermission = 'default';
  private notificationCallbacks: Map<string, NotificationCallback> = new Map();
  private audioContext: AudioContext | null = null;
  private soundCache: Map<string, AudioBuffer> = new Map();
  private inAppEventName = 'chat:inapp-notification';

  constructor() {
    this.initPermissionStatus();
    this.initAudioContext();
  }

  /**
   * Initialize permission status without requesting
   */
  private initPermissionStatus() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  /**
   * Always derive the latest browser permission at runtime.
   */
  private getEffectivePermission(): NotificationPermission {
    if (!('Notification' in window)) {
      this.permission = 'denied';
      return this.permission;
    }

    this.permission = Notification.permission;
    return this.permission;
  }

  /**
   * Initialize Web Audio API context
   */
  private initAudioContext() {
    try {
      const AACContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AACContext();
    } catch (e) {
    }
  }

  /**
   * Show a desktop notification
   */
  showNotification(config: NotificationConfig, onActionClick?: NotificationCallback): Promise<void> {
    return new Promise((resolve) => {
      if (!('Notification' in window)) {
        resolve();
        return;
      }

      if (this.getEffectivePermission() !== 'granted') {
        resolve();
        return;
      }

      const notification = new Notification(config.title, {
        body: config.body,
        icon: config.icon,
        badge: config.badge,
        tag: config.tag || 'default',
        requireInteraction: config.requireInteraction || false,
        data: config.data
      });

      if (onActionClick) {
        const notificationId = `${config.tag}_${Date.now()}`;
        this.notificationCallbacks.set(notificationId, onActionClick);

        notification.addEventListener('click', () => {
          onActionClick?.('click');
          notification.close();
        });
      }

      notification.addEventListener('close', () => {
        resolve();
      });

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close();
        resolve();
      }, 5000);
    });
  }

  /**
   * Show message notification with preview
   */
  async showMessageNotification(payload: MessageNotificationPayload) {
    const prefs = getNotificationPrefs();

    if (prefs.chat) {
      this.emitInAppNotification(payload);
    }

    if (!prefs.push) {
      return;
    }

    // Get the profile image URL with fallback
    let iconUrl: string | undefined = undefined;
    
    if (payload.senderImage) {
      iconUrl = getProfileImageUrl(payload.senderImage);
      
      // Try to fetch the image and convert to data URL for better notification support
      if (iconUrl && iconUrl !== '') {
        try {
          const response = await fetch(iconUrl, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            }
          });
          if (response.ok) {
            const blob = await response.blob();
            // Convert blob to data URL for better compatibility with notifications
            const reader = new FileReader();
            iconUrl = await new Promise<string>((resolve) => {
              reader.onload = () => {
                resolve(reader.result as string);
              };
              reader.readAsDataURL(blob);
            });
          } else {
            // Keep the HTTP URL if fetch fails
          }
        } catch (error) {
          // Keep the HTTP URL if fetch fails
        }
      } else {
        iconUrl = undefined;
      }
    }
    
    const config: NotificationConfig = {
      title: `Message from ${payload.senderName}`,
      body: payload.messagePreview || 'Sent you a message',
      icon: iconUrl,
      badge: iconUrl,
      tag: `message_${payload.chatRoomId}`,
      data: {
        chatRoomId: payload.chatRoomId,
        type: payload.type,
        timestamp: payload.timestamp.toISOString(),
        senderImage: payload.senderImage
      },
      requireInteraction: false,
      actions: [
        { action: 'reply', title: 'Reply' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    // Play notification sound
    await this.playNotificationSound('message');

    // Show notification
    return this.showNotification(config);
  }

  /**
   * Emit in-app notification event for on-screen popups
   */
  private emitInAppNotification(payload: MessageNotificationPayload) {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
      new CustomEvent(this.inAppEventName, {
        detail: payload
      })
    );
  }

  /**
   * Play a notification sound
   */
  async playNotificationSound(soundType: 'message' | 'typing' | 'online' | 'error' = 'message') {
    if (!this.audioContext) {
      return;
    }

    try {
      const buffer = await this.generateToneSound(soundType);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
    } catch (error) {
    }
  }

  /**
   * Generate synthetic notification sounds
   */
  private async generateToneSound(type: 'message' | 'typing' | 'online' | 'error'): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('Audio context not initialized');

    // Return cached sound if available
    if (this.soundCache.has(type)) {
      return this.soundCache.get(type)!;
    }

    const sampleRate = this.audioContext.sampleRate;
    const duration = type === 'message' ? 0.8 : type === 'typing' ? 0.3 : 0.6;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let frequencies: number[];
    let volumes: number[];
    let timings: number[];

    switch (type) {
      case 'message':
        // Two-tone sound for message (WhatsApp style)
        frequencies = [523.25, 659.25]; // C5, E5
        volumes = [0.3, 0.3];
        timings = [0, 0.4];
        break;
      case 'typing':
        // Quick beep for typing
        frequencies = [880]; // A5
        volumes = [0.2];
        timings = [0];
        break;
      case 'online':
        // Positive bell sound
        frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
        volumes = [0.2, 0.2, 0.2];
        timings = [0, 0.1, 0.2];
        break;
      case 'error':
        // Alert sound
        frequencies = [349.23, 261.63]; // F4, C4
        volumes = [0.3, 0.2];
        timings = [0, 0.2];
        break;
      default:
        frequencies = [440];
        volumes = [0.2];
        timings = [0];
    }

    // Generate tone
    for (let i = 0; i < frequencies.length; i++) {
      const startFrame = Math.floor(timings[i] * sampleRate);
      const endFrame = i === frequencies.length - 1 
        ? length 
        : Math.floor(timings[i + 1] * sampleRate);

      for (let j = startFrame; j < endFrame; j++) {
        const t = (j - startFrame) / sampleRate;
        const frequency = frequencies[i];
        // Add envelope to prevent clicking
        const envelope = Math.max(0, 1 - (j - startFrame) / (endFrame - startFrame) * 0.3);
        data[j] = Math.sin(2 * Math.PI * frequency * t) * volumes[i] * envelope;
      }
    }

    // Cache the buffer
    this.soundCache.set(type, buffer);
    return buffer;
  }

  /**
   * Play a custom audio file url
   */
  async playAudioFile(url: string, volume: number = 0.5) {
    try {
      const audio = new Audio(url);
      audio.volume = volume;
      await audio.play();
    } catch (error) {
    }
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    return this.getEffectivePermission();
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      this.permission = 'denied';
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission;
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.getNotifications().then(notifications => {
            notifications.forEach(notification => notification.close());
          });
        });
      });
    }
  }

  /**
   * Test notification
   */
  async testNotification() {
    await this.showMessageNotification({
      type: 'message',
      senderName: 'Test User',
      messagePreview: 'This is a test message notification',
      chatRoomId: 'test_chat',
      timestamp: new Date()
    });
  }
}

// Singleton instance
export const messageNotificationService = new MessageNotificationService();

export default MessageNotificationService;
