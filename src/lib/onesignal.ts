import OneSignal from 'react-onesignal';

let initPromise: Promise<void> | null = null;
let initSuccess = false;

export async function initOneSignal() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    const appId = (import.meta as any).env.VITE_ONESIGNAL_APP_ID;
    if (!appId) {
      console.warn('OneSignal App ID not found in environment variables');
      return;
    }

    try {
      await OneSignal.init({
        appId: appId,
        allowLocalhostAsSecureOrigin: true,
        autoResubscribe: true,
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });
      console.log('OneSignal Initialized successfully');
      initSuccess = true;
    } catch (error: any) {
      const msg = error?.message || String(error);
      // Handle known initialization errors that shouldn't crash the app
      if (
        msg.includes('already initialized') || 
        msg.includes('match existing apps') ||
        msg.includes('different appId')
      ) {
        console.warn('OneSignal initialization warning (skipping):', msg);
        return;
      }
      console.error('OneSignal Init Error:', error);
    }
  })();

  return initPromise;
}

export function isOneSignalReady() {
  return initSuccess;
}
