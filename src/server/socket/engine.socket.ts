import { io, Socket } from "socket.io-client";
import { env } from "~/env";
let socket: Socket | null = null;
let isInitialized = false;

const socketUrl = env.SOCKET_URL || "http://localhost:5001";
export function getSocket(): Socket {
  // Return existing socket instance if already created
  if (socket) {
    return socket;
  }

  // Create the single socket instance only once
  if (!isInitialized) {
    isInitialized = true;
    socket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionAttempts: 5,
    });

    // Set up event listeners only once
    socket.on("connect", () => {
      console.log("✅ [SOCKET.IO] Connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 [SOCKET.IO] Disconnected:", reason);
    });

    socket.on("error", (error) => {
      console.error("❌ [SOCKET.IO] Error:", error);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log(
        "🔄 [SOCKET.IO] Reconnected after",
        attemptNumber,
        "attempts"
      );
    });
  }

  return socket!;
}

export function isSocketReady(): boolean {
  return socket !== null && socket !== undefined && socket.connected;
}
