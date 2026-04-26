import { createSocket, sortMaps } from '/shared/socket.js';

const socket = createSocket();
const stage = document.querySelector('[data-overlay-stage]');
const slotElements = new Map();
let currentState = null;
let fallbackTimers = new Map();

function setSlotGeometry(element, slot) {
  element.style.left = `${slot.x}%`;
  element.style.top = `${slot.y}%`;
  element.style.width = `${slot.w}%`;
  element.style.height = `${slot.h}%`;
}

function primeVideo(video) {
  const pauseAtStart = () => {
    try {
      video.pause();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = 0;
      }
    } catch (error) {
      // Some browsers reject currentTime before metadata is ready. It is safe to ignore.
    }
  };

  video.addEventListener('loadeddata', pauseAtStart, { once: true });
  video.addEventListener('loadedmetadata', pauseAtStart, { once: true });
}

function createMapSlot(map) {
  const slot = document.createElement('section');
  slot.className = `map-slot is-${map.status}`;
  slot.dataset.mapId = map.id;
  slot.dataset.testid = `overlay-map-${map.id}`;
  setSlotGeometry(slot, map.slot);

  const fallback = document.createElement('div');
  fallback.className = 'fallback-layer';
  fallback.textContent = map.shortName;

  const video = document.createElement('video');
  video.className = 'map-video';
  video.src = map.videoSrc;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('data-testid', `video-map-${map.id}`);
  video.addEventListener('loadeddata', () => slot.classList.add('has-video'), { once: true });
  video.addEventListener('error', () => slot.classList.remove('has-video'));
  video.addEventListener('ended', () => socket.emit('overlay:videoEnded', { id: map.id }));
  primeVideo(video);

  const label = document.createElement('div');
  label.className = 'map-label';
  label.textContent = `${map.shortName} · ${map.name}`;

  slot.append(fallback, video, label);
  stage.append(slot);
  slotElements.set(map.id, { slot, video, fallback, label });
}

function updateSlot(map) {
  const entry = slotElements.get(map.id);
  if (!entry) {
    createMapSlot(map);
    return;
  }

  const { slot, video } = entry;
  slot.classList.remove('is-idle', 'is-banned', 'is-playing', 'is-played');
  slot.classList.add(`is-${map.status}`);
  setSlotGeometry(slot, map.slot);

  if (map.status === 'idle' || map.status === 'banned') {
    try {
      video.pause();
      video.currentTime = 0;
    } catch (error) {
      // Keeping overlay resilient is more important than surfacing browser media timing errors.
    }
  }
}

function renderState(state) {
  currentState = state;
  const maps = sortMaps(state);
  const knownIds = new Set(maps.map((map) => map.id));

  maps.forEach((map) => {
    if (!slotElements.has(map.id)) {
      createMapSlot(map);
    }

    updateSlot(map);
  });

  slotElements.forEach((entry, id) => {
    if (!knownIds.has(id)) {
      entry.slot.remove();
      slotElements.delete(id);
    }
  });
}

async function playMap(id) {
  const entry = slotElements.get(id);
  if (!entry) {
    socket.emit('overlay:videoEnded', { id });
    return;
  }

  const { video } = entry;
  const map = currentState?.maps?.[id];

  if (map?.status === 'banned') {
    try {
      video.pause();
      video.currentTime = 0;
    } catch (error) {
      // Ignore media timing errors and keep the queue moving.
    }
    socket.emit('overlay:videoEnded', { id });
    return;
  }

  if (fallbackTimers.has(id)) {
    clearTimeout(fallbackTimers.get(id));
    fallbackTimers.delete(id);
  }

  try {
    video.pause();
    video.currentTime = 0;
    await video.play();
  } catch (error) {
    const timer = setTimeout(() => {
      socket.emit('overlay:videoEnded', { id });
      fallbackTimers.delete(id);
    }, 900);
    fallbackTimers.set(id, timer);
  }
}

socket.on('state:full', renderState);
socket.on('session:reset', renderState);
socket.on('map:play', ({ id }) => playMap(id));

fetch('/api/state')
  .then((response) => response.json())
  .then(renderState)
  .catch(() => {
    // OBS should stay visually clean even when the server is not ready.
  });
