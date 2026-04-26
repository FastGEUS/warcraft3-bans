export function createSocket(namespace = '') {
  if (!window.io) {
    throw new Error('Socket.IO client was not loaded.');
  }

  return window.io(namespace, {
    transports: ['websocket', 'polling'],
  });
}

export function formatTime(timestamp) {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}

export function sortMaps(state) {
  return Object.values(state.maps || {}).sort((a, b) => a.order - b.order);
}
