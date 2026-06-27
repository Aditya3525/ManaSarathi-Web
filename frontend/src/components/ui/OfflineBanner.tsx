import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';

/**
 * Sticky banner that alerts the user when they go offline.
 * Triggers a success notification once the connection is restored.
 */
export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOffline(false);
      useNotificationStore.getState().success(
        "You're back online!",
        "Your internet connection has been successfully restored."
      );
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="sticky top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-destructive text-destructive-foreground px-4 py-2.5 text-center text-sm font-medium shadow-md transition-all duration-300"
      role="status"
    >
      <WifiOff className="h-4 w-4 animate-pulse flex-shrink-0" />
      <span>You're offline. Please check your internet connection.</span>
    </div>
  );
};
