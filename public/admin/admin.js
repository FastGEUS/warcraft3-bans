import { createSocket, formatTime, sortMaps } from '/shared/socket.js';

const socket = createSocket();

const refs = {
  connection: document.querySelector('[data-testid="status-connection"]'),
  connectionLabel: document.querySelector('[data-connection-label]'),
  phaseBadge: document.querySelector('[data-phase-badge]'),
  startReveal: document.querySelector('[data-action="startReveal"]'),
  reset: document.querySelector('[data-action="reset"]'),
  playersForm: document.querySelector('[data-players-form]'),
  player1Input: document.querySelector('[data-testid="input-player1"]'),
  player2Input: document.querySelector('[data-testid="input-player2"]'),
  queueList: document.querySelector('[data-queue-list]'),
  mapGrid: document.querySelector('[data-map-grid]'),
  mapCounter: document.querySelector('[data-map-counter]'),
  eventLog: document.querySelector('[data-event-log]'),
};

let currentState = null;
let eventHistory = [];

function emitAdminAction(eventName, payload = {}) {
  socket.emit(eventName, payload);
}

function statusLabel(status) {
  const labels = {
    idle: 'Available',
    banned: 'Banned',
    playing: 'Playing',
    played: 'Played',
  };

  return labels[status] || status;
}

function getPlayerName(state, playerKey) {
  return state.players?.[playerKey] || (playerKey === 'player1' ? 'Player 1' : 'Player 2');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);
}

function renderQueue(state) {
  refs.queueList.innerHTML = '';

  if (!state.revealQueue.length) {
    const empty = document.createElement('li');
    empty.textContent = state.phase === 'reveal' ? 'empty' : 'not started';
    refs.queueList.append(empty);
    return;
  }

  state.revealQueue.forEach((id) => {
    const item = document.createElement('li');
    item.textContent = id;
    refs.queueList.append(item);
  });
}

function renderMaps(state) {
  refs.mapGrid.innerHTML = '';

  const maps = sortMaps(state);
  const bannedCount = maps.filter((map) => map.status === 'banned').length;
  refs.mapCounter.textContent = `${bannedCount} / ${maps.length} banned`;

  maps.forEach((map) => {
    const card = document.createElement('article');
    card.className = `map-card is-${map.status}${map.selectedBy ? ' is-selected' : ''}`;
    card.dataset.testid = `card-map-${map.id}`;

    const isReveal = state.phase === 'reveal';
    const isBanned = map.status === 'banned';
    const selectedPlayerName = map.selectedBy ? getPlayerName(state, map.selectedBy) : '';
    const player1Name = getPlayerName(state, 'player1');
    const player2Name = getPlayerName(state, 'player2');

    card.innerHTML = `
      <div class="map-main">
        <div>
          <div class="map-code">${escapeHtml(map.shortName)}</div>
          <div class="map-name">${escapeHtml(map.name)}</div>
        </div>
        <div class="map-status-row">
          <span class="map-status" data-testid="status-map-${map.id}">${statusLabel(map.status)}</span>
          ${selectedPlayerName ? `<span class="selected-pill" data-testid="selected-map-${map.id}">${escapeHtml(selectedPlayerName)}</span>` : ''}
        </div>
      </div>
      <div class="map-pick-actions">
        <button class="map-button" data-kind="pick" data-action="select" data-player-key="player1" data-id="${map.id}" data-testid="button-select-player1-${map.id}">
          ${escapeHtml(player1Name)}
        </button>
        <button class="map-button" data-kind="pick" data-action="select" data-player-key="player2" data-id="${map.id}" data-testid="button-select-player2-${map.id}">
          ${escapeHtml(player2Name)}
        </button>
        <button class="map-button" data-kind="clear" data-action="clearSelection" data-id="${map.id}" data-testid="button-clear-selection-${map.id}">
          ×
        </button>
      </div>
      <div class="map-actions">
        <button class="map-button" data-kind="ban" data-action="ban" data-id="${map.id}" data-testid="button-ban-${map.id}">
          Ban
        </button>
        <button class="map-button" data-kind="unban" data-action="unban" data-id="${map.id}" data-testid="button-unban-${map.id}">
          Unban
        </button>
      </div>
    `;

    card.querySelector('[data-action="ban"]').disabled = isReveal || isBanned;
    card.querySelector('[data-action="unban"]').disabled = isReveal || !isBanned;
    card.querySelectorAll('[data-action="select"]').forEach((button) => {
      button.disabled = isReveal || isBanned;
    });
    card.querySelector('[data-action="clearSelection"]').disabled = isReveal || isBanned || !map.selectedBy;

    refs.mapGrid.append(card);
  });
}

function renderState(state) {
  currentState = state;
  refs.player1Input.value = getPlayerName(state, 'player1');
  refs.player2Input.value = getPlayerName(state, 'player2');
  refs.phaseBadge.textContent = state.phase;
  refs.phaseBadge.dataset.phase = state.phase;
  refs.startReveal.disabled = state.phase === 'reveal';
  renderQueue(state);
  renderMaps(state);
}

function renderLog() {
  refs.eventLog.innerHTML = '';

  if (!eventHistory.length) {
    const empty = document.createElement('li');
    empty.innerHTML = `<div class="event-time">—</div><div class="event-message">Пока нет событий.</div>`;
    refs.eventLog.append(empty);
    return;
  }

  eventHistory.slice(0, 30).forEach((event) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <div class="event-time">${formatTime(event.createdAt)}</div>
      <div class="event-message">${event.message}</div>
    `;
    refs.eventLog.append(item);
  });
}

refs.startReveal.addEventListener('click', () => emitAdminAction('admin:startReveal'));
refs.reset.addEventListener('click', () => emitAdminAction('admin:reset'));

refs.playersForm.addEventListener('submit', (event) => {
  event.preventDefault();
  emitAdminAction('admin:updatePlayers', {
    players: {
      player1: refs.player1Input.value,
      player2: refs.player2Input.value,
    },
  });
});

refs.mapGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) {
    return;
  }

  const id = button.dataset.id;
  if (button.dataset.action === 'ban') {
    emitAdminAction('admin:ban', { id });
  }

  if (button.dataset.action === 'unban') {
    emitAdminAction('admin:unban', { id });
  }

  if (button.dataset.action === 'select') {
    emitAdminAction('admin:selectMap', { id, playerKey: button.dataset.playerKey });
  }

  if (button.dataset.action === 'clearSelection') {
    emitAdminAction('admin:clearSelection', { id });
  }
});

socket.on('connect', () => {
  refs.connection.classList.add('is-online');
  refs.connectionLabel.textContent = 'Online';
});

socket.on('disconnect', () => {
  refs.connection.classList.remove('is-online');
  refs.connectionLabel.textContent = 'Offline';
});

socket.on('state:full', renderState);
socket.on('session:reset', renderState);

socket.on('event:history', (events) => {
  eventHistory = events;
  renderLog();
});

socket.on('event:log', (event) => {
  eventHistory.unshift(event);
  eventHistory.splice(60);
  renderLog();
});

socket.on('action:error', (error) => {
  eventHistory.unshift({
    id: `error-${Date.now()}`,
    message: error.message,
    createdAt: error.createdAt || Date.now(),
  });
  renderLog();
});

fetch('/api/state')
  .then((response) => response.json())
  .then(renderState)
  .catch(() => {
    refs.connectionLabel.textContent = 'API error';
  });
