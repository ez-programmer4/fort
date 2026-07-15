const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('./auth.controller');

router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
