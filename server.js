const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });
const games = {};
const players = {};


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates', 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'static')));

const indexRouter = require('./routes/index');
app.use('/', indexRouter);

function getGameState(gameId) {
    return games[gameId] || null;
}

function updateGameState(gameId, state) {
    games[gameId] = state;
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        handleGameMessage(ws, data);
    });

    ws.send(JSON.stringify({ message: 'Welcome to Monster Mayhem!' }));
});


server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});