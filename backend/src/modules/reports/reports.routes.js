const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const bincard = require('./bincard.controller');

router.use(requireAuth);

router.get('/bincard', requirePermission('products.view', 'inventory.view'), bincard.binCard);

module.exports = router;
