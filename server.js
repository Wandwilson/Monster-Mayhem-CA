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
            placeMonster(ws, payload);
            break;
        case 'moveMonster':
            moveMonster(ws, payload);
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

function placeMonster(ws, { gameId, playerName, position, monsterType }) {
    const game = getGameState(gameId);
    if (game && game.turn === playerName) {
        if (game.scores[playerName] < 10) {
            if (isValidPosition(game.state, position)) {
                const row = game.state[position.y];
                if (!row) {
                    return;
                }

                const cell = row[position.x];
                if (cell === undefined) {
                    return;
                }

                if (!cell) {
                    game.state[position.y][position.x] = { playerName, type: monsterType };
                    game.lastPlaced = { x: position.x, y: position.y };
                    game.turn = getNextPlayer(game);
                    game.scores[playerName]++;
                    updateGameState(gameId, game);
                    broadcastGameState(gameId, game);
                }
            }
        } else {
            
            ws.send(JSON.stringify({ type: 'error', message: 'You have reached the monster limit!' }));
        }
    }
}


function moveMonster(ws, { gameId, playerName, from, to }) {
    const game = getGameState(gameId);
    if (game && game.turn === playerName) {
        const monster = game.state[from.y][from.x];
        if (monster && monster.playerName === playerName) {
            if (isValidMove(game, from, to)) {
                const targetMonster = game.state[to.y][to.x];
                if (targetMonster) {
                    if (targetMonster.playerName !== playerName) {
                        const result = resolveCombat(monster, targetMonster);
                        if (result === 'both') {
                            game.state[to.y][to.x] = null;
                        } else if (result === 'current') {
                            game.state[to.y][to.x] = monster;
                        }
                    } else {
                        return;
                    }
                } else {
                    game.state[to.y][to.x] = monster;
                }
                game.state[from.y][from.x] = null;

                game.turn = getNextPlayer(game);
                updateGameState(gameId, game);
                broadcastGameState(gameId, game);
            }
        } 
    } 
}

function broadcastGameState(gameId, game) {
    const gameState = sanitizeGameState(game);
    
    // // Verifique se game.players e game.scores estão definidos antes de acessá-los
    // if (!game.players || !game.scores) {
    //     console.error('Invalid game state: Missing players or scores');
    //     return;
    // }

    // Count how many moster each player have
    const playerMonstersCount = {};
    game.players.forEach(player => {
        playerMonstersCount[player.playerName] = countPlayerMonsters(game.state, player.playerName);
    });

    // Show status of the game
    game.players.forEach(({ playerName }) => {
        const ws = players[playerName];
        if (ws) {
            const gameStatePayload = {
                ...gameState,
                playerMonstersCount,
                scores: game.scores
            };
            ws.send(JSON.stringify({ type: 'gameState', payload: gameStatePayload }));
        }
    });
}

function sanitizeGameState(game) {
    return {
        players: game.players.map(p => ({ playerName: p.playerName })),
        state: game.state,
        turn: game.turn,
        scores: game.scores
    };
}
server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});