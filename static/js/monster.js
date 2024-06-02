document.addEventListener('DOMContentLoaded', () => {
    const socket = new WebSocket(`ws://${window.location.hostname}:8080`);

    socket.onopen = () => {
        // Display the Username and ID of the game on the game interface
        const message = { type: 'startGame', payload: { gameId, playerName } };
        socket.send(JSON.stringify(message));
    };
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received message from server:', message);

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
        } else if (message.type === 'statsUpdate') {
            updateGameStats(message.payload.totalGamesPlayed, message.payload.playerStats);
        }
    };

});
