document.addEventListener('DOMContentLoaded', () => {
    const socket = new WebSocket(`ws://${window.location.hostname}:8080`);

    socket.onopen = () => {
        // Display the Username and ID of the game on the game interface
        const message = { type: 'startGame', payload: { gameId, playerName } };
        socket.send(JSON.stringify(message));
    };
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        // console.log('Received message from server:', message);

        if (message.type === 'gameState') {
            currentTurnPlayer = message.payload.turn; 
            renderGameBoard(message.payload.state);

            // Show how many monster each player have on the game
            updateScoreboard(message.payload.playerMonstersCount);

            // Change the board color to show who is the turn
            if (currentTurnPlayer === playerName) {
                document.getElementById('game-board').classList.add('turn');
            } else {
                document.getElementById('game-board').classList.remove('turn');
            }
        }
    };


    let selectedMonster = null;
    let selectedPosition = null;

    document.querySelectorAll('.monster-selection').forEach(element => {
        element.addEventListener('click', (event) => {
            selectedMonster = event.target.dataset.monsterType;
            selectedPosition = null;
            console.log('Selected monster:', selectedMonster);
        });
    });

    //Function genereted by AI.
    document.getElementById('game-board').addEventListener('click', (event) => {
        if (!document.getElementById('game-board').classList.contains('turn')) {
            alert('Not your turn!');
            return;
        }

        const cell = event.target;
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);

        if (selectedMonster) {
            const placeMessage = { type: 'placeMonster', payload: { gameId, playerName, monsterType: selectedMonster, position: { x, y } } };
            socket.send(JSON.stringify(placeMessage));
            selectedMonster = null;
        } else {
            if (selectedPosition) {
                const moveMessage = { type: 'moveMonster', payload: { gameId, playerName, from: selectedPosition, to: { x, y } } };
                socket.send(JSON.stringify(moveMessage));
                selectedPosition = null;
            } else if (cell.classList.contains(`player-${playerName}`)) {
                selectedPosition = { x, y };
            }
        }
    });

    // Draw the game board
    function renderGameBoard(state) {
        const boardElement = document.getElementById('game-board');
        boardElement.innerHTML = '';

        state.forEach((row, y) => {
            row.forEach((cell, x) => {
                const cellElement = document.createElement('div');
                cellElement.classList.add('cell');
                cellElement.classList.add('btnGame');
                cellElement.classList.add('mx-2');
                cellElement.classList.add('mb-2');
                if (cell) {
                    cellElement.classList.add(`player-${cell.playerName}`);
                    cellElement.innerText = cell.type;
                    if (cell.playerName === currentTurnPlayer) {
                        cellElement.classList.add('monster-turn');
                    }
                }
                cellElement.dataset.x = x;
                cellElement.dataset.y = y;
                boardElement.appendChild(cellElement);
            });
        });
    }
    // function create by AI.
    function updateScoreboard(playerMonstersCount) {
        const scoreboardElement = document.getElementById('scoreboard');
        scoreboardElement.innerHTML = '';

        for (const playerName in playerMonstersCount) {
            const playerScore = playerMonstersCount[playerName];
            const playerScoreElement = document.createElement('div');
            playerScoreElement.innerText = `${playerName}: ${playerScore} ${playerScore === 1 ? 'monster' : 'monsters'}`;
            scoreboardElement.appendChild(playerScoreElement);
        }
    }

});
