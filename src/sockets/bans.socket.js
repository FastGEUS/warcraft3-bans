function registerBanSocket({ io, stateService, mediaQueue }) {
  const eventLog = [];

  const pushLog = (type, message, payload = {}) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      message,
      payload,
      createdAt: Date.now(),
    };

    eventLog.unshift(entry);
    eventLog.splice(60);
    io.emit('event:log', entry);
    return entry;
  };

  const broadcastFullState = () => {
    io.emit('state:full', stateService.getState());
  };

  const emitError = (socket, error) => {
    socket.emit('action:error', {
      message: error.message || 'Unknown error',
      createdAt: Date.now(),
    });
  };

  io.on('connection', (socket) => {
    socket.emit('state:full', stateService.getState());
    socket.emit('event:history', eventLog);

    socket.on('admin:ban', ({ id }) => {
      try {
        const map = stateService.banMap(id);
        io.emit('state:update', { map });
        broadcastFullState();
        pushLog('ban', `${map.shortName} banned`, { id });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('admin:unban', ({ id }) => {
      try {
        const map = stateService.unbanMap(id);
        io.emit('state:update', { map });
        broadcastFullState();
        pushLog('unban', `${map.shortName} returned to pool`, { id });
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('admin:startReveal', () => {
      try {
        const state = stateService.startReveal();
        io.emit('phase:update', { phase: state.phase });
        broadcastFullState();
        pushLog('reveal', 'Reveal sequence started', { queue: state.revealQueue });
        mediaQueue.start(state.revealQueue);
      } catch (error) {
        emitError(socket, error);
      }
    });

    socket.on('admin:reset', () => {
      mediaQueue.stop();
      const state = stateService.resetAll();
      io.emit('session:reset', state);
      broadcastFullState();
      pushLog('reset', 'Session reset');
    });

    socket.on('overlay:videoEnded', ({ id }) => {
      const result = mediaQueue.handleVideoEnded(id);

      if (result.accepted) {
        pushLog('videoEnded', `${id} video ended`, { id });
      }
    });
  });
}

module.exports = { registerBanSocket };
