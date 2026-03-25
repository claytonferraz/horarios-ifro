import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocketClient() {
  if (socketInstance) return socketInstance;

  socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3012', {
    transports: ['websocket'],
    withCredentials: true
  });

  return socketInstance;
}
