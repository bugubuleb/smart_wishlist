import { WebSocketServer } from "ws";

import { broadcast, joinRoom, leaveRoom } from "./hub.js";

function parseSlug(pathname = "") {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "ws" && parts[1] === "wishlists" && parts[2]) {
    return parts[2];
  }
  return null;
}

export function attachRealtimeServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url, "http://localhost");
    const slug = parseSlug(url.pathname);

    if (!slug) {
      socket.close();
      return;
    }

    joinRoom(slug, socket);

    socket.on("message", (raw) => {
      try {
        const event = JSON.parse(String(raw));
        broadcast(slug, event);
      } catch {
        // Ignore malformed events in skeleton mode.
      }
    });

    socket.on("close", () => leaveRoom(slug, socket));
  });
}
