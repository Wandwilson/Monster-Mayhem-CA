const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index');
});

router.post('/game', (req, res) => {
    const playerName = req.body.playerName;
    const invitationCode = req.body.invitationCode;

    // Generated an random id for the match or the user can put one.
    const gameId = invitationCode || Math.floor(Math.random() * 10000).toString();

    res.render('game', { gameId, playerName });
});

module.exports = router;
