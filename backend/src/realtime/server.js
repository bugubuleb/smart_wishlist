import { WebSocketServer } from "ws";

import { broadcast, joinRoom, leaveRoom } from "./hub.js";
import { verifyAccessToken } from "../services/auth.js";

function parseSlug(pathname = "") {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "ws" && parts[1] === "wishlists" && parts[2]) {
    return parts[2];
  }
  return null;
}

function parseUserRoom(pathname = "", searchParams = new URLSearchParams()) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "ws" && parts[1] === "notifications") {
    const token = searchParams.get("token");
    if (!token) return null;
    try {
      const payload = verifyAccessToken(token);
      if (!payload?.userId) return null;
      return `user:${payload.userId}`;
    } catch {
      return null;
    }
  }
  return null;
}

export function attachRealtimeServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url, "http://localhost");
    const slug = parseSlug(url.pathname);
    const userRoom = parseUserRoom(url.pathname, url.searchParams);

    const roomId = slug || userRoom;
    if (!roomId) {
      socket.close();
      return;
    }

    joinRoom(roomId, socket);

    socket.on("message", (raw) => {
      if (!slug) return;
      try {
        const event = JSON.parse(String(raw));
        broadcast(slug, event);
      } catch {
        // Ignore malformed events in skeleton mode.
      }
    });

    socket.on("close", () => leaveRoom(roomId, socket));
  });
}
