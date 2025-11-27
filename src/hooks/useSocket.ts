import { useEffect, useState, useCallback } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket-client';
import type { Socket } from 'socket.io-client';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = getSocket();
    setSocket(socketInstance);

    // Connect socket
    connectSocket();

    // Connection status handlers
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);

    // Set initial state
    setIsConnected(socketInstance.connected);

    // Cleanup on unmount
    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      // Note: Don't disconnect here, let other components use it
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      socket.emit(event, data, (response: any) => {
        if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Socket emit failed'));
        }
      });
    });
  }, [socket]);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socket?.on(event, handler);
    
    // Return cleanup function
    return () => {
      socket?.off(event, handler);
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    emit,
    on,
  };
}
