import { io, Socket } from "socket.io-client";
import { env } from "~/env";

// Persist the socket on globalThis so Next.js dev-mode HMR doesn't churn out
// a fresh connection on every recompile. Same trick the db module uses.
const globalForSocket = globalThis as unknown as {
  _appSocket?: Socket;
  _appSocketBound?: boolean;
};

const socketUrl = env.SOCKET_URL || "http://localhost:5001";

export function getSocket(): Socket {
  if (globalForSocket._appSocket) {
    return globalForSocket._appSocket;
  }

  const socket = io(socketUrl, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 5,
  });

  if (!globalForSocket._appSocketBound) {
    globalForSocket._appSocketBound = true;

    socket.on("connect", () => {
      console.log("✅ [SOCKET.IO] Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 [SOCKET.IO] Disconnected:", reason);
    });

    socket.on("error", (error) => {
      console.error("❌ [SOCKET.IO] Error:", error);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("🔄 [SOCKET.IO] Reconnected after", attemptNumber, "attempts");
    });
  }

  globalForSocket._appSocket = socket;
  return socket;
}

export function isSocketReady(): boolean {
  const s = globalForSocket._appSocket;
  return !!s && s.connected;
}
