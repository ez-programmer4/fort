const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./inventory.controller');

router.use(requireAuth);

router.get('/', requirePermission('inventory.view'), ctrl.list);
router.get('/export', requirePermission('inventory.view'), ctrl.exportInventory);
router.get('/movements', requirePermission('inventory.view'), ctrl.movements);
router.post('/adjust', requirePermission('inventory.adjust'), ctrl.adjust);
router.post('/dispose', requirePermission('inventory.adjust'), ctrl.dispose);

module.exports = router;
