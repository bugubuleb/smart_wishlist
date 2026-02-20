const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

export function joinRoom(roomId, socket) {
  const room = getRoom(roomId);
  room.add(socket);
}

export function leaveRoom(roomId, socket) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(socket);
  if (room.size === 0) rooms.delete(roomId);
}

export function broadcast(roomId, payload) {
  const room = rooms.get(roomId);
  if (!room) return;

  const encoded = JSON.stringify(payload);
  room.forEach((socket) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(encoded);
    }
  });
}
