import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { setupDatabase } from './database';
import { setupSocket } from './socket';
import { setupRoutes } from './routes';

const PORT = process.env.PORT || 3001;

async function main() {
  await setupDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' }
  });

  setupRoutes(app);
  setupSocket(io);

  server.listen(PORT, () => {
    console.log(`🚀 服务运行在 http://localhost:${PORT}`);
  });
}

main().catch(console.error);
