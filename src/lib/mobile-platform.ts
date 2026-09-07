import { Capacitor } from '@capacitor/core';

// Initial native distribution is a companion to existing accounts. Keep web billing intact.
export const isNativeApp = () => Capacitor.isNativePlatform();
export const canPurchaseInApp = () => !isNativeApp();
export const authEmailReturnUrl = (origin: string, recovery = false) =>
  `${isNativeApp() ? 'https://trycasher.com' : origin}/auth${recovery ? '?mode=recovery' : ''}`;

export async function nativeLifecycle(callbacks: {onUrl:(url:string)=>void;onState:(active:boolean)=>void;onBack:()=>boolean}) {
  const { App } = await import('@capacitor/app');
  const subscriptions: Array<{remove:()=>Promise<void>}> = [];
  try {
  subscriptions.push(await App.addListener('appUrlOpen',event=>callbacks.onUrl(event.url)));
  subscriptions.push(await App.addListener('appStateChange',state=>callbacks.onState(state.isActive)));
  subscriptions.push(await App.addListener('backButton',()=>{if(!callbacks.onBack()) void App.minimizeApp();}));
  const launch=await App.getLaunchUrl();
  if(launch?.url) callbacks.onUrl(launch.url);
  callbacks.onState((await App.getState()).isActive);
  return async()=>{await Promise.all(subscriptions.map(item=>item.remove()));};
  } catch(error) {
    await Promise.allSettled(subscriptions.map(item=>item.remove()));
    throw error;
  }
}
