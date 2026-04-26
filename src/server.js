const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const { createApiRouter } = require('./routes/api');
const { createPagesRouter } = require('./routes/pages');
const { registerBanSocket } = require('./sockets/bans.socket');
const { StateService } = require('./services/state.service');
const { MediaQueueService } = require('./services/media-queue.service');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const publicDir = path.join(__dirname, '../public');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const stateService = new StateService();
const mediaQueue = new MediaQueueService({ stateService, io });

app.disable('x-powered-by');
app.use(express.json());

app.use('/assets', express.static(path.join(publicDir, 'assets'), {
  immutable: true,
  maxAge: '1y',
}));
app.use('/shared', express.static(path.join(publicDir, 'shared')));
app.use('/admin', express.static(path.join(publicDir, 'admin')));
app.use('/overlay', express.static(path.join(publicDir, 'overlay')));
app.use('/', createPagesRouter(publicDir));
app.use('/api', createApiRouter({ stateService, mediaQueue }));

registerBanSocket({ io, stateService, mediaQueue });

server.listen(PORT, HOST, () => {
  console.log(`WC3 map ban server listening on http://${HOST}:${PORT}`);
});
