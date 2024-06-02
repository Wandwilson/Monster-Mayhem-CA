// Import necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');

// Initialize the Express application
const app = express();

// Create an HTTP server and a WebSocket server
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize objects to store games and players
const games = {};
const players = {};

// Set up EJS as the view engine and configure the views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates', 'views'));

// Use bodyParser middleware to parse URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'static' directory
app.use(express.static(path.join(__dirname, 'static')));

// Import and use the index router
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// Function to get the state of a game by its ID
function getGameState(gameId) {
    return games[gameId] || null;
}

// Function to update the state of a game by its ID
function updateGameState(gameId, state) {
    games[gameId] = state;
}

// WebSocket connection event
wss.on('connection', (ws) => {
    // WebSocket message event
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        handleGameMessage(ws, data);
    });

    // Send a welcome message to the WebSocket client
    ws.send(JSON.stringify({ message: 'Welcome to Monster Mayhem!' }));
});

// Function to handle game messages received via WebSocket
function handleGameMessage(ws, data) {
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

// Function to start a game
function startGame(ws, { gameId, playerName }) {
    if (!games[gameId]) {
        // If the game doesn't exist, create a new game
        games[gameId] = {
            players: [{ playerName, ws }],
            state: Array(10).fill().map(() => Array(10).fill(null)),
            turn: playerName,
            lastPlaced: null,
            scores: { [playerName]: 0 }
        };
    } else {
        // If the game exists, add the player to the existing game
        games[gameId].players.push({ playerName, ws });
        games[gameId].scores[playerName] = 0; // Initialize the player's score
    }
    players[playerName] = ws;
    ws.send(JSON.stringify({ type: 'gameState', payload: sanitizeGameState(games[gameId]) }));
}

// Function to place a monster on the board
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

// Function to move a monster on the board
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

// Function to broadcast the game state to all players
function broadcastGameState(gameId, game) {
    const gameState = sanitizeGameState(game);

    if (!game.players || !game.scores) {
        console.error('Invalid game state: Missing players or scores');
        return;
    }

    // Count how many monsters each player has
    const playerMonstersCount = {};
    game.players.forEach(player => {
        playerMonstersCount[player.playerName] = countPlayerMonsters(game.state, player.playerName);
    });

    // Send the updated game state to each player
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

// Function to count how many monsters a player has
function countPlayerMonsters(state, playerName) {
    let count = 0;
    state.forEach(row => {
        row.forEach(cell => {
            if (cell && cell.playerName === playerName) {
                count++;
            }
        });
    });
    return count;
}

// Function to sanitize the game state by removing unnecessary information
function sanitizeGameState(game) {
    return {
        players: game.players.map(p => ({ playerName: p.playerName })),
        state: game.state,
        turn: game.turn,
        scores: game.scores
    };
}

// Function to check if a position is valid on the board
function isValidPosition(state, position) {
    const numRows = state.length;
    const numCols = state[0].length;
    return position.x >= 0 && position.x < numCols && position.y >= 0 && position.y < numRows;
}

// Function to check if a move is valid
function isValidMove(game, from, to) {
    // Check if the destination cell is outside the board
    if (to.x < 0 || to.x >= game.state[0].length || to.y < 0 || to.y >= game.state.length) {
        console.error('Destination cell is outside the board:', to);
        return false;
    }

    // Check if the destination cell is occupied
    const targetMonster = game.state[to.y][to.x];
    if (targetMonster !== null && targetMonster.playerName === game.turn) {
        return false;
    }

    // Check if the path is clear of monsters
    if (!isPathClear(game, from, to)) {
        return false;
    }

    // Calculate the distance of the move
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);

    // Allow unlimited horizontal and vertical moves
    if ((dx > 0 && dy === 0) || (dy > 0 && dx === 0)) {
        return true;
    }

    // Allow diagonal moves up to 2 spaces
    if (dx === dy && dx <= 2) {
        return true;
    }

    return false;
}

// Function to check if the path is clear of monsters
function isPathClear(game, from, to) {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);

    // Check if the movement is horizontal
    if (dx !== 0 && dy === 0) {
        for (let x = Math.min(from.x, to.x) + 1; x < Math.max(from.x, to.x); x++) {
            const monster = game.state[from.y][x];
            if (monster !== null && monster.playerName !== game.turn) {
                return false;
            }
        }
        return true;
    }

    // Check if the movement is vertical
    if (dx === 0 && dy !== 0) {
        for (let y = Math.min(from.y, to.y) + 1; y < Math.max(from.y, to.y); y++) {
            const monster = game.state[y][from.x];
            if (monster !== null && monster.playerName !== game.turn) {
                return false;
            }
        }
        return true;
    }

    // Check if the movement is diagonal
    if (dx !== 0 && dy !== 0) {
        let x = from.x + dx;
        let y = from.y + dy;

        while (x !== to.x || y !== to.y) {
            if (x < 0 || x >= game.state[0].length || y < 0 || y >= game.state.length) {
                return false;
            }

            const monster = game.state[y][x];
            if (monster !== null && monster.playerName !== game.turn) {
                return false;
            }

            x += dx;
            y += dy;
        }

        return true;
    }

    return false;
}

// Function to resolve combat between two monsters
function resolveCombat(currentMonster, targetMonster) {
    const combatMatrix = {
        '🧛‍♀️': { '🐺': 'current', '👻': 'target', '🧛‍♀️': 'both' },
        '🐺': { '🧛‍♀️': 'target', '👻': 'current', '🐺': 'both' },
        '👻': { '🧛‍♀️': 'current', '🐺': 'target', '👻': 'both' }
    };

    if (!combatMatrix[currentMonster.type] || !combatMatrix[currentMonster.type][targetMonster.type]) {
        console.error('Combat type not defined:', currentMonster.type, targetMonster.type);
        return null;
    }

    return combatMatrix[currentMonster.type][targetMonster.type];
}

// Function to get the next player
function getNextPlayer(game) {
    const currentIndex = game.players.findIndex(p => p.playerName === game.turn);
    const nextIndex = (currentIndex + 1) % game.players.length;
    return game.players[nextIndex].playerName;
}

// Start the server on port 8080
server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});
