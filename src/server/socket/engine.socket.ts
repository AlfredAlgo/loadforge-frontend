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
    reconnectionDelayMax: 5000,
    // The backend can cold-start (Azure "Always On" off, redeploys, etc.),
    // which easily takes longer than a handful of quick retries to come
    // back up. Keep retrying with backoff instead of giving up for good
    // after ~2.5s and leaving this cached socket permanently disconnected
    // until the whole Next.js process restarts.
    reconnectionAttempts: Infinity,
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

// Mutations that need the socket call this instead of reading `.connected`
// directly. If the backend cold-started and dropped the old connection,
// this actively (re)connects and waits, rather than failing immediately
// just because the socket happened to be mid-reconnect at that instant.
export function ensureSocketConnected(
  socket: Socket,
  timeoutMs = 15000,
): Promise<void> {
  if (socket.connected) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      reject(new Error("Socket not connected. Please ensure the backend is running."));
    }, timeoutMs);

    function onConnect() {
      clearTimeout(timer);
      resolve();
    }

    socket.once("connect", onConnect);
    if (!socket.active) {
      socket.connect();
    }
  });
}
