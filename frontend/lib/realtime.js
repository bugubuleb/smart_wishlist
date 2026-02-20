export function connectWishlistSocket(slug, onMessage) {
  const url = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws"}/wishlists/${slug}`;
  const socket = new WebSocket(url);

  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // Ignore malformed payloads in skeleton mode.
    }
  };

  return socket;
}
