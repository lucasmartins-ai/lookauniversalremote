import { useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean = true) {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let isSubscribed = true;

    const requestLock = async () => {
      try {
        if (!wakeLockRef.current || wakeLockRef.current.released) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err: any) {
        // WakeLock can fail if battery saver is on or user minimizes tab
        console.warn('Screen WakeLock request failed:', err?.message || err);
      }
    };

    const releaseLock = async () => {
      try {
        if (wakeLockRef.current && !wakeLockRef.current.released) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      } catch (err) {
        console.warn('Screen WakeLock release error:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSubscribed) {
        requestLock();
      }
    };

    requestLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseLock();
    };
  }, [enabled]);
}
