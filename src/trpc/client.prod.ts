import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { appRouter } from "../server/api/root";
import { createWSContext } from "../server/api/trpc";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0"; // Listen on all interfaces for Docker
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

void app.prepare().then(() => {
  // Create HTTP server for Next.js
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Attach WebSocket server to the same HTTP server
  const wss = new WebSocketServer({
    server, // Attach to HTTP server
    path: "/api/trpc-ws", // WebSocket endpoint path
  });

  const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: createWSContext,
    keepAlive: {
      enabled: true,
      pingMs: 30000,
      pongWaitMs: 50000,
    },
  });

  wss.on("connection", (socket) => {
    console.log(`➕➕ WebSocket Connection (${wss.clients.size})`);
    socket.once("close", () => {
      console.log(`➖➖ WebSocket Connection (${wss.clients.size})`);
    });
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: closing servers");
    handler.broadcastReconnectNotification();
    wss.close();
    server.close();
  });

  server.listen(port, () => {
    console.log(`> Next.js ready on http://localhost:${port}`);
    console.log(`> WebSocket ready on ws://localhost:${port}/api/trpc-ws`);
  });
});