import { getSocket } from "./engine.socket";
import { publish } from "./eventbus";


export const eventBind = () => {
  const socket = getSocket();

  socket.on("connected", (data) => {
    publish({ type: "connected", data });
  });

  socket.on("test_started", (data) => {
    publish({ type: "test_started", data });
  });
  socket.on("phase_complete", (data) => {
    publish({ type: "phase_complete", data });
  });
  socket.on("test_completed", (data) => {
    publish({ type: "test_completed", data });
  });
  socket.on("error", (err) => {
    publish({ type: "error", data: err });
  });
};
