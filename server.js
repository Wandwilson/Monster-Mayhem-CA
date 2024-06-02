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
        gameMessage(ws, data);
    });

    ws.send(JSON.stringify({ message: 'Welcome to Monster Mayhem!' }));
});

function gameMessage(ws, data) {
    const { type, payload } = data;
    switch (type) {
        case 'startGame':
            startGame(ws, payload);
            break;
        case 'placeMonster':
            handlePlaceMonster(ws, payload);
            break;
        case 'moveMonster':
            handleMoveMonster(ws, payload);
            break;
        case 'resetGame':
            handleResetGame(ws, payload);
            break;
        default:
            console.log('Unknown message type:', type);
    }
}

function startGame(ws, { gameId, playerName }) {
    if (!games[gameId]) {
        games[gameId] = {
            players: [{ playerName, ws }],
            state: Array(10).fill().map(() => Array(10).fill(null)),
            turn: playerName,
            lastPlaced: null,
            scores: { [playerName]: 0 }
        };
    } else {
        games[gameId].players.push({ playerName, ws });
        games[gameId].scores[playerName] = 0; // Initialize score if player joins an existing game
    }
    players[playerName] = ws;
    ws.send(JSON.stringify({ type: 'gameState', payload: sanitizeGameState(games[gameId]) }));
}

server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});