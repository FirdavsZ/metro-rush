const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { saveScore, getLeaderboard, getMyScores } = require('../controllers/scoreController');

router.post('/', auth, saveScore);
router.get('/leaderboard', getLeaderboard);
router.get('/me', auth, getMyScores);

module.exports = router;
