const WebSocket = require('ws');

const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

ws.on('open', () => {
  console.log('WebSocket connection successful');
});

ws.on('error', (error) => {
  console.error(`WebSocket error: ${error}`);
});