const { maps: mapConfig } = require('../config/maps.config');

const PHASES = Object.freeze({
  BANNING: 'banning',
  REVEAL: 'reveal',
});

const MAP_STATUSES = Object.freeze({
  IDLE: 'idle',
  BANNED: 'banned',
  PLAYING: 'playing',
  PLAYED: 'played',
});

const DEFAULT_PLAYERS = Object.freeze({
  player1: 'Player 1',
  player2: 'Player 2',
});

class StateService {
  constructor(maps = mapConfig) {
    this.mapsConfig = maps;
    this.state = this.createInitialState();
  }

  createInitialState() {
    const maps = {};

    this.mapsConfig.forEach((map) => {
      maps[map.id] = {
        ...map,
        status: MAP_STATUSES.IDLE,
        selectedBy: null,
      };
    });

    return {
      phase: PHASES.BANNING,
      players: { ...DEFAULT_PLAYERS },
      maps,
      revealQueue: [],
      activeMapId: null,
      updatedAt: Date.now(),
    };
  }

  getState() {
    return structuredClone(this.state);
  }

  getMap(id) {
    return this.state.maps[id] || null;
  }

  assertBanningPhase() {
    if (this.state.phase !== PHASES.BANNING) {
      throw new Error('Map changes are locked after reveal has started.');
    }
  }

  touch() {
    this.state.updatedAt = Date.now();
  }

  banMap(id) {
    this.assertBanningPhase();
    const map = this.getMap(id);
    if (!map) {
      throw new Error(`Unknown map id: ${id}`);
    }

    map.status = MAP_STATUSES.BANNED;
    map.selectedBy = null;
    this.touch();
    return structuredClone(map);
  }

  unbanMap(id) {
    this.assertBanningPhase();
    const map = this.getMap(id);
    if (!map) {
      throw new Error(`Unknown map id: ${id}`);
    }

    map.status = MAP_STATUSES.IDLE;
    this.touch();
    return structuredClone(map);
  }

  updatePlayers(players = {}) {
    const normalize = (value, fallback) => {
      const normalized = String(value || '').trim();
      return normalized || fallback;
    };

    this.state.players = {
      player1: normalize(players.player1, DEFAULT_PLAYERS.player1),
      player2: normalize(players.player2, DEFAULT_PLAYERS.player2),
    };

    this.touch();
    return structuredClone(this.state.players);
  }

  selectMap(id, playerKey) {
    this.assertBanningPhase();

    if (!Object.hasOwn(this.state.players, playerKey)) {
      throw new Error(`Unknown player key: ${playerKey}`);
    }

    const map = this.getMap(id);
    if (!map) {
      throw new Error(`Unknown map id: ${id}`);
    }

    if (map.status === MAP_STATUSES.BANNED) {
      throw new Error(`Cannot select banned map: ${id}`);
    }

    map.selectedBy = playerKey;
    this.touch();
    return structuredClone(map);
  }

  clearSelection(id) {
    this.assertBanningPhase();
    const map = this.getMap(id);
    if (!map) {
      throw new Error(`Unknown map id: ${id}`);
    }

    map.selectedBy = null;
    this.touch();
    return structuredClone(map);
  }

  startReveal() {
    if (this.state.phase === PHASES.REVEAL) {
      return this.getState();
    }

    const queue = Object.values(this.state.maps)
      .filter((map) => map.status !== MAP_STATUSES.BANNED)
      .sort((a, b) => a.order - b.order)
      .map((map) => map.id);

    this.state.phase = PHASES.REVEAL;
    this.state.revealQueue = queue;
    this.state.activeMapId = null;
    this.touch();
    return this.getState();
  }

  markPlaying(id) {
    const map = this.getMap(id);
    if (!map) {
      throw new Error(`Unknown map id: ${id}`);
    }

    if (map.status === MAP_STATUSES.BANNED) {
      throw new Error(`Cannot play banned map: ${id}`);
    }

    map.status = MAP_STATUSES.PLAYING;
    this.state.activeMapId = id;
    this.touch();
    return structuredClone(map);
  }

  markPlayed(id) {
    const map = this.getMap(id);
    if (!map) {
      throw new Error(`Unknown map id: ${id}`);
    }

    if (map.status !== MAP_STATUSES.BANNED) {
      map.status = MAP_STATUSES.PLAYED;
    }

    if (this.state.activeMapId === id) {
      this.state.activeMapId = null;
    }

    this.touch();
    return structuredClone(map);
  }

  setRevealQueue(queue) {
    this.state.revealQueue = [...queue];
    this.touch();
    return [...this.state.revealQueue];
  }

  resetAll() {
    this.state = this.createInitialState();
    return this.getState();
  }
}

module.exports = {
  StateService,
  PHASES,
  MAP_STATUSES,
  DEFAULT_PLAYERS,
};
