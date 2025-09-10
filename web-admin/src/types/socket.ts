import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer, Socket } from 'net';
import { Server as HTTPServer } from 'http';

export interface SocketServer extends HTTPServer {
  io?: SocketIOServer;
}

export interface SocketWithIO extends Socket {
  server: SocketServer;
}

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: SocketWithIO;
}