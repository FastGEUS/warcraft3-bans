# WC3 Map Ban Overlay

Локальный Node.js-инструмент для банов карт Warcraft 3: отдельная админка `/admin`, прозрачный OBS overlay `/overlay`, серверное состояние и синхронизация через Socket.IO.

## Что внутри

- `Express` отдаёт страницы, ассеты и API.
- `Socket.IO` синхронизирует `/admin` и `/overlay`.
- Сервер хранит состояние карт в памяти процесса.
- `/overlay` не имеет фона: `html`, `body` и `.overlay-stage` остаются прозрачными.
- Для забаненных карт overlay не подставляет отдельные ЧБ PNG. Он останавливает видео на первом кадре и перекрашивает само видео CSS-фильтром.
- Reveal queue запускается сервером: overlay проигрывает карту, отправляет `overlay:videoEnded`, затем сервер запускает следующую.

## Структура

```text
wc3-map-ban/
├─ src/
│  ├─ server.js
│  ├─ routes/
│  │  ├─ pages.js
│  │  └─ api.js
│  ├─ sockets/
│  │  └─ bans.socket.js
│  ├─ services/
│  │  ├─ state.service.js
│  │  └─ media-queue.service.js
│  └─ config/
│     └─ maps.config.js
├─ public/
│  ├─ admin/
│  ├─ overlay/
│  ├─ shared/
│  └─ assets/
│     └─ maps/
└─ package.json
```

## Установка

```bash
npm install
npm run dev
```

Или без hot reload:

```bash
npm start
```

По умолчанию сервер стартует на `http://127.0.0.1:3000`.

## Страницы

- Admin: `http://127.0.0.1:3000/admin`
- Overlay: `http://127.0.0.1:3000/overlay`
- Healthcheck: `http://127.0.0.1:3000/health`

## Ассеты

Положи видео карт сюда:

```text
public/assets/maps/TV.mp4
public/assets/maps/FP.mp4
public/assets/maps/RL.mp4
public/assets/maps/WH.mp4
public/assets/maps/TW.mp4
public/assets/maps/FA.mp4
public/assets/maps/MS.mp4
```

Если ассетов нет, overlay покажет текстовый fallback с кодом карты. Это удобно для теста логики до подключения финальных медиа.

## OBS

1. Добавь Browser Source.
2. URL: `http://127.0.0.1:3000/overlay`.
3. Width/Height: обычно `1920x1080`.
4. CSS в OBS можно оставить пустым.
5. Включи `Refresh browser when scene becomes active`, если нужно каждый раз начинать со свежего состояния.
6. Фон не встроен в overlay. Если нужен фон, добавляй его отдельным источником ниже overlay.

## Настройка позиций

Позиции слотов задаются в `src/config/maps.config.js`:

```js
slot: { x: 6, y: 17, w: 21, h: 19 }
```

Все значения в процентах от размера Browser Source:

- `x` — отступ слева
- `y` — отступ сверху
- `w` — ширина
- `h` — высота

## Socket-события

Сервер → клиенты:

- `state:full`
- `state:update`
- `phase:update`
- `queue:start`
- `map:play`
- `queue:complete`
- `session:reset`
- `event:log`

Клиент → сервер:

- `admin:ban`
- `admin:unban`
- `admin:startReveal`
- `admin:reset`
- `overlay:videoEnded`

## PM2

```bash
npm install -g pm2
pm2 start src/server.js --name wc3-map-ban
pm2 save
```

Для автозапуска после перезагрузки:

```bash
pm2 startup
```

PM2 выведет команду, которую нужно выполнить с правами администратора.
