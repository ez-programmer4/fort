const router = require('express').Router();
const { requireAuth, requirePermission } = require('../../middleware/auth');
const ctrl = require('./dashboard.controller');

router.use(requireAuth);

router.get('/', requirePermission('dashboard.view'), ctrl.overview);
router.get('/analytics', requirePermission('dashboard.view'), ctrl.analytics);
router.get('/sales-overview', requirePermission('dashboard.view'), ctrl.salesOverview);

module.exports = router;
