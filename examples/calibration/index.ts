import * as express from 'express';
import { Server as WebSocketServer } from 'ws';
import * as http from 'http';
import * as path from 'path';
import { Renderer } from './renderer';

const PORT = 8321;

const renderer = new Renderer();

const server = http.createServer();
const app = express();
app.use(express.static(path.join(__dirname, '/public')));
const wss = new WebSocketServer({ server });

server.on('request', app);
server.listen(PORT, function () {
  console.log(`Started Calibration Interface on http://localhost:${PORT}`);
});

function broadcast(type: string, data: any) {
  const message = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    client.send(message, () => {
      // Ignore errors for now.
    });
  });
}

wss.on('connection', function connection(ws) {
  function send(type: string, data: any) {
    ws.send(JSON.stringify({ type, data }));
  }

  const statsInterval = setInterval(
    () => send('stats', renderer.getStats()),
    300
  );
  send('state', renderer.getState());

  ws.on('message', function incoming(message) {
    let payload;
    try {
      payload = JSON.parse(message as string);
    } catch (e) {
      console.error('Illegal JSON from client', message);
      return;
    }

    switch (payload.type) {
      case 'setSettings':
        console.log('Updating settings', payload.data);
        renderer.updateSettings(payload.data);
        break;
      case 'setPattern':
        console.log('Selecting pattern', payload.data);
        renderer.selectPattern(payload.data.patternId);
        break;
      case 'setPatternParams':
        renderer.updatePatternParams(
          payload.data.patternId,
          payload.data.values
        );
        break;
      default:
        console.log('Unknown websocket message', payload);
        return;
    }
    // Keep every client's expected view and controls in sync.
    broadcast('state', renderer.getState());
  });

  ws.on('close', function () {
    clearInterval(statsInterval);
  });
});
