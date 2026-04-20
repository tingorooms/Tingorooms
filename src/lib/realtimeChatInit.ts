/**
 * Initialize Realtime Chat Service
 * This should be called once in your app root
 */

export interface RealtimeChatConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  enableNotifications?: boolean;
  notificationPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  requestPermissionOnInit?: boolean;
}

let isInitialized = false;
let realtimeChatServiceRef: { initialize: (config: { supabaseUrl: string; supabaseAnonKey: string }) => void; disconnect: () => Promise<void> } | null = null;
let messageNotificationServiceRef: { requestPermission: () => void; clearAllNotifications: () => void } | null = null;

const loadRealtimeServices = async () => {
  if (realtimeChatServiceRef && messageNotificationServiceRef) {
    return {
      realtimeChatService: realtimeChatServiceRef,
      messageNotificationService: messageNotificationServiceRef,
    };
  }

  const [{ realtimeChatService }, { messageNotificationService }] = await Promise.all([
    import('@/services/realtimeChatService'),
    import('@/services/messageNotificationService'),
  ]);

  realtimeChatServiceRef = realtimeChatService;
  messageNotificationServiceRef = messageNotificationService;

  return {
    realtimeChatService,
    messageNotificationService,
  };
};

/**
 * Initialize the realtime chat system
 */
export const initializeRealtimeChat = async (config: RealtimeChatConfig) => {
  if (isInitialized) {
    return true;
  }

  try {
    const { realtimeChatService, messageNotificationService } = await loadRealtimeServices();

    // Initialize Supabase realtime service
    realtimeChatService.initialize({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey
    });

    // Request notification permission if configured
    if (config.enableNotifications && config.requestPermissionOnInit) {
      messageNotificationService.requestPermission();
    }

    isInitialized = true;

    return true;
  } catch (error) {
    console.warn('Failed to initialize realtime chat:', error);
    return false;
  }
};

/**
 * Check if realtime chat is initialized
 */
export const isRealtimeChatInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Cleanup realtime chat on app unmount
 */
export const cleanupRealtimeChat = async () => {
  try {
    const { realtimeChatService, messageNotificationService } = await loadRealtimeServices();
    await realtimeChatService.disconnect();
    messageNotificationService.clearAllNotifications();
    isInitialized = false;
  } catch (error) {
    console.warn('Failed to cleanup realtime chat:', error);
  }
};
