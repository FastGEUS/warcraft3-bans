class MediaQueueService {
  constructor({ stateService, io, delayMs = 350 }) {
    this.stateService = stateService;
    this.io = io;
    this.delayMs = delayMs;
    this.queue = [];
    this.currentMapId = null;
    this.timer = null;
  }

  start(queue) {
    this.stop();
    this.queue = [...queue];
    this.stateService.setRevealQueue(this.queue);
    this.io.emit('queue:start', { queue: this.queue });
    this.scheduleNext();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.queue = [];
    this.currentMapId = null;
  }

  scheduleNext() {
    this.timer = setTimeout(() => this.playNext(), this.delayMs);
  }

  playNext() {
    this.timer = null;

    if (this.queue.length === 0) {
      this.currentMapId = null;
      this.stateService.setRevealQueue([]);
      this.io.emit('queue:complete', this.stateService.getState());
      return;
    }

    const nextMapId = this.queue.shift();
    this.currentMapId = nextMapId;
    const map = this.stateService.markPlaying(nextMapId);
    this.stateService.setRevealQueue(this.queue);

    this.io.emit('state:update', { map });
    this.io.emit('state:full', this.stateService.getState());
    this.io.emit('map:play', { id: nextMapId });
  }

  handleVideoEnded(id) {
    if (!this.currentMapId || id !== this.currentMapId) {
      return {
        accepted: false,
        reason: 'No active matching video.',
      };
    }

    const map = this.stateService.markPlayed(id);
    this.currentMapId = null;
    this.io.emit('state:update', { map });
    this.io.emit('state:full', this.stateService.getState());
    this.scheduleNext();

    return {
      accepted: true,
      id,
    };
  }
}

module.exports = { MediaQueueService };
