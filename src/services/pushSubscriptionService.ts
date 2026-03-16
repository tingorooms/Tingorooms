import { del, get, post } from './api';

interface PushConfigResponse {
  supported: boolean;
  publicKey: string | null;
}

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

const getPushConfig = async (): Promise<PushConfigResponse> => {
  const response = await get<{ data: PushConfigResponse }>('/notifications/push/config');
  return response.data;
};

export const isPushSupported = (): boolean => {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
};

export const subscribeBrowserPush = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const config = await getPushConfig();
  if (!config.supported || !config.publicKey) {
    return false;
  }

  const registration = await navigator.serviceWorker.register('/sw.js');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(config.publicKey) as unknown as BufferSource;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await post('/notifications/push/subscribe', { subscription: subscription.toJSON() });
  return true;
};

export const unsubscribeBrowserPush = async (): Promise<void> => {
  if (!isPushSupported()) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = registration ? await registration.pushManager.getSubscription() : null;

  if (subscription) {
    await del('/notifications/push/unsubscribe', { data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  }
};
