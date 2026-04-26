import { createSocket, formatTime, sortMaps } from '/shared/socket.js';

const socket = createSocket();

const refs = {
  connection: document.querySelector('[data-testid="status-connection"]'),
  connectionLabel: document.querySelector('[data-connection-label]'),
  phaseBadge: document.querySelector('[data-phase-badge]'),
  startReveal: document.querySelector('[data-action="startReveal"]'),
  reset: document.querySelector('[data-action="reset"]'),
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
    card.className = `map-card is-${map.status}`;
    card.dataset.testid = `card-map-${map.id}`;

    const isReveal = state.phase === 'reveal';
    const isBanned = map.status === 'banned';

    card.innerHTML = `
      <div class="map-main">
        <div>
          <div class="map-code">${map.shortName}</div>
          <div class="map-name">${map.name}</div>
        </div>
        <span class="map-status" data-testid="status-map-${map.id}">${statusLabel(map.status)}</span>
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

    refs.mapGrid.append(card);
  });
}

function renderState(state) {
  currentState = state;
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
