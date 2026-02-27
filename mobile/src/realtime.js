const WS_URL = process.env.SMARTWISHLIST_WS_URL || "wss://smartwishlist-production.up.railway.app/ws";

export function connectWishlistSocket(slug, onMessage) {
  const socket = new WebSocket(`${WS_URL}/wishlists/${slug}`);
  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore
    }
  };
  return socket;
}
