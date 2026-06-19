import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkNetwork = async () => {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
    };

    checkNetwork();

    const listener = Network.addListener('networkStatusChange', status => {
      setIsOnline(status.connected);
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  return { isOnline };
}
