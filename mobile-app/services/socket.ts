import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/constants/config';
import type { VitalReading } from '@/types/vitals';
import { normalizeVitalReading } from '@/utils/vitals';

let socket: Socket | null = null;

export type VitalsUpdateHandler = (payload: VitalReading) => void;
export type AlertHandler = (alert: Record<string, unknown>) => void;

export function connectRealtimeSocket(
  onVitals: VitalsUpdateHandler,
  onAlert?: AlertHandler
): Socket {
  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  console.log('[Socket.IO] Connecting to', API_BASE_URL);

  socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO] Disconnected', reason);
  });

  socket.on('connect_error', (err) => {
    console.log('[Socket.IO] connect_error', err.message);
  });

  socket.on('vitals:update', (payload: VitalReading) => {
    console.log('[Socket.IO] vitals:update', payload.patientId);
    onVitals(normalizeVitalReading(payload));
  });

  if (onAlert) {
    socket.on('alert:new', (alert: Record<string, unknown>) => {
      console.log('[Socket.IO] alert:new', alert);
      onAlert(alert);
    });
  }

  return socket;
}

export function disconnectRealtimeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
