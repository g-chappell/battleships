import type { Server as SocketIOServer } from 'socket.io';

let _io: SocketIOServer | null = null;

export function setIo(io: SocketIOServer): void {
  _io = io;
}

export function getConnectedCount(): number {
  return _io?.engine.clientsCount ?? 0;
}
